import * as React from "react";

export type MonitorAlarm = "normal" | "caution" | "critical";
/** Channels shown in the base-rung config. NOTE: invasive arterial ("art") was
 *  removed — the base-rung patient has no arterial line, and an Art readout
 *  duplicated NIBP while colliding with it visually. */
export type ChannelKey = "hr" | "spo2" | "etco2" | "resp";

export interface MonitorPatient {
  species: "dog" | "cat";
  breed?: string;
  weightKg?: number;
  /** Weight band shown in the header (e.g. "18–30 kg"). */
  weightRange?: string;
  name?: string;
}

export interface MonitorChannels {
  hr?: number;
  spo2?: number;
  etco2?: number;
  resp?: number;
}

export interface PatientMonitorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  patient?: MonitorPatient;
  channels?: MonitorChannels;
  /** Secondary readouts: { pvcs, st, pr, pi, awrr, fi }. Auto-hidden when a
   *  value block is too short to show them without colliding. */
  sub?: Record<string, string | number>;
  temp?: { t1?: number; t2?: number };
  co?: { value?: number; ci?: string; tb?: number };
  /** Non-invasive BP — the only blood-pressure readout on this device config. */
  nibp?: { sys?: number; dia?: number; map?: number; time?: string; pr?: number };
  /** Overall alarm state (Layer B) — drives LED strip + full-screen frame. */
  alarm?: MonitorAlarm;
  /** Which channels are individually alarming (drives per-number flash). */
  alarming?: ChannelKey[];
  muted?: boolean;
  /** Sweep rate multiplier (1 = real-time). */
  sweepSpeed?: number;
  clock?: string;
  onToggleMute?: () => void;
  onFreeze?: () => void;
  onNibp?: () => void;
  onMenu?: () => void;
  onAlarmSetup?: () => void;
}

/**
 * uMEC12-Vet-style patient monitor with true sweep-rendered waveforms.
 * @startingPoint section="Instrument" subtitle="Sweep-rendered patient monitor — 5 lanes, channel colours, alarm states" viewport="1040x560"
 */
export function PatientMonitor(props: PatientMonitorProps): JSX.Element;
