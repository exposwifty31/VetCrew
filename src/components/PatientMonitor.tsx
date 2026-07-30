import { useEffect, useRef } from "react";

import { MonitorRenderer, type AlarmLevel, type MonitorVitals } from "../monitor/renderer.js";

/**
 * React shell around the framework-free MonitorRenderer. Owns only the canvas
 * lifecycle — no simulation logic lives here (CLAUDE.md §8).
 *
 * a11y: the canvas is decorative. Every value it draws is also rendered as
 * text by the numeric tiles beneath it, which stay the accessible source of
 * truth, so the canvas is aria-hidden rather than given a synthetic label.
 *
 * Motion: `prefers-reduced-motion` stops the sweep and paints a single frame.
 */

type Props = {
  readonly vitals: MonitorVitals;
  readonly species?: string | null;
  /** Severity is passed in explicitly; the renderer never derives it. */
  readonly alarm?: AlarmLevel;
  /** Paused/disconnected — freeze the sweep so stale never animates as live. */
  readonly frozen?: boolean;
};

export function PatientMonitor({ vitals, species, alarm = "normal", frozen = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<MonitorRenderer | null>(null);
  /** True when no rAF loop is running, so nothing else will repaint. */
  const staticModeRef = useRef(false);

  // Keep the renderer fed without restarting the animation loop.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer === null) return;
    renderer.setVitals(vitals);
    renderer.setAlarm(alarm);
    renderer.setSpecies(species ?? "");
    // With no loop to pick these up, feeding alone would leave the canvas
    // frozen on the first frame for the rest of a live reduced-motion session
    // while the numeric tiles kept updating. Repaint once instead.
    if (staticModeRef.current) renderer.draw();
  }, [vitals, alarm, species]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    let renderer: MonitorRenderer;
    try {
      renderer = new MonitorRenderer(canvas);
    } catch {
      return; // no 2d context (jsdom, ancient browser) — tiles still render
    }
    rendererRef.current = renderer;
    renderer.setVitals(vitals);
    renderer.setAlarm(alarm);
    renderer.setSpecies(species ?? "");

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || frozen) {
      staticModeRef.current = true;
      // One static frame: shapes and channel identity without the sweep. Later
      // prop changes repaint via the effect above.
      renderer.step(2.4);
      renderer.draw();
      return () => {
        rendererRef.current = null;
      };
    }
    staticModeRef.current = false;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      renderer.step(dt);
      renderer.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      rendererRef.current = null;
    };
    // Deliberately keyed on `frozen` alone: restarting on every vitals tick
    // would reset the sweep cursor. The effect above feeds the live renderer.
  }, [frozen]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: "1024 / 768",
        borderRadius: 12,
        border: "1px solid var(--inst-bezel-edge, #243040)",
        background: "#05080d",
      }}
    />
  );
}
