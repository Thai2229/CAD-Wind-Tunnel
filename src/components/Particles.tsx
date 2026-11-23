import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { velocityAt, type Obstacle, type Vec3 } from '../lib/flowField'
import { SECTION } from '../lib/tunnel'

const { L, W, H } = SECTION
const COUNT = 3000

function spawn(a: Float32Array, i: number, anywhere: boolean) {
  let span = 0.03
  if (anywhere) span = 1
  a[i * 3] = -L / 2 + Math.random() * L * span
  a[i * 3 + 1] = 0.1 + Math.random() * (H - 0.2)
  a[i * 3 + 2] = (Math.random() * 2 - 1) * (W / 2 - 0.1)
}

// scratch vectors reused every frame
const p: Vec3 = [0, 0, 0]
const v: Vec3 = [0, 0, 0]

type Props = { obstacle: Obstacle; speed: number }

export function Particles({ obstacle, speed }: Props) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) spawn(positions, i, true)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return geometry
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    // visual speed is clamped: 0 stays still, 60 m/s is ~8 units/s
    const vis = (Math.min(speed, 60) / 60) * 8
    if (vis === 0) return
    const dt = Math.min(delta, 0.05)
    const positions = geometry.getAttribute('position').array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      p[0] = positions[i * 3]!
      p[1] = positions[i * 3 + 1]!
      p[2] = positions[i * 3 + 2]!
      velocityAt(p, obstacle, vis, v)
      const s = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
      const x = p[0] + v[0] * dt
      const y = p[1] + v[1] * dt
      const z = p[2] + v[2] * dt
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      if (!Number.isFinite(x + y + z + s) || x > L / 2 || s < 0.05 * vis || y < 0.02 || y > H - 0.02) {
        spawn(positions, i, false)
      }
    }
    geometry.getAttribute('position').needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#d6ecff" size={0.07} transparent opacity={0.75} depthWrite={false} />
    </points>
  )
}
