/**
 * VetCrew patient monitor — framework-agnostic canvas renderer.
 *
 * THIS FILE IS THE POINT OF THE SPIKE.
 *
 * It knows nothing about React, three.js, or WebXR. It draws a uMEC12-Vet-style
 * monitor into a plain <canvas>. The 2D client draws it to a DOM canvas; the
 * WebXR client maps the very same canvas onto a 3D surface as a texture.
 *
 * If that works, ADR-001 holds: the renderer is disposable, the simulation
 * (and, in the real product, the event log + reducer) is the durable asset.
 *
 * Channel colours follow the REAL uMEC12 Vet mapping, not a generic palette:
 * severity is never carried by hue here — it rides on the separate alarm layer
 * (LED strip, full-screen frame, value flash).
 */

export const CHANNELS = {
  ecg:   { color: '#00FF66', label: 'ECG' },
  pleth: { color: '#00CCFF', label: 'Pleth' },
  art:   { color: '#FF3B30', label: 'Art' },
  co2:   { color: '#FFCC00', label: 'CO2' },
}

const W = 1024
const H = 768
const SWEEP_PX_PER_SEC = 190
const BLANK_PX = 26

// ── waveform shape generators: phase (0..1) → amplitude (-1..1) ──────────────
function ecgWave(p) {
  if (p < 0.12) return 0.14 * Math.sin((p / 0.12) * Math.PI)          // P
  if (p < 0.18) return 0
  if (p < 0.205) return -0.18 * ((p - 0.18) / 0.025)                  // Q
  if (p < 0.235) return -0.18 + 1.18 * ((p - 0.205) / 0.03)           // R up
  if (p < 0.265) return 1.0 - 1.35 * ((p - 0.235) / 0.03)             // R down
  if (p < 0.30) return -0.35 + 0.35 * ((p - 0.265) / 0.035)           // S
  if (p < 0.42) return 0
  if (p < 0.62) return 0.28 * Math.sin(((p - 0.42) / 0.2) * Math.PI)  // T
  return 0
}
function plethWave(p) {
  if (p < 0.16) return Math.sin((p / 0.16) * (Math.PI / 2))
  if (p < 0.42) { const t = (p - 0.16) / 0.26; return 1 - 0.55 * t * t }
  if (p < 0.5) { const t = (p - 0.42) / 0.08; return 0.45 + 0.1 * Math.sin(t * Math.PI) } // dicrotic notch
  const t = (p - 0.5) / 0.5
  return 0.55 * (1 - t) * (1 - t)
}
function artWave(p) {
  if (p < 0.1) return Math.sin((p / 0.1) * (Math.PI / 2))
  if (p < 0.36) { const t = (p - 0.1) / 0.26; return 1 - 0.6 * t }
  if (p < 0.44) { const t = (p - 0.36) / 0.08; return 0.4 + 0.12 * Math.sin(t * Math.PI) }
  const t = (p - 0.44) / 0.56
  return 0.52 * (1 - t)
}
function co2Wave(p) {
  if (p < 0.08) return 0
  if (p < 0.18) return (p - 0.08) / 0.1                 // upstroke
  if (p < 0.62) return 0.92 + 0.08 * ((p - 0.18) / 0.44) // alveolar plateau
  if (p < 0.70) return 1 - (p - 0.62) / 0.08            // downstroke
  return 0
}

const LANES = [
  { key: 'ecg',   gen: ecgWave,   gain: 'x1', rate: 'hr',  h: 118 },
  { key: 'ecg2',  gen: ecgWave,   gain: 'x1', rate: 'hr',  h: 100, ch: 'ecg', label: 'II' },
  { key: 'pleth', gen: plethWave, gain: '',   rate: 'hr',  h: 104 },
  { key: 'art',   gen: artWave,   gain: '',   rate: 'hr',  h: 104 },
  { key: 'co2',   gen: co2Wave,   gain: '',   rate: 'rr',  h: 104 },
]

export class MonitorRenderer {
  constructor(canvas) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    this.ctx = canvas.getContext('2d')
    this.vitals = { hr: 128, spo2: 94, rr: 22, etco2: 34, temp: 38.4, sys: 96, dia: 58, map: 71 }
    this.alarm = 'normal' // normal | caution | critical
    this.species = 'Canine'
    this.weight = '10-23 kg'
    this.traces = LANES.map((l) => ({ ...l, buf: new Float32Array(Math.ceil(W * 0.62)), phase: 0 }))
    this.cursor = 0
    this.elapsed = 0
    this.blink = 0
    this._raf = null
    this._last = 0
    this.onFrame = null
  }

  setVitals(v) { Object.assign(this.vitals, v) }
  setAlarm(level) { this.alarm = level }

  start() {
    if (this._raf) return
    this._last = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - this._last) / 1000, 0.05)
      this._last = now
      this.step(dt)
      this.draw()
      if (this.onFrame) this.onFrame()
      this._raf = requestAnimationFrame(loop)
    }
    this._raf = requestAnimationFrame(loop)
  }

  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null }

  /** Advance the sweep. Separated from draw() so a headless test can step it. */
  step(dt) {
    this.elapsed += dt
    this.blink = (this.blink + dt) % 1
    const traceW = this.traces[0].buf.length
    const advance = SWEEP_PX_PER_SEC * dt
    const start = this.cursor
    const end = start + advance
    for (const t of this.traces) {
      const hz = (t.rate === 'rr' ? this.vitals.rr : this.vitals.hr) / 60
      for (let x = Math.floor(start); x < end; x++) {
        const i = ((x % traceW) + traceW) % traceW
        t.phase = (t.phase + (hz * dt) / Math.max(advance, 0.0001)) % 1
        t.buf[i] = t.gen(t.phase)
      }
    }
    this.cursor = end % traceW
  }

  draw() {
    const c = this.ctx
    const crit = this.alarm === 'critical'
    const caution = this.alarm === 'caution'
    const flashOn = this.blink < 0.5

    c.fillStyle = '#05080d'
    c.fillRect(0, 0, W, H)

    // ── LED alarm strip (device chrome, part of the alarm layer) ──
    c.fillStyle = crit ? (flashOn ? '#FF2A1F' : '#3a0d0a')
      : caution ? (flashOn ? '#FFCC00' : '#3a3208') : '#12202b'
    c.fillRect(0, 0, W, 10)

    // ── header strip: species / weight / clock ──
    c.fillStyle = '#0b1219'
    c.fillRect(0, 10, W, 34)
    c.font = '15px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#9fb3c2'
    c.textAlign = 'left'
    c.fillText(`Weight ${this.weight}`, 16, 33)
    c.fillText(this.species, 190, 33)
    const t = this.elapsed
    const clock = `${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`
    c.fillText(clock, 300, 33)
    c.textAlign = 'right'
    c.fillStyle = '#5f7382'
    c.fillText('VET MONITOR · VM-12', W - 16, 33)

    // ── waveform lanes (left ~62%) ──
    const traceW = this.traces[0].buf.length
    let y = 56
    for (const t of this.traces) {
      const ch = CHANNELS[t.ch || t.key]
      const mid = y + t.h / 2
      const amp = t.h * 0.40

      c.strokeStyle = ch.color
      c.lineWidth = 1.9
      c.lineJoin = 'round'
      c.beginPath()
      let pen = false
      for (let x = 0; x < traceW; x++) {
        // blanking gap ahead of the sweep cursor — this is what makes it read
        // as a real monitor rather than a scrolling chart.
        const ahead = (x - this.cursor + traceW) % traceW
        if (ahead < BLANK_PX) { pen = false; continue }
        const py = mid - t.buf[x] * amp
        if (!pen) { c.moveTo(x, py); pen = true } else { c.lineTo(x, py) }
      }
      c.stroke()

      c.font = '13px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = ch.color
      c.textAlign = 'left'
      c.fillText(t.label || ch.label, 10, y + 17)
      if (t.gain) { c.fillStyle = '#4d6373'; c.fillText(t.gain, 60, y + 17) }

      y += t.h
    }

    // ── numeric column (right ~38%) ──
    const nx = traceW + 26
    c.textAlign = 'left'
    const big = (label, val, color, sub, yy, unit) => {
      c.font = '14px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = color
      c.fillText(label, nx, yy)
      const alarming = (crit || caution) && (label === 'HR' || label === 'SpO₂')
      c.font = 'bold 62px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = alarming && !flashOn ? '#3c4a55' : color
      c.fillText(String(val), nx, yy + 58)
      if (unit) {
        c.font = '13px ui-sans-serif, system-ui, sans-serif'
        c.fillStyle = color
        c.fillText(unit, nx + 118, yy + 58)
      }
      if (sub) {
        c.font = '12px ui-sans-serif, system-ui, sans-serif'
        c.fillStyle = '#5f7382'
        c.fillText(sub, nx, yy + 76)
      }
    }
    big('HR', this.vitals.hr, CHANNELS.ecg.color, 'PVCs 0    ST OFF', 74, 'bpm')
    big('SpO₂', this.vitals.spo2, CHANNELS.pleth.color, 'PI 12.0   Source SpO₂', 190, '%')
    big('Art', `${this.vitals.sys}/${this.vitals.dia}`, CHANNELS.art.color, `(${this.vitals.map}) mmHg`, 306, '')
    big('EtCO₂', this.vitals.etco2, CHANNELS.co2.color, `awRR ${this.vitals.rr}`, 422, 'mmHg')

    // ── bottom band: Temp / NIBP (white channels) ──
    c.fillStyle = '#0b1219'
    c.fillRect(0, H - 96, W, 96)
    c.font = '14px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#9fb3c2'
    c.fillText('Temp  °C', 16, H - 68)
    c.font = 'bold 40px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#FFFFFF'
    c.fillText(this.vitals.temp.toFixed(1), 16, H - 26)

    c.font = '14px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#9fb3c2'
    c.fillText('NIBP  mmHg', 220, H - 68)
    c.font = 'bold 40px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#FFFFFF'
    c.fillText(`${this.vitals.sys}/${this.vitals.dia}`, 220, H - 26)
    c.font = '13px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#5f7382'
    c.fillText(`(${this.vitals.map})`, 372, H - 26)

    c.textAlign = 'right'
    c.font = '13px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#7d94a4'
    c.fillText('Alarm Setup     Main Menu', W - 16, H - 26)
    c.textAlign = 'left'

    // ── full-screen alarm frame: the one signal allowed to cross zones ──
    if (crit || caution) {
      c.strokeStyle = crit ? (flashOn ? '#FF2A1F' : '#5a1410') : (flashOn ? '#FFCC00' : '#4a3f0a')
      c.lineWidth = 6
      c.strokeRect(3, 3, W - 6, H - 6)
    }
  }
}
