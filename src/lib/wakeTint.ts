// Particle colour for the visual wake: near-white in clear air, warm amber (the app accent) deep in the wake.
export const WAKE_TINT_BASE = [0.839, 0.925, 1] as const
export const WAKE_TINT_AMBER = [1, 0.702, 0.278] as const

// full amber from factor 1 / TINT_GAIN; a gain of 3 keeps the thin outer plume visibly amber
const TINT_GAIN = 3

export function wakeTint(factor: number, out: [number, number, number]): [number, number, number] {
  const t = Math.min(1, Math.max(0, factor * TINT_GAIN))
  out[0] = WAKE_TINT_BASE[0] + (WAKE_TINT_AMBER[0] - WAKE_TINT_BASE[0]) * t
  out[1] = WAKE_TINT_BASE[1] + (WAKE_TINT_AMBER[1] - WAKE_TINT_BASE[1]) * t
  out[2] = WAKE_TINT_BASE[2] + (WAKE_TINT_AMBER[2] - WAKE_TINT_BASE[2]) * t
  return out
}
