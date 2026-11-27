import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { applyWake, velocityAt, wakeFactor, type Obstacle, type Vec3 } from '../lib/flowField'
import { aimedSpawn } from '../lib/aimedSpawn'
import { SECTION } from '../lib/tunnel'
import { WAKE_TINT_BASE, wakeTint } from '../lib/wakeTint'

const { L, W, H } = SECTION
const COUNT = 3000

// Half of the new particles are aimed at the model's cross-section (like a smoke rake), so the wake behind it is well populated.
const AIMED_SHARE = 0.5
const UNAIMED: Obstacle = { center: [0, -100, 0], halfExtents: [0, 0, 0] }

const yz: [number, number] = [0, 0]

function spawn(a: Float32Array, i: number, anywhere: boolean, o: Obstacle) {
  let span = 0.03
  if (anywhere) span = 1
  a[i * 3] = -L / 2 + Math.random() * L * span
  a[i * 3 + 1] = 0.1 + Math.random() * (H - 0.2)
  a[i * 3 + 2] = (Math.random() * 2 - 1) * (W / 2 - 0.1)
  // an absent model sits far below the floor
  if (o.center[1] > 0 && Math.random() < AIMED_SHARE) {
    aimedSpawn(o, { width: W, height: H }, Math.random(), Math.random(), yz)
    a[i * 3 + 1] = yz[0]
    a[i * 3 + 2] = yz[1]
  }
}

// fixed table of random offsets in [-1, 1], read with a per-frame shift so the wake jitter changes every frame without Math.random
const JITTER_SIZE = 4096
const jitter = new Float32Array(JITTER_SIZE * 3)
for (let i = 0; i < jitter.length; i++) jitter[i] = Math.random() * 2 - 1
let frame = 0

// scratch vectors reused every frame
const p: Vec3 = [0, 0, 0]
const v: Vec3 = [0, 0, 0]
const rgb: [number, number, number] = [0, 0, 0]

type Props = { obstacle: Obstacle; speed: number }

export function Particles({ obstacle, speed }: Props) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) spawn(positions, i, true, UNAIMED)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    const colors = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      colors[i * 3] = WAKE_TINT_BASE[0] ** 2
      colors[i * 3 + 1] = WAKE_TINT_BASE[1] ** 2
      colors[i * 3 + 2] = WAKE_TINT_BASE[2] ** 2
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return geometry
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  // true while particle colours may still carry wake tint
  const tinted = useRef(false)

  useFrame((_, delta) => {
    // visual speed is clamped: 0 stays still, 60 m/s is ~8 units/s
    const vis = (Math.min(speed, 60) / 60) * 8
    if (vis === 0) return
    const dt = Math.min(delta, 0.05)
    const positions = geometry.getAttribute('position').array as Float32Array
    const colors = geometry.getAttribute('color').array as Float32Array
    frame = (frame + 97) % JITTER_SIZE
    // no model: the obstacle is a far-away sentinel, so skip all wake work (and clear any old tint once)
    const hasModel = obstacle.center[1] > 0
    if (!hasModel && tinted.current) {
      for (let i = 0; i < COUNT; i++) {
        colors[i * 3] = WAKE_TINT_BASE[0] ** 2
        colors[i * 3 + 1] = WAKE_TINT_BASE[1] ** 2
        colors[i * 3 + 2] = WAKE_TINT_BASE[2] ** 2
      }
      tinted.current = false
    }
    if (hasModel) tinted.current = true
    for (let i = 0; i < COUNT; i++) {
      p[0] = positions[i * 3]!
      p[1] = positions[i * 3 + 1]!
      p[2] = positions[i * 3 + 2]!
      velocityAt(p, obstacle, vis, v)
      let wake = 0
      if (hasModel) {
        wake = wakeFactor(p, obstacle)
        wakeTint(wake, rgb)
        // vertex colours are linear; squaring is a cheap sRGB to linear approximation
        colors[i * 3] = rgb[0] * rgb[0]
        colors[i * 3 + 1] = rgb[1] * rgb[1]
        colors[i * 3 + 2] = rgb[2] * rgb[2]
        applyWake(v, wake, v)
      }
      const s = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
      if (wake > 0.01) {
        // turbulent look: random kick scaled by how deep in the wake the particle is
        const j = ((i * 7 + frame) % JITTER_SIZE) * 3
        const k = wake * 0.5 * s
        v[0] += jitter[j]! * k
        v[1] += jitter[j + 1]! * k
        v[2] += jitter[j + 2]! * k
      }
      const x = p[0] + v[0] * dt
      const y = p[1] + v[1] * dt
      const z = p[2] + v[2] * dt
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      if (!Number.isFinite(x + y + z + s) || x > L / 2 || s < 0.05 * vis || y < 0.02 || y > H - 0.02) {
        spawn(positions, i, false, obstacle)
      }
    }
    geometry.getAttribute('position').needsUpdate = true
    geometry.getAttribute('color').needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#ffffff" vertexColors size={0.07} transparent opacity={0.75} depthWrite={false} />
    </points>
  )
}
