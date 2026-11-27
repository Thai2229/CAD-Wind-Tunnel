import type { BufferGeometry } from 'three'
import { cpFromUpwindCos } from './flowField'

export const CP_MIN = -1.25
export const CP_MAX = 1

const BLUE = [0.1, 0.35, 1] as const
const MID = [0.85, 0.95, 0.82] as const
const RED = [0.95, 0.15, 0.1] as const

// Diverging scale: blue (-1.25) -> pale green-white (0) -> red (1).
export function cpColor(cp: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  let from: readonly number[] = MID
  let to: readonly number[] = RED
  let t = Math.min(1, Math.max(0, cp / CP_MAX))
  if (cp < 0) {
    from = BLUE
    to = MID
    t = Math.min(1, Math.max(0, (cp - CP_MIN) / -CP_MIN))
  }
  out[0] = from[0]! + (to[0]! - from[0]!) * t
  out[1] = from[1]! + (to[1]! - from[1]!) * t
  out[2] = from[2]! + (to[2]! - from[2]!) * t
  return out
}

const rgb: [number, number, number] = [0, 0, 0]

// Writes per-vertex Cp colors for a geometry rotated by yaw (radians) about Y.
// Wind is +X, so cos(angle) is the rotated normal's x component: nx*cos(yaw) + nz*sin(yaw).
// Same Cp as surfacePressureCoefficient (shared cpFromUpwindCos), without per-vertex allocations.
export function applyPressureColors(geometry: BufferGeometry, yaw: number) {
  const normal = geometry.getAttribute('normal')
  const color = geometry.getAttribute('color')
  if (!normal || !color) return
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i)
    const ny = normal.getY(i)
    const nz = normal.getZ(i)
    const len2 = nx * nx + ny * ny + nz * nz
    let cp = 0
    if (len2 > 0) {
      const wx = nx * c + nz * s
      cp = cpFromUpwindCos(-wx / Math.sqrt(len2))
    }
    cpColor(cp, rgb)
    color.setXYZ(i, rgb[0], rgb[1], rgb[2])
  }
  color.needsUpdate = true
}
