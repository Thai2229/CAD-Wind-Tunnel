import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { velocityAt, type Obstacle, type Vec3 } from '../lib/flowField'
import { SECTION } from '../lib/tunnel'

const { L, W, H } = SECTION
const STEP = 0.1
const MAX_STEPS = 400

function direction(p: Vec3, o: Obstacle): { dir: Vec3; ratio: number } | null {
  const v = velocityAt(p, o, 1)
  const s = Math.hypot(...v)
  if (!Number.isFinite(s) || s < 1e-4) return null
  return { dir: [v[0] / s, v[1] / s, v[2] / s], ratio: s }
}

function buildGeometry(o: Obstacle): BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  for (let iy = 0; iy < 6; iy++) {
    for (let iz = 0; iz < 8; iz++) {
      let p: Vec3 = [-L / 2, 0.35 + (iy / 5) * (H - 0.7), ((iz / 7) * 2 - 1) * (W / 2 - 0.4)]
      for (let i = 0; i < MAX_STEPS && p[0] < L / 2; i++) {
        const a = direction(p, o)
        if (!a) break
        // RK2 (midpoint) with a fixed arc-length step
        const mid: Vec3 = [p[0] + (a.dir[0] * STEP) / 2, p[1] + (a.dir[1] * STEP) / 2, p[2] + (a.dir[2] * STEP) / 2]
        const b = direction(mid, o)
        if (!b) break
        const next: Vec3 = [p[0] + b.dir[0] * STEP, p[1] + b.dir[1] * STEP, p[2] + b.dir[2] * STEP]
        if (!next.every(Number.isFinite) || next[1] < 0.02 || next[1] > H - 0.02) break
        // tint by local speed: slow = cool blue, fast = warm white
        const t = Math.min(1, Math.max(0, (b.ratio - 0.5) / 1))
        pos.push(...p, ...next)
        const c = [0.45 + 0.55 * t, 0.65 + 0.2 * t, 0.9 - 0.2 * t]
        col.push(...c, ...c)
        p = next
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  return g
}

export function Streamlines({ obstacle }: { obstacle: Obstacle }) {
  const geometry = useMemo(() => buildGeometry(obstacle), [obstacle])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.4} depthWrite={false} />
    </lineSegments>
  )
}
