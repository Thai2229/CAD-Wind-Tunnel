export type Vec3 = [number, number, number]

export type Obstacle = { center: Vec3; halfExtents: Vec3 }

export function velocityAt(point: Vec3, obstacle: Obstacle, freestream: number, out?: Vec3): Vec3 {
  const o = out || [0, 0, 0]
  // clamp so a flat (zero-thickness) model stays finite
  const e = obstacle.halfExtents
  const minH = Math.max(1e-3 * Math.max(e[0], e[1], e[2]), 1e-6)
  const hx = Math.max(e[0], minH)
  const hy = Math.max(e[1], minH)
  const hz = Math.max(e[2], minH)
  const x = (point[0] - obstacle.center[0]) / hx
  const y = (point[1] - obstacle.center[1]) / hy
  const z = (point[2] - obstacle.center[2]) / hz
  const r2 = x * x + y * y + z * z
  if (r2 < 1) {
    o[0] = 0
    o[1] = 0
    o[2] = 0
    return o
  }
  const r = Math.sqrt(r2)
  const a = 1 / (2 * r * r * r)
  const b = 3 / (2 * r2 * r2 * r)
  // unit-sphere potential flow, then scaled back so the far field stays [U, 0, 0]
  o[0] = freestream * (1 + a - b * x * x)
  o[1] = freestream * (-b * x * y) * (hy / hx)
  o[2] = freestream * (-b * x * z) * (hz / hx)
  return o
}

export function pressureCoefficient(speed: number, freestream: number): number {
  if (freestream === 0) return 0
  return 1 - (speed / freestream) ** 2
}

export const SEPARATION_START_DEG = 80
export const SEPARATION_END_DEG = 100
export const BASE_CP = -0.4
export const WAKE_DEFICIT = 0.6

const SEP_START_COS = Math.cos((SEPARATION_START_DEG * Math.PI) / 180)
const SEP_END_COS = Math.cos((SEPARATION_END_DEG * Math.PI) / 180)

// Cp from the cosine of the angle between a face normal and the upwind direction.
// Potential flow up to the separation angle, then a smoothstep blend to a constant base suction (separated flow).
// No allocations, so the per-vertex pressure colouring can call it directly.
export function cpFromUpwindCos(cosUp: number): number {
  const c = Math.min(1, Math.max(-1, cosUp))
  const potential = 1 - 2.25 * (1 - c * c)
  if (c >= SEP_START_COS) return potential
  if (c <= SEP_END_COS) return BASE_CP
  const deg = (Math.acos(c) * 180) / Math.PI
  const t = (deg - SEPARATION_START_DEG) / (SEPARATION_END_DEG - SEPARATION_START_DEG)
  const smooth = t * t * (3 - 2 * t)
  return potential + (BASE_CP - potential) * smooth
}

export function surfacePressureCoefficient(normal: Vec3, windDir: Vec3): number {
  const nl = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
  const wl = Math.sqrt(windDir[0] * windDir[0] + windDir[1] * windDir[1] + windDir[2] * windDir[2])
  if (nl === 0 || wl === 0) return 0
  const cos = (normal[0] * windDir[0] + normal[1] * windDir[1] + normal[2] * windDir[2]) / (nl * wl)
  return cpFromUpwindCos(-cos)
}

// Visual wake behind the obstacle (wind along +X): 1 just behind the rear, fading with distance and sideways.
// Not physics, only plausibility. Scalar math, no allocations.
export function wakeFactor(point: Vec3, obstacle: Obstacle): number {
  const e = obstacle.halfExtents
  const minH = Math.max(1e-3 * Math.max(e[0], e[1], e[2]), 1e-6)
  const hx = Math.max(e[0], minH)
  const hy = Math.max(e[1], minH)
  const hz = Math.max(e[2], minH)
  const d = point[0] - (obstacle.center[0] + hx)
  if (!(d > 0)) return 0
  const dy = (point[1] - obstacle.center[1]) / (hy + 0.15 * d)
  const dz = (point[2] - obstacle.center[2]) / (hz + 0.15 * d)
  return Math.exp(-2 * (dy * dy + dz * dz)) / (1 + d / (3 * hx))
}

export function applyWake(v: Vec3, factor: number, out?: Vec3): Vec3 {
  const o = out || [0, 0, 0]
  const k = 1 - WAKE_DEFICIT * Math.min(1, Math.max(0, factor))
  o[0] = v[0] * k
  o[1] = v[1] * k
  o[2] = v[2] * k
  return o
}
