/**
 * VetCrew patient monitor — standalone canvas renderer for deck/hero assets.
 *
 * Self-contained on purpose: no build step, no bundle, no design-system
 * compile. Drop a <canvas> in and call new MonitorRenderer(canvas).start().
 *
 * Channel colours follow the REAL uMEC12 Vet mapping. Severity is NEVER carried
 * by hue here — it rides on the separate alarm layer (LED strip, full-screen
 * frame, value flash). There is NO invasive arterial ("Art") lane: the base-rung
 * patient has no arterial line, it duplicated NIBP, and its red collided with
 * the critical-alarm colour. NIBP is the only blood-pressure readout.
 */

const CHANNELS = {
  ecg:   { color: '#00FF66', label: 'ECG'   },
  pleth: { color: '#00CCFF', label: 'Pleth' },
  co2:   { color: '#FFCC00', label: 'CO2'   },
  resp:  { color: '#D7B13A', label: 'Resp'  },
};

const W = 1180;
const H = 780;
const SWEEP_PX_PER_SEC = 175;
const BLANK_PX = 26;

/* ── waveform generators: phase (0..1) → amplitude (-1..1) ─────────────── */
function ecgWave(p) {
  if (p < 0.12) return 0.14 * Math.sin((p / 0.12) * Math.PI);          // P
  if (p < 0.18) return 0;
  if (p < 0.205) return -0.18 * ((p - 0.18) / 0.025);                  // Q
  if (p < 0.235) return -0.18 + 1.18 * ((p - 0.205) / 0.03);           // R up
  if (p < 0.265) return 1.0 - 1.35 * ((p - 0.235) / 0.03);             // R down
  if (p < 0.30) return -0.35 + 0.35 * ((p - 0.265) / 0.035);           // S
  if (p < 0.42) return 0;
  if (p < 0.62) return 0.28 * Math.sin(((p - 0.42) / 0.2) * Math.PI);  // T
  return 0;
}
function plethWave(p) {
  if (p < 0.16) return Math.sin((p / 0.16) * (Math.PI / 2));
  if (p < 0.42) { const t = (p - 0.16) / 0.26; return 1 - 0.55 * t * t; }
  if (p < 0.5)  { const t = (p - 0.42) / 0.08; return 0.45 + 0.1 * Math.sin(t * Math.PI); } // dicrotic notch
  const t = (p - 0.5) / 0.5;
  return 0.55 * (1 - t) * (1 - t);
}
function co2Wave(p) {
  if (p < 0.08) return 0;
  if (p < 0.18) return (p - 0.08) / 0.1;                  // upstroke
  if (p < 0.62) return 0.92 + 0.08 * ((p - 0.18) / 0.44); // alveolar plateau
  if (p < 0.70) return 1 - (p - 0.62) / 0.08;             // downstroke
  return 0;
}
/* slow impedance respiration — one smooth breath per cycle */
function respWave(p) { return Math.sin(p * Math.PI * 2 - Math.PI / 2) * 0.72; }

const LANES = [
  { key: 'ecg',   gen: ecgWave,   rate: 'hr', ch: 'ecg',   label: 'I',     tag: '1mV' },
  { key: 'ecg2',  gen: ecgWave,   rate: 'hr', ch: 'ecg',   label: 'II',    tag: '1mV' },
  { key: 'pleth', gen: plethWave, rate: 'hr', ch: 'pleth', label: 'Pleth', tag: ''    },
  { key: 'co2',   gen: co2Wave,   rate: 'rr', ch: 'co2',   label: 'CO2',   tag: ''    },
  { key: 'resp',  gen: respWave,  rate: 'rr', ch: 'resp',  label: 'Resp',  tag: ''    },
];

class MonitorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.vitals = { hr: 92, spo2: 97, rr: 22, etco2: 34, temp: 38.4, temp2: 38.5,
                    sys: 122, dia: 78, map: 93, co: 2.8, pvcs: 0, pi: 12.0 };
    this.alarm = 'normal';          // normal | caution | critical
    this.alarming = [];             // e.g. ['hr','spo2']
    this.species = 'Canine';
    this.weight = '18-30 kg';
    this.clock = '2026-07-25 10:15:04';
    this.traces = LANES.map((l) => ({ ...l, buf: new Float32Array(Math.ceil(W * 0.60)), phase: 0 }));
    this.cursor = 0;
    this.elapsed = 0;
    this.blink = 0;
    this._raf = null;
    this._last = 0;
  }

  setVitals(v) { Object.assign(this.vitals, v); return this; }
  setAlarm(level, alarming = []) { this.alarm = level; this.alarming = alarming; return this; }
  setPatient({ species, weight }) {
    if (species) this.species = species;
    if (weight) this.weight = weight;
    return this;
  }

  /** True when the viewer has asked for reduced motion. */
  get reduceMotion() {
    return typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  start() {
    if (this._raf) return this;
    // REDUCED MOTION: keep the SIGNAL, drop the strobe. Traces are drawn once
    // as a static filled trace and alarms hold steady-on (this.blink is pinned
    // so flashOn stays true) rather than flashing. Never remove the alarm — a
    // motion preference must not suppress a clinical signal.
    if (this.reduceMotion) {
      const traceW = this.traces[0].buf.length;
      for (const t of this.traces) {
        const hz = (t.rate === 'rr' ? this.vitals.rr : this.vitals.hr) / 60;
        const cycles = Math.max(1, Math.round(hz * (traceW / SWEEP_PX_PER_SEC)));
        for (let x = 0; x < traceW; x++) t.buf[x] = t.gen(((x / traceW) * cycles) % 1);
      }
      this.cursor = traceW;   // no blanking gap: the trace reads as complete
      this.blink = 0;         // flashOn === true → alarm chrome holds steady-on
      this.draw();
      return this;
    }
    this._last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this.step(dt);
      this.draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    return this;
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; return this; }

  /** Advance the sweep. Separated from draw() so it can be stepped headlessly. */
  step(dt) {
    this.elapsed += dt;
    this.blink = (this.blink + dt) % 1;
    const traceW = this.traces[0].buf.length;
    const advance = SWEEP_PX_PER_SEC * dt;
    const start = this.cursor;
    const end = start + advance;
    for (const t of this.traces) {
      const hz = (t.rate === 'rr' ? this.vitals.rr : this.vitals.hr) / 60;
      for (let x = Math.floor(start); x < end; x++) {
        const i = ((x % traceW) + traceW) % traceW;
        t.phase = (t.phase + (hz * dt) / Math.max(advance, 0.0001)) % 1;
        t.buf[i] = t.gen(t.phase);
      }
    }
    this.cursor = end % traceW;
  }

  draw() {
    const c = this.ctx;
    const crit = this.alarm === 'critical';
    const caution = this.alarm === 'caution';
    const flashOn = this.blink < 0.5;

    c.fillStyle = '#05080d';
    c.fillRect(0, 0, W, H);

    /* ── LED alarm strip — device chrome, part of the alarm layer ── */
    c.fillStyle = crit ? (flashOn ? '#FF2A1F' : '#3a0d0a')
      : caution ? (flashOn ? '#FFD000' : '#3a3208') : '#12202b';
    c.fillRect(0, 0, W, 11);

    /* ── header strip: weight / species / clock ── */
    c.fillStyle = '#0b1219';
    c.fillRect(0, 11, W, 40);
    c.font = '17px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = '#8a97a1'; c.fillText('Weight', 18, 38);
    c.fillStyle = '#c7d0d6'; c.fillText(this.weight, 84, 38);
    c.fillText(this.species, 190, 38);
    c.fillStyle = '#8a97a1'; c.fillText(this.clock, 290, 38);
    // beating heart, top-right of the screen area
    const beat = (this.elapsed * (this.vitals.hr / 60)) % 1;
    const pulse = 1 + 0.28 * Math.max(0, Math.sin(beat * Math.PI * 2)) * (beat < 0.36 ? 1 : 0);
    c.save();
    c.translate(W - 34, 31); c.scale(pulse, pulse);
    c.fillStyle = '#ff3b40';
    c.beginPath();
    c.moveTo(0, 7);
    c.bezierCurveTo(-10, -3, -7, -11, 0, -6);
    c.bezierCurveTo(7, -11, 10, -3, 0, 7);
    c.fill();
    c.restore();

    /* ── waveform lanes (left ~60%) ── */
    const traceW = this.traces[0].buf.length;
    const laneTop = 58;
    const laneBottom = H - 150;
    const laneH = (laneBottom - laneTop) / LANES.length;
    let y = laneTop;
    for (const t of this.traces) {
      const ch = CHANNELS[t.ch];
      const mid = y + laneH / 2;
      const amp = laneH * 0.36;

      c.strokeStyle = ch.color;
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.shadowColor = ch.color;
      c.shadowBlur = 7;
      c.beginPath();
      let pen = false;
      for (let x = 0; x < traceW; x++) {
        // blanking gap ahead of the sweep cursor — this is what makes it read
        // as a real monitor rather than a scrolling chart.
        const ahead = (x - this.cursor + traceW) % traceW;
        if (ahead < BLANK_PX) { pen = false; continue; }
        const py = mid - t.buf[x] * amp;
        if (!pen) { c.moveTo(x, py); pen = true; } else { c.lineTo(x, py); }
      }
      c.stroke();
      c.shadowBlur = 0;

      c.font = '700 15px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
      c.fillStyle = ch.color;
      c.textAlign = 'left';
      c.fillText(t.label, 12, y + 20);
      if (t.tag) {
        c.font = '12px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
        c.fillStyle = 'rgba(255,255,255,.34)';
        c.fillText(t.tag, 12, y + laneH - 10);
      }
      y += laneH;
    }

    /* ── numeric column (right ~40%) ── */
    const nx = traceW + 30;
    c.textAlign = 'left';
    const v = this.vitals;
    const block = (label, unit, value, color, scale, subs, yy, big) => {
      c.font = '700 17px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
      c.fillStyle = color;
      c.fillText(label, nx, yy);
      if (unit) {
        c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
        c.fillStyle = '#8a97a1';
        c.fillText(unit, nx + c.measureText(label).width + 34, yy);
      }
      if (scale) {
        c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
        c.fillStyle = '#71808b';
        c.textAlign = 'right';
        c.fillText(scale[0], W - 16, yy);
        c.fillText(scale[1], W - 16, yy + 16);
        c.textAlign = 'left';
      }
      const dim = this.alarming.includes(big) && (crit || caution) && !flashOn;
      c.font = `800 ${big === 'hr' ? 68 : 50}px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif`;
      c.fillStyle = dim ? '#3c4a55' : color;
      c.fillText(String(value), nx, yy + (big === 'hr' ? 62 : 50));
      if (subs) {
        c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
        c.fillStyle = '#93a0aa';
        c.fillText(subs, nx, yy + (big === 'hr' ? 84 : 70));
      }
    };
    block('ECG', '', Math.round(v.hr), CHANNELS.ecg.color, ['100', '50'],
          `PVCs ${v.pvcs}   ST OFF`, 92, 'hr');
    block('SpO₂', '%', Math.round(v.spo2), CHANNELS.pleth.color, ['100', '90'],
          `PI ${v.pi.toFixed(1)}   PR ${Math.round(v.hr)}`, 216, 'spo2');
    block('CO₂', 'mmHg Et', Math.round(v.etco2), CHANNELS.co2.color, ['60', '20'],
          `awRR ${Math.round(v.rr)}   Fi 2`, 344, 'etco2');
    block('Resp', 'rpm', Math.round(v.rr), CHANNELS.resp.color, ['45', '15'],
          'Source Imp.', 472, 'resp');

    /* ── bottom band: Temp · C.O. · NIBP (white channels) ── */
    const bandY = H - 142;
    c.fillStyle = '#0b1219';
    c.fillRect(0, bandY, W, 142);
    c.strokeStyle = 'rgba(120,140,160,.16)';
    c.beginPath(); c.moveTo(0, bandY); c.lineTo(W, bandY); c.stroke();

    c.textAlign = 'left';
    c.font = '700 15px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#dfe6eb'; c.fillText('Temp', 18, bandY + 30);
    c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8a97a1'; c.fillText('°C', 68, bandY + 30);
    c.font = '800 40px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#FFFFFF'; c.fillText(v.temp.toFixed(1), 18, bandY + 74);
    c.font = '800 26px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillText(v.temp2.toFixed(1), 18, bandY + 108);
    c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8a97a1';
    c.fillText(`TD ${Math.abs(v.temp - v.temp2).toFixed(1)}`, 78, bandY + 108);

    c.font = '700 15px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#dfe6eb'; c.fillText('C.O.', 300, bandY + 30);
    c.font = '800 40px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#FFFFFF'; c.fillText(v.co.toFixed(1), 300, bandY + 74);
    c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8a97a1';
    c.fillText(`C.I. ---  ·  TB ${v.temp2.toFixed(1)}`, 300, bandY + 100);

    c.font = '700 15px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#FFFFFF'; c.fillText('NIBP', nx, bandY + 30);
    c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8a97a1'; c.fillText('mmHg', nx + 52, bandY + 30);
    c.font = '800 46px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#FFFFFF';
    const bpText = `${v.sys}/${v.dia}`;
    // measure while the 46px font is still active — measuring after the switch
    // to 26px under-reports the width and overlaps the MAP onto the reading.
    const bpW = c.measureText(bpText).width;
    c.fillText(bpText, nx, bandY + 78);
    c.font = '800 26px "IBM Plex Sans Condensed", "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#c3ccd3';
    c.fillText(`(${v.map})`, nx + bpW + 12, bandY + 78);
    c.font = '13px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#8a97a1';
    c.fillText('10:15', nx, bandY + 104);
    c.textAlign = 'right';
    c.fillText('Manual', W - 16, bandY + 104);
    c.textAlign = 'left';

    /* ── bottom control bar ── */
    c.fillStyle = '#7d94a4';
    c.font = '14px "IBM Plex Sans Hebrew", ui-sans-serif, system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('Current Configuration: Defaults', W / 2, H - 16);
    c.textAlign = 'right';
    c.fillStyle = '#c3ccd3';
    c.fillText('Alarm Setup      Main Menu', W - 16, H - 16);
    c.textAlign = 'left';

    /* ── full-screen alarm frame: the ONE signal allowed to cross zones ── */
    if (crit || caution) {
      c.strokeStyle = crit ? (flashOn ? '#FF2A1F' : '#5a1410') : (flashOn ? '#FFD000' : '#4a3f0a');
      c.lineWidth = 7;
      c.strokeRect(3.5, 3.5, W - 7, H - 7);
    }
  }
}

if (typeof window !== 'undefined') window.MonitorRenderer = MonitorRenderer;
