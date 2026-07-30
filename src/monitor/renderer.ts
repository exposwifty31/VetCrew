/**
 * VetCrew patient monitor — framework-agnostic canvas renderer.
 *
 * Ported from `spikes/webxr/src/monitor.js`, which proved (ADR-001) that one
 * monitor implementation drives a 2D DOM client and a WebXR client with no
 * changes. Keeping it framework-free here preserves that: it imports nothing,
 * touches no React, and holds no session state. The wrapper owns the lifecycle.
 *
 * Channel colours follow the real uMEC12 Vet mapping and signal parameter
 * IDENTITY only (CLAUDE.md §4). Severity never rides on hue — it rides on the
 * separate alarm layer (LED strip, full-screen frame, value flash).
 *
 * Honesty rule: this renderer draws ONLY the channels the engine actually
 * supplies. A vital the scenario does not model is absent, never zeroed and
 * never invented — a plausible-looking SpO₂ the sim never produced would be
 * fabricated clinical data on a surface that feeds an evidence record (§2.3).
 */

type ChannelKey = "ecg" | "pleth" | "art" | "co2";

const CHANNELS: Record<ChannelKey, { readonly color: string; readonly label: string }> = {
  ecg: { color: "#00FF66", label: "ECG" },
  pleth: { color: "#00CCFF", label: "Pleth" },
  art: { color: "#FF3B30", label: "Art" },
  co2: { color: "#FFCC00", label: "Resp" },
};

/** Severity is an explicit input. The renderer never derives it from values. */
export type AlarmLevel = "normal" | "caution" | "critical";

/** Engine vital names (`RoleView.vitals` keys) the monitor understands. */
export interface MonitorVitals {
  readonly hr?: number | undefined;
  readonly rr?: number | undefined;
  readonly temp?: number | undefined;
  readonly spo2?: number | undefined;
  readonly etco2?: number | undefined;
  readonly sys_bp?: number | undefined;
  readonly dia_bp?: number | undefined;
}

const W = 1024;
const H = 768;
const SWEEP_PX_PER_SEC = 190;
const BLANK_PX = 26;
const TRACE_FRACTION = 0.62;

// ── waveform shape generators: phase (0..1) → amplitude (-1..1) ──────────────
function ecgWave(p: number): number {
  if (p < 0.12) return 0.14 * Math.sin((p / 0.12) * Math.PI); // P
  if (p < 0.18) return 0;
  if (p < 0.205) return -0.18 * ((p - 0.18) / 0.025); // Q
  if (p < 0.235) return -0.18 + 1.18 * ((p - 0.205) / 0.03); // R up
  if (p < 0.265) return 1.0 - 1.35 * ((p - 0.235) / 0.03); // R down
  if (p < 0.3) return -0.35 + 0.35 * ((p - 0.265) / 0.035); // S
  if (p < 0.42) return 0;
  if (p < 0.62) return 0.28 * Math.sin(((p - 0.42) / 0.2) * Math.PI); // T
  return 0;
}
function plethWave(p: number): number {
  if (p < 0.16) return Math.sin((p / 0.16) * (Math.PI / 2));
  if (p < 0.42) {
    const t = (p - 0.16) / 0.26;
    return 1 - 0.55 * t * t;
  }
  if (p < 0.5) {
    const t = (p - 0.42) / 0.08;
    return 0.45 + 0.1 * Math.sin(t * Math.PI); // dicrotic notch
  }
  const t = (p - 0.5) / 0.5;
  return 0.55 * (1 - t) * (1 - t);
}
function artWave(p: number): number {
  if (p < 0.1) return Math.sin((p / 0.1) * (Math.PI / 2));
  if (p < 0.36) {
    const t = (p - 0.1) / 0.26;
    return 1 - 0.6 * t;
  }
  if (p < 0.44) {
    const t = (p - 0.36) / 0.08;
    return 0.4 + 0.12 * Math.sin(t * Math.PI);
  }
  const t = (p - 0.44) / 0.56;
  return 0.52 * (1 - t);
}
function respWave(p: number): number {
  if (p < 0.08) return 0;
  if (p < 0.18) return (p - 0.08) / 0.1; // upstroke
  if (p < 0.62) return 0.92 + 0.08 * ((p - 0.18) / 0.44); // plateau
  if (p < 0.7) return 1 - (p - 0.62) / 0.08; // downstroke
  return 0;
}

type LaneSpec = {
  readonly key: string;
  readonly channel: ChannelKey;
  readonly label: string;
  readonly gen: (p: number) => number;
  /** Which vital sets this lane's frequency. */
  readonly rate: "hr" | "rr";
  /** Vital that must be present for the lane to exist at all. */
  readonly requires: keyof MonitorVitals;
};

const ALL_LANES: readonly LaneSpec[] = [
  { key: "ecg", channel: "ecg", label: "ECG", gen: ecgWave, rate: "hr", requires: "hr" },
  { key: "ecg2", channel: "ecg", label: "II", gen: ecgWave, rate: "hr", requires: "hr" },
  { key: "pleth", channel: "pleth", label: "Pleth", gen: plethWave, rate: "hr", requires: "spo2" },
  { key: "art", channel: "art", label: "Art", gen: artWave, rate: "hr", requires: "sys_bp" },
  { key: "resp", channel: "co2", label: "Resp", gen: respWave, rate: "rr", requires: "rr" },
];

const TRACE_TOP = 56;
const TRACE_BOTTOM = H - 96;

type Trace = { readonly spec: LaneSpec; readonly buf: Float32Array; phase: number };

function present(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Alarm→colour for the LED strip. Severity lives here, never on channel hue. */
function ledStripColor(alarm: AlarmLevel, flashOn: boolean): string {
  if (alarm === "critical") return flashOn ? "#FF2A1F" : "#3a0d0a";
  if (alarm === "caution") return flashOn ? "#FFCC00" : "#3a3208";
  return "#12202b";
}

export class MonitorRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly traceW = Math.ceil(W * TRACE_FRACTION);
  private traces: Trace[] = [];
  private vitals: MonitorVitals = {};
  private alarm: AlarmLevel = "normal";
  private species = "";
  private cursor = 0;
  private elapsed = 0;
  private blink = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("2d context unavailable");
    this.ctx = ctx;
  }

  /** Lanes are rebuilt only when the SET of available channels changes. */
  setVitals(vitals: MonitorVitals): void {
    const before = this.traces.map((t) => t.spec.key).join(",");
    this.vitals = vitals;
    const lanes = ALL_LANES.filter((lane) => present(vitals[lane.requires]));
    if (lanes.map((l) => l.key).join(",") !== before) {
      this.traces = lanes.map((spec) => ({
        spec,
        buf: new Float32Array(this.traceW),
        phase: 0,
      }));
    }
  }

  setAlarm(level: AlarmLevel): void {
    this.alarm = level;
  }

  setSpecies(species: string): void {
    this.species = species;
  }

  /** Advance the sweep. Separated from draw() so it can be stepped headlessly. */
  step(dt: number): void {
    this.elapsed += dt;
    this.blink = (this.blink + dt) % 1;
    const advance = SWEEP_PX_PER_SEC * dt;
    const start = this.cursor;
    const end = start + advance;
    for (const trace of this.traces) {
      const rateValue = trace.spec.rate === "rr" ? this.vitals.rr : this.vitals.hr;
      const hz = (present(rateValue) ? rateValue : 0) / 60;
      for (let x = Math.floor(start); x < end; x++) {
        const i = ((x % this.traceW) + this.traceW) % this.traceW;
        trace.phase = (trace.phase + (hz * dt) / Math.max(advance, 0.0001)) % 1;
        trace.buf[i] = trace.spec.gen(trace.phase);
      }
    }
    this.cursor = end % this.traceW;
  }

  draw(): void {
    const flashOn = this.blink < 0.5;
    this.drawChrome(flashOn);
    this.drawLanes();
    this.drawNumericColumn(flashOn);
    this.drawBottomBand();
    this.drawAlarmFrame(flashOn);
  }

  /** Background, LED alarm strip, header strip — the device shell. */
  private drawChrome(flashOn: boolean): void {
    const c = this.ctx;

    c.fillStyle = "#05080d";
    c.fillRect(0, 0, W, H);

    // ── LED alarm strip (device chrome, part of the alarm layer) ──
    c.fillStyle = ledStripColor(this.alarm, flashOn);
    c.fillRect(0, 0, W, 10);

    // ── header strip ──
    c.fillStyle = "#0b1219";
    c.fillRect(0, 10, W, 34);
    c.font = "15px ui-sans-serif, system-ui, sans-serif";
    c.fillStyle = "#9fb3c2";
    c.textAlign = "left";
    if (this.species !== "") c.fillText(this.species, 16, 33);
    const clock = `${String(Math.floor(this.elapsed / 60) % 60).padStart(2, "0")}:${String(
      Math.floor(this.elapsed) % 60,
    ).padStart(2, "0")}`;
    c.fillText(clock, 150, 33);
    c.textAlign = "right";
    c.fillStyle = "#5f7382";
    c.fillText("VET MONITOR · VM-12", W - 16, 33);
  }

  /**
   * Waveform lanes (left ~62%) — they share the full trace region, so a
   * scenario with fewer channels gets taller lanes, not dead space.
   */
  private drawLanes(): void {
    const c = this.ctx;
    const laneH =
      this.traces.length === 0 ? 0 : (TRACE_BOTTOM - TRACE_TOP) / this.traces.length;
    let y = TRACE_TOP;
    for (const trace of this.traces) {
      const ch = CHANNELS[trace.spec.channel];
      const mid = y + laneH / 2;
      const amp = Math.min(laneH * 0.4, 62);

      c.strokeStyle = ch.color;
      c.lineWidth = 1.9;
      c.lineJoin = "round";
      c.beginPath();
      let pen = false;
      for (let x = 0; x < this.traceW; x++) {
        // Blanking gap ahead of the cursor — this is what makes it read as an
        // instrument rather than a scrolling chart.
        const ahead = (x - this.cursor + this.traceW) % this.traceW;
        if (ahead < BLANK_PX) {
          pen = false;
          continue;
        }
        const py = mid - (trace.buf[x] ?? 0) * amp;
        if (!pen) {
          c.moveTo(x, py);
          pen = true;
        } else {
          c.lineTo(x, py);
        }
      }
      c.stroke();

      c.font = "13px ui-sans-serif, system-ui, sans-serif";
      c.fillStyle = ch.color;
      c.textAlign = "left";
      c.fillText(trace.spec.label, 10, y + 17);

      y += laneH;
    }
  }

  /** Numeric column (right ~38%) — only channels the engine supplies. */
  private drawNumericColumn(flashOn: boolean): void {
    const c = this.ctx;
    const dim = this.alarm !== "normal" && !flashOn;
    const nx = this.traceW + 26;
    c.textAlign = "left";
    let ny = 74;
    const big = (
      label: string,
      value: string,
      color: string,
      unit: string,
      alarmable: boolean,
    ): void => {
      c.font = "14px ui-sans-serif, system-ui, sans-serif";
      c.fillStyle = color;
      c.fillText(label, nx, ny);
      // Wide values (e.g. "129/78") must shrink rather than run under the unit.
      const maxValueW = W - nx - 58;
      let size = 62;
      c.font = `bold ${size}px ui-sans-serif, system-ui, sans-serif`;
      while (c.measureText(value).width > maxValueW && size > 30) {
        size -= 4;
        c.font = `bold ${size}px ui-sans-serif, system-ui, sans-serif`;
      }
      c.fillStyle = alarmable && dim ? "#3c4a55" : color;
      c.fillText(value, nx, ny + 58);
      if (unit !== "") {
        // Placed off the measured value, never a fixed offset that can collide.
        const valueW = c.measureText(value).width;
        c.font = "13px ui-sans-serif, system-ui, sans-serif";
        c.fillStyle = color;
        c.fillText(unit, nx + valueW + 8, ny + 58);
      }
      ny += 116;
    };

    const v = this.vitals;
    if (present(v.hr)) big("HR", String(Math.round(v.hr)), CHANNELS.ecg.color, "bpm", true);
    if (present(v.spo2)) big("SpO₂", String(Math.round(v.spo2)), CHANNELS.pleth.color, "%", true);
    if (present(v.sys_bp) && present(v.dia_bp)) {
      big(
        "Art",
        `${Math.round(v.sys_bp)}/${Math.round(v.dia_bp)}`,
        CHANNELS.art.color,
        "mmHg",
        false,
      );
    }
    if (present(v.etco2)) {
      big("EtCO₂", String(Math.round(v.etco2)), CHANNELS.co2.color, "mmHg", false);
    } else if (present(v.rr)) {
      big("RR", String(Math.round(v.rr)), CHANNELS.co2.color, "/min", false);
    }
  }

  /** Bottom band: Temp / NIBP (white channels). */
  private drawBottomBand(): void {
    const c = this.ctx;
    const v = this.vitals;
    c.fillStyle = "#0b1219";
    c.fillRect(0, H - 96, W, 96);
    c.font = "14px ui-sans-serif, system-ui, sans-serif";
    if (present(v.temp)) {
      c.fillStyle = "#9fb3c2";
      c.fillText("Temp  °C", 16, H - 68);
      c.font = "bold 40px ui-sans-serif, system-ui, sans-serif";
      c.fillStyle = "#FFFFFF";
      c.fillText(v.temp.toFixed(1), 16, H - 26);
    }
    if (present(v.sys_bp) && present(v.dia_bp)) {
      c.font = "14px ui-sans-serif, system-ui, sans-serif";
      c.fillStyle = "#9fb3c2";
      c.fillText("NIBP  mmHg", 220, H - 68);
      c.font = "bold 40px ui-sans-serif, system-ui, sans-serif";
      c.fillStyle = "#FFFFFF";
      c.fillText(`${Math.round(v.sys_bp)}/${Math.round(v.dia_bp)}`, 220, H - 26);
    }
  }

  /**
   * Full-screen alarm frame. §4 permits this crossing for CRITICAL ONLY — it is
   * "the only permitted crossing", so caution must not borrow it or the critical
   * signal dilutes (alarm fatigue on a surface that feeds an evidence record).
   * Caution is carried by the LED strip and the value flash instead.
   */
  private drawAlarmFrame(flashOn: boolean): void {
    if (this.alarm !== "critical") return;
    const c = this.ctx;
    c.strokeStyle = flashOn ? "#FF2A1F" : "#5a1410";
    c.lineWidth = 6;
    c.strokeRect(3, 3, W - 6, H - 6);
  }
}
