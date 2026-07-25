import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-monitor", `
.vc-mon {
  position: relative;
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  background: linear-gradient(180deg, var(--n-800), var(--n-900) 8%, var(--n-950) 92%, var(--inst-room));
  border-radius: 20px;
  padding: 16px;
  border: 1.5px solid var(--inst-bezel-edge);
  color: var(--text-primary);
  font-family: var(--font-ui);
  box-shadow: 0 1px 1px rgba(255,255,255,0.08) inset, var(--shadow-card);
  transition: box-shadow var(--dur-base) var(--ease-standard);
}
/* device number font: bold neutral tabular sans (NOT a sci-fi mono) */
.vc-mon, .vc-mon * {
  --_dnum: var(--font-metric);
}
.vc-mon__dev {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.vc-mon__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 8px;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.vc-mon__brand b {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: .03em;
  color: var(--text-primary);
  white-space: nowrap;
}
.vc-mon__brand span {
  margin-inline-start: auto;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--text-muted);
  white-space: nowrap;
}
/* LED alarm strip */
.vc-mon__led {
  height: 8px;
  border-radius: 4px;
  background: var(--inst-room);
  margin: 0 2px 8px;
  flex: 0 0 auto;
  border: 1px solid rgba(0, 0, 0, 0.5);
}
.vc-mon[data-alarm="critical"] .vc-mon__led {
  animation: vc-led-crit .5s steps(1,end) infinite;
}
.vc-mon[data-alarm="caution"] .vc-mon__led {
  animation: vc-led-caut 1s steps(1,end) infinite;
}
/* recessed screen */
.vc-mon__screen {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--inst-screen);
  direction: ltr;
  box-shadow: var(--inst-recess);
  display: flex;
  flex-direction: column;
}
.vc-mon__frame {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  pointer-events: none;
  z-index: 8;
  border: 3px solid transparent;
}
.vc-mon[data-alarm="critical"] .vc-mon__frame {
  border-color: var(--alarm-critical);
  animation: vc-alarm-crit .5s steps(1,end) infinite;
  box-shadow: inset 0 0 32px rgba(255,42,42,0.45);
}
.vc-mon[data-alarm="caution"] .vc-mon__frame {
  border-color: var(--alarm-caution);
  animation: vc-alarm-caut 1s steps(1,end) infinite;
  box-shadow: inset 0 0 24px rgba(255,208,0,0.25);
}
/* header strip */
.vc-mon__hdr {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  flex: 0 0 auto;
  border-bottom: 1px solid rgba(120,140,160,.12);
  background: rgba(15, 24, 30, 0.4);
}
.vc-mon__hdr .k {
  color: var(--text-muted);
}
.vc-mon__heart {
  margin-inline-start: auto;
  color: var(--alarm-critical);
  display: inline-flex;
}
.vc-mon__heart svg {
  width: 20px;
  height: 20px;
  animation: vc-heart 1s ease-in-out infinite;
}
@keyframes vc-heart {
  0%, 100% { transform: scale(1) }
  18% { transform: scale(1.28) }
  36% { transform: scale(1) }
}
/* main = waveforms | values */
.vc-mon__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  grid-template-rows: minmax(0, 1fr);
}
.vc-mon__cwrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  border-inline-end: 1px solid rgba(120,140,160,.12);
}
.vc-mon__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.vc-mon__values {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.vc-mon__val {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  padding: 1px 14px;
  border-bottom: 1px solid rgba(120,140,160,.08);
  position: relative;
  container-type: size;
}
.vc-mon__val:last-child {
  border-bottom: none;
}
.vc-mon__vtop {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 0 0 auto;
  line-height: 1.05;
}
.vc-mon__vlabel {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .04em;
}
.vc-mon__vunit {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}
.vc-mon__vscale {
  margin-inline-start: auto;
  font-family: var(--_dnum);
  font-size: 11px;
  color: var(--text-muted);
  text-align: end;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.vc-mon__num {
  font-family: var(--_dnum);
  font-variant-numeric: tabular-nums lining-nums;
  font-weight: 800;
  line-height: 1;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  max-width: 100%;
  overflow: visible;
  flex: 0 0 auto;
}
.vc-mon__num small {
  font-size: .5em;
  font-weight: 700;
  padding-bottom: .15em;
}
.vc-mon__vsub {
  display: flex;
  gap: 14px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.vc-mon__vsub b {
  font-family: var(--_dnum);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
/* progressive disclosure — a short block keeps its LABEL + NUMBER and drops
   secondary detail, instead of overlapping. Thresholds are per-block (each
   .vc-mon__val is its own size container). */
@container (max-height:58px) {
  .vc-mon__vsub { display: none; }
}
@container (max-height:40px) {
  .vc-mon__vscale { display: none; }
}
.vc-mon[data-alarm] .vc-mon__val[data-alarming="1"] .vc-mon__num {
  animation: vc-num-crit .5s steps(1,end) infinite;
}
/* bottom band: temp | co | nibp */
.vc-mon__band {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  border-top: 1px solid rgba(120,140,160,.14);
  flex: 0 0 auto;
  background: rgba(15, 24, 30, 0.2);
}
.vc-mon__bandL {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 6px 12px;
  border-inline-end: 1px solid rgba(120,140,160,.12);
}
.vc-mon__bcell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.vc-mon__bcell .lab {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: .03em;
}
.vc-mon__bigwhite {
  font-family: var(--_dnum);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--text-primary);
  line-height: .95;
  font-size: 26px;
}
.vc-mon__bsub {
  font-family: var(--_dnum);
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.vc-mon__nibp {
  padding: 6px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.vc-mon__nibp .lab {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: .03em;
}
.vc-mon__nibp .big {
  font-family: var(--_dnum);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  color: var(--text-primary);
  font-size: 30px;
  line-height: .95;
}
.vc-mon__nibp .row {
  display: flex;
  gap: 10px;
  font-family: var(--_dnum);
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
/* bottom control bar */
.vc-mon__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  flex: 0 0 auto;
  border-top: 1px solid rgba(120,140,160,.1);
  background: rgba(7, 13, 16, 0.8);
}
.vc-mon__stat {
  display: flex;
  gap: 6px;
  color: var(--text-muted);
}
.vc-mon__cfg {
  margin-inline: auto;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.vc-mon__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  cursor: pointer;
  background: linear-gradient(180deg, var(--n-700), var(--n-850));
  border: 1px solid var(--n-950);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 12.5px;
  font-weight: 700;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset;
  transition: transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
.vc-mon__btn svg {
  width: 15px;
  height: 15px;
}
.vc-mon__btn:hover {
  filter: brightness(1.15);
}
.vc-mon__btn:active {
  transform: translateY(1px);
}
.vc-mon__btn:focus-visible {
  outline: 2px solid var(--inst-focus);
  outline-offset: 2px;
}
.vc-mon__btn--accent {
  background: linear-gradient(180deg, var(--teal-500), var(--teal-700));
  border: 1px solid var(--teal-900);
}
/* right physical button column */
.vc-mon__rail {
  flex: 0 0 66px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
}
.vc-mon__spk {
  width: 46px;
  height: 20px;
  border-radius: 5px;
  background: var(--inst-room);
  box-shadow: inset 0 2px 4px var(--inst-bezel-edge);
  flex: 0 0 auto;
}
.vc-mon__hw {
  width: 48px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--n-700), var(--n-850));
  border: 1.5px solid var(--n-950);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset;
  transition: transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
.vc-mon__hw svg {
  width: 22px;
  height: 22px;
}
.vc-mon__hw:hover {
  filter: brightness(1.15);
}
.vc-mon__hw:active {
  transform: translateY(1px);
}
.vc-mon__hw:focus-visible {
  outline: 2px solid var(--inst-focus);
  outline-offset: 2px;
}
.vc-mon__hw--amber {
  background: linear-gradient(180deg, var(--amber-500), var(--amber-700));
  color: var(--n-950);
  border-color: var(--amber-900, var(--inst-bezel-edge));
}
.vc-mon__hw--amber[data-muted="1"] {
  box-shadow: 0 0 14px var(--alarm-caution-glow);
}
.vc-mon__knob {
  margin-top: auto;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: radial-gradient(circle at 38% 32%, var(--n-700), var(--n-850) 60%, var(--n-950));
  border: 1.5px solid var(--inst-bezel-edge);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255, 255, 255, 0.08) inset;
}
.vc-mon__knob::after {
  content: "";
  position: absolute;
}
`);

/* ---- waveform generators — sample(t in [0,1)) → y in [-1,1] ------------- */
const g = (t, c, w, a) => a * Math.exp(-((t - c) * (t - c)) / (2 * w * w));
function ecg(t) {
  return g(t, 0.16, 0.016, 0.16) - g(t, 0.235, 0.006, 0.22) + g(t, 0.25, 0.006, 1.0) - g(t, 0.265, 0.008, 0.30) + g(t, 0.44, 0.03, 0.30);
}
function pleth(t) {
  const m = g(t, 0.22, 0.075, 1.0) + g(t, 0.46, 0.06, 0.34);
  return m * 1.6 - 0.8;
}
function capno(t) {
  let v;
  if (t < 0.14) v = 0;
  else if (t < 0.22) v = (t - 0.14) / 0.08;
  else if (t < 0.74) v = 1 + (t - 0.22) * 0.06;
  else if (t < 0.80) v = 1 - (t - 0.74) / 0.06;
  else v = 0;
  return v * 1.5 - 0.72;
}
/* slow impedance respiration wave — smooth, one breath per cycle */
function resp(t) {
  return (Math.sin(t * Math.PI * 2 - Math.PI / 2)) * 0.7;
}

/* Fixed lane stack — base-rung config. NO invasive arterial line, so no Art
   lane; respiration is shown instead. Five lanes map 1:1 to the five value
   blocks (ECG spans its two lanes) so every waveform aligns with its number. */
const WAVES = [
  { key: "ecg1", gen: ecg,   kind: "beat",   color: "#"+"00ff66", label: "I",     tag: "1mV" },
  { key: "ecg2", gen: ecg,   kind: "beat",   color: "#"+"00ff66", label: "II",    tag: "1mV" },
  { key: "pleth",gen: pleth, kind: "beat",   color: "#"+"00ccff", label: "Pleth", tag: ""    },
  { key: "co2",  gen: capno, kind: "breath", color: "#"+"ffcc00", label: "CO2",   tag: ""    },
  { key: "resp", gen: resp,  kind: "breath", color: "#"+"d7b13a", label: "Resp",  tag: ""    },
];

const DEF = {
  channels: { hr: 60, spo2: 98, etco2: 38, resp: 20 },
  temp: { t1: 37.0, t2: 37.2 },
  co: { value: 2.8, ci: "---", tb: 37.2 },
  nibp: { sys: 120, dia: 80, map: 93, time: "09:57", pr: 60 },
};

function HeartIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9C1.2 8.8 2.6 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.4 0 4.8 3.3 3.3 6.5C19 16.4 12 21 12 21Z"/></svg>; }

/**
 * PatientMonitor — Mindray-uMEC12-Vet-style main monitor (layout matched to the
 * real device; brand wordmarks intentionally NOT reproduced). True SWEEP-
 * rendered waveforms (a cursor erases/rewrites the trace, never scrolls) across
 * five lanes: ECG I, ECG II, Pleth, CO2, Resp. (Base-rung config: no invasive
 * arterial line, so no Art lane/value — that is opt-in for surgical scenarios.)
 * Channel colour = identity (Layer A); alarm state = separate, redundantly
 * coded (LED strip + full-screen frame + number flash + mute light) = Layer B.
 * Numerals are a bold neutral tabular sans, matching the device (not a mono).
 */
export function PatientMonitor({
  patient = { species: "dog", breed: "Canine", weightKg: 22, weightRange: "18–30 kg" },
  channels = {},
  sub = {},              // { pvcs, st, pr, pi, awrr, fi } sub-values
  temp = {}, co = {}, nibp = {},
  alarm = "normal",
  alarming = [],
  muted = false,
  sweepSpeed = 1,
  clock = "2019-08-21 09:59:38",
  onToggleMute, onFreeze, onNibp, onMenu, onAlarmSetup,
  className = "", style, ...rest
}) {
  const ch = { ...DEF.channels, ...channels };
  const T = { ...DEF.temp, ...temp }, CO = { ...DEF.co, ...co }, NB = { ...DEF.nibp, ...nibp };
  const canvasRef = React.useRef(null), wrapRef = React.useRef(null);
  const stateRef = React.useRef({ ch, sweepSpeed });
  stateRef.current = { ch, sweepSpeed };

  React.useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let buffers = [], phase = new Array(WAVES.length).fill(0), lastPx = 0, started = 0, raf;
    const GAP = 16;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function size() {
      const r = wrap.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width)); H = Math.max(2, Math.round(r.height));
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buffers = WAVES.map(() => new Array(W).fill(NaN));
      lastPx = 0; if (reduce) drawStatic();
    }
    function step(px, prev) {
      const st = stateRef.current, pps = 150 * (st.sweepSpeed || 1);
      for (let x = prev + 1; x <= px; x++) {
        const xi = ((x % W) + W) % W;
        for (let i = 0; i < WAVES.length; i++) {
          const rate = WAVES[i].kind === "beat" ? (st.ch.hr || 60) : (st.ch.resp || 15);
          phase[i] = (phase[i] + (rate / 60) / pps) % 1;
          buffers[i][xi] = WAVES[i].gen(phase[i]);
          buffers[i][(xi + GAP) % W] = NaN;
        }
      }
      render();
    }
    function render() {
      const n = WAVES.length, lh = H / n;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const cy = (i + 0.5) * lh, amp = lh * 0.34, w = WAVES[i];
        ctx.strokeStyle = w.color; ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.shadowColor = w.color; ctx.shadowBlur = 6;
        ctx.beginPath(); let pen = false;
        for (let x = 0; x < W; x++) {
          const v = buffers[i][x];
          if (Number.isNaN(v)) { pen = false; continue; }
          const y = cy - v * amp;
          if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke(); ctx.shadowBlur = 0;
        // lane label + gain, drawn at trace start
        ctx.fillStyle = w.color; ctx.font = "700 12px system-ui, sans-serif"; ctx.textBaseline = "top";
        ctx.fillText(w.label, 8, cy - lh / 2 + 4);
        if (w.tag) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "10px system-ui"; ctx.fillText(w.tag, 8, cy + lh / 2 - 16); }
      }
    }
    function drawStatic() {
      const st = stateRef.current;
      buffers = WAVES.map((w) => {
        const arr = new Array(W); const rate = w.kind === "beat" ? (st.ch.hr || 60) : (st.ch.resp || 15);
        const cycles = Math.max(1, Math.round((rate / 60) * (W / 150)));
        for (let x = 0; x < W; x++) arr[x] = w.gen((x / W * cycles) % 1);
        return arr;
      });
      render();
    }
    function loop(t) {
      if (!started) { started = t; lastPx = 0; }
      const pps = 150 * (stateRef.current.sweepSpeed || 1);
      const target = Math.floor(((t - started) / 1000) * pps);
      if (target > lastPx) { step(target, lastPx); lastPx = target; }
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(size); ro.observe(wrap); size();
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const beatDur = `${(60 / (ch.hr || 60)).toFixed(2)}s`;

  return (
    <div
      className={`vc-mon ${className}`}
      data-alarm={alarm !== "normal" ? alarm : undefined}
      role="group"
      aria-label={`מוניטור מטופל — ${patient.breed || ""}${patient.weightRange ? " " + patient.weightRange : ""}${alarm !== "normal" ? " — התרעה " + (alarm === "critical" ? "קריטית" : "אזהרה") : ""}`}
      style={style} {...rest}
    >
      <div className="vc-mon__dev">
        <div className="vc-mon__brand"><b>VET MONITOR</b><span>VM-12</span></div>
        <div className="vc-mon__led" aria-hidden="true" />
        <div className="vc-mon__screen" dir="ltr">
          <div className="vc-mon__frame" aria-hidden="true" />
          {/* header strip */}
          <div className="vc-mon__hdr">
            <span><span className="k">Weight</span> {patient.weightRange || (patient.weightKg + " kg")}</span>
            <span>{patient.breed}</span>
            <span className="k" style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</span>
            <span className="vc-mon__heart" style={{ animationDuration: beatDur }}><HeartIcon /></span>
          </div>
          {/* main: waveforms | values */}
          <div className="vc-mon__main">
            <div className="vc-mon__cwrap" ref={wrapRef}><canvas className="vc-mon__canvas" ref={canvasRef} /></div>
            <div className="vc-mon__values">
              {/* ECG / HR — spans its two ECG lanes */}
              <div className="vc-mon__val" data-alarming={alarming.includes("hr") ? "1" : undefined} style={{ flex: 2 }}>
                <div className="vc-mon__vtop"><span className="vc-mon__vlabel" style={{ color: "var(--ch-hr)" }}>ECG</span><span className="vc-mon__vscale">100<br />50</span></div>
                <div className="vc-mon__num" style={{ color: "var(--ch-hr)", fontSize: "clamp(22px, 36cqh, 60px)" }}>{Math.round(ch.hr)}</div>
                <div className="vc-mon__vsub"><span>PVCs <b>{sub.pvcs ?? 0}</b></span><span>ST <b>{sub.st ?? "OFF"}</b></span></div>
              </div>
              {/* SpO2 — aligns Pleth lane */}
              <div className="vc-mon__val" data-alarming={alarming.includes("spo2") ? "1" : undefined}>
                <div className="vc-mon__vtop"><span className="vc-mon__vlabel" style={{ color: "var(--ch-spo2)" }}>SpO₂</span><span className="vc-mon__vunit">%</span><span className="vc-mon__vscale">100<br />90</span></div>
                <div className="vc-mon__num" style={{ color: "var(--ch-spo2)", fontSize: "clamp(18px, 34cqh, 40px)" }}>{Math.round(ch.spo2)}</div>
                <div className="vc-mon__vsub"><span>PI <b>{sub.pi ?? 12.0}</b></span><span>PR <b>{sub.pr ?? Math.round(ch.hr)}</b></span></div>
              </div>
              {/* CO2 — aligns CO2 lane */}
              <div className="vc-mon__val" data-alarming={alarming.includes("etco2") ? "1" : undefined}>
                <div className="vc-mon__vtop"><span className="vc-mon__vlabel" style={{ color: "var(--ch-etco2)" }}>CO₂</span><span className="vc-mon__vunit">mmHg Et</span><span className="vc-mon__vscale">60<br />20</span></div>
                <div className="vc-mon__num" style={{ color: "var(--ch-etco2)", fontSize: "clamp(18px, 34cqh, 40px)" }}>{Math.round(ch.etco2)}</div>
                <div className="vc-mon__vsub"><span>awRR <b>{sub.awrr ?? Math.round(ch.resp)}</b></span><span>Fi <b>{sub.fi ?? 2}</b></span></div>
              </div>
              {/* Resp — aligns Resp lane */}
              <div className="vc-mon__val" data-alarming={alarming.includes("resp") ? "1" : undefined}>
                <div className="vc-mon__vtop"><span className="vc-mon__vlabel" style={{ color: "var(--ch-rr)" }}>Resp</span><span className="vc-mon__vunit">rpm</span><span className="vc-mon__vscale">45<br />15</span></div>
                <div className="vc-mon__num" style={{ color: "var(--ch-rr)", fontSize: "clamp(16px, 30cqh, 34px)" }}>{Math.round(ch.resp)}</div>
                <div className="vc-mon__vsub"><span>Source Imp.</span></div>
              </div>
            </div>
          </div>
          {/* bottom band */}
          <div className="vc-mon__band">
            <div className="vc-mon__bandL">
              <div className="vc-mon__bcell">
                <span className="lab">Temp <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>°C</span></span>
                <span className="vc-mon__bigwhite">{T.t1.toFixed(1)}</span>
                <span className="vc-mon__bigwhite" style={{ fontSize: 20 }}>{T.t2.toFixed(1)} <span className="vc-mon__bsub">TD {(Math.abs(T.t1 - T.t2)).toFixed(1)}</span></span>
              </div>
              <div className="vc-mon__bcell">
                <span className="lab">C.O.</span>
                <span className="vc-mon__bigwhite">{CO.value.toFixed(1)}</span>
                <span className="vc-mon__bsub">C.I. {CO.ci} · TB {CO.tb}</span>
                <span className="vc-mon__bsub">NIBP {NB.sys}/{NB.dia} ({NB.map}) · {NB.time}</span>
              </div>
            </div>
            <div className="vc-mon__nibp">
              <span className="lab">NIBP <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>mmHg</span></span>
              <span className="big">{NB.sys}/{NB.dia} <small style={{ fontSize: 18 }}>({NB.map})</small></span>
              <span className="row"><span>{NB.time}</span><span style={{ marginInlineStart: "auto" }}>Manual</span></span>
            </div>
          </div>
          {/* bottom control bar */}
          <div className="vc-mon__bar">
            <span className="vc-mon__stat" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="10" width="18" height="8" rx="1"/><path d="M7 10V7h10v3"/></svg>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h4l2-4 4 8 2-4h4"/></svg>
            </span>
            <span className="vc-mon__cfg">Current Configuration: Defaults</span>
            <button className="vc-mon__btn" onClick={onAlarmSetup}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"/></svg>
              Alarm Setup</button>
            <button className="vc-mon__btn vc-mon__btn--accent" onClick={onMenu}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/></svg>
              Main Menu</button>
          </div>
        </div>
      </div>
      {/* right physical button column */}
      <div className="vc-mon__rail">
        <div className="vc-mon__spk" aria-hidden="true" />
        <button className="vc-mon__hw vc-mon__hw--amber" data-muted={muted ? "1" : undefined} onClick={onToggleMute} aria-pressed={muted} aria-label={muted ? "התרעה מושתקת" : "השהיית התרעה"} title="Alarm pause">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
        </button>
        <button className="vc-mon__hw vc-mon__hw--amber" onClick={onToggleMute} aria-label="איפוס התרעה" title="Alarm reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"/><path d="M4 4l16 16"/></svg>
        </button>
        <button className="vc-mon__hw" onClick={onNibp} aria-label="הפעלת NIBP" title="NIBP">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="7" width="14" height="10" rx="2"/><path d="M9 17v2M15 17v2"/></svg>
        </button>
        <button className="vc-mon__hw" onClick={onFreeze} aria-label="הקפאת מסך" title="Freeze">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M5 8l14 8M19 8 5 16"/></svg>
        </button>
        <button className="vc-mon__hw" onClick={onMenu} aria-label="תצוגה" title="Display">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="12" rx="1"/></svg>
        </button>
        <div className="vc-mon__knob" aria-hidden="true" />
      </div>
    </div>
  );
}
