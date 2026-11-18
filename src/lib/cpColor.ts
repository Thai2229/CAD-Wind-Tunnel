import { Vector3, type BufferGeometry } from 'three'
import { surfacePressureCoefficient } from './flowField'

export const CP_MIN = -1.25
export const CP_MAX = 1

const BLUE = [0.1, 0.35, 1]
const MID = [0.85, 0.95, 0.82]
const RED = [0.95, 0.15, 0.1]

// Diverging scale: blue (-1.25) -> pale green-white (0) -> red (1).
export function cpColor(cp: number): [number, number, number] {
  let from = MID
  let to = RED
  let t = Math.min(1, Math.max(0, cp / CP_MAX))
  if (cp < 0) {
    from = BLUE
    to = MID
    t = Math.min(1, Math.max(0, (cp - CP_MIN) / -CP_MIN))
  }
  return [
    from[0]! + (to[0]! - from[0]!) * t,
    from[1]! + (to[1]! - from[1]!) * t,
    from[2]! + (to[2]! - from[2]!) * t,
  ]
}

const AXIS_Y = new Vector3(0, 1, 0)
const n = new Vector3()

// Writes per-vertex Cp colors for a geometry rotated by yaw (radians) about Y.
export function applyPressureColors(geometry: BufferGeometry, yaw: number) {
  const normal = geometry.getAttribute('normal')
  const color = geometry.getAttribute('color')
  if (!normal || !color) return
  for (let i = 0; i < normal.count; i++) {
    n.fromBufferAttribute(normal, i).applyAxisAngle(AXIS_Y, yaw)
    const c = cpColor(surfacePressureCoefficient([n.x, n.y, n.z], [1, 0, 0]))
    color.setXYZ(i, c[0], c[1], c[2])
  }
  color.needsUpdate = true
}
