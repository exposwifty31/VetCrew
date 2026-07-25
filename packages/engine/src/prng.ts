/**
 * Seeded PRNG (mulberry32). Pure: state in, state out — never hidden.
 * The PRNG state lives inside EngineState so replay from the event log
 * reproduces every draw exactly (CLAUDE.md §3 determinism rules).
 */

export interface PrngDraw {
  readonly state: number;
  /** Uniform float in [0, 1). */
  readonly value: number;
}

export function prngInit(seed: number): number {
  // Force to u32; a zero seed is valid for mulberry32.
  return seed >>> 0;
}

export function prngNext(state: number): PrngDraw {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: next, value };
}
