import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { velocityAt, type Obstacle } from '../lib/flowField'
import { SECTION } from '../lib/tunnel'

const { L, W, H } = SECTION
const COUNT = 3000

function spawn(a: Float32Array, i: number, anywhere: boolean) {
  a[i * 3] = -L / 2 + Math.random() * (L * (anywhere && 1 || 0.03))
  a[i * 3 + 1] = 0.1 + Math.random() * (H - 0.2)
  a[i * 3 + 2] = (Math.random() * 2 - 1) * (W / 2 - 0.1)
}

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
      const v = velocityAt([positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!], obstacle, vis)
      const s = Math.hypot(...v)
      positions[i * 3] += v[0] * dt
      positions[i * 3 + 1] += v[1] * dt
      positions[i * 3 + 2] += v[2] * dt
      const x = positions[i * 3]!
      const y = positions[i * 3 + 1]!
      if (x > L / 2 || s < 0.05 * vis || y < 0.02 || y > H - 0.02) spawn(positions, i, false)
    }
    geometry.getAttribute('position').needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#d6ecff" size={0.07} transparent opacity={0.75} depthWrite={false} />
    </points>
  )
}
