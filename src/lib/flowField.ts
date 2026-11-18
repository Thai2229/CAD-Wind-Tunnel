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

export function surfacePressureCoefficient(normal: Vec3, windDir: Vec3): number {
  const nl = Math.hypot(...normal)
  const wl = Math.hypot(...windDir)
  if (nl === 0 || wl === 0) return 0
  const cos = (normal[0] * windDir[0] + normal[1] * windDir[1] + normal[2] * windDir[2]) / (nl * wl)
  return 1 - 2.25 * (1 - cos * cos)
}
