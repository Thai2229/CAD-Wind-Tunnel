import type { Obstacle } from './flowField'

const MARGIN = 0.1
const REACH = 1.6

// Picks lo + r * (hi - lo); an empty aimed range falls back to the whole allowed range so values never pile up on one edge.
function pick(center: number, half: number, allowedLo: number, allowedHi: number, r: number): number {
  let lo = Math.max(allowedLo, center - REACH * half)
  let hi = Math.min(allowedHi, center + REACH * half)
  if (lo >= hi) {
    lo = allowedLo
    hi = allowedHi
  }
  return lo + r * (hi - lo)
}

// Y/Z spawn point aimed at the model's cross-section, always inside the section (floor, ceiling and side walls).
// r1 and r2 are random numbers in [0, 1] for y and z.
export function aimedSpawn(
  o: Obstacle,
  bounds: { width: number; height: number },
  r1: number,
  r2: number,
  out: [number, number],
): [number, number] {
  const zMax = bounds.width / 2 - MARGIN
  out[0] = pick(o.center[1], o.halfExtents[1], MARGIN, bounds.height - MARGIN, r1)
  out[1] = pick(o.center[2], o.halfExtents[2], -zMax, zMax, r2)
  return out
}
