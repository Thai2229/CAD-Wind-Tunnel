import { useEffect, useMemo, type ReactNode } from 'react'
import { ArrowHelper, CanvasTexture, DoubleSide, Vector3 } from 'three'
import { Edges, Grid } from '@react-three/drei'
import { SECTION, TURNTABLE_RADIUS, TURNTABLE_TOP } from '../lib/tunnel'

const { L, W, H } = SECTION
const CONE = 2.5

type Props = { yaw: number; children?: ReactNode }

export function TestSection({ yaw, children }: Props) {
  const arrow = useMemo(
    () => new ArrowHelper(new Vector3(1, 0, 0), new Vector3(-L / 2 + 1, H + 0.6, 0), 3.5, 0xffb347, 0.6, 0.3),
    [],
  )
  const label = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.font = '600 32px ui-monospace, Consolas, monospace'
    g.fillStyle = '#ffb347'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('WIND  +X', 128, 32)
    return new CanvasTexture(c)
  }, [])
  useEffect(() => () => arrow.dispose(), [arrow])
  useEffect(() => () => label.dispose(), [label])
  const coneR = (W / 2) * Math.SQRT2

  return (
    <group>
      {/* floor */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[L, 0.1, W]} />
        <meshStandardMaterial color="#0c1015" roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0.003, 0]}
        args={[L, W]}
        cellSize={0.5}
        cellColor="#1d2733"
        sectionSize={2.5}
        sectionColor="#2c3b4c"
        sectionThickness={1}
        fadeDistance={40}
      />

      {/* glass walls and ceiling */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[L, H, W]} />
        <meshBasicMaterial color="#7fb2d6" transparent opacity={0.035} depthWrite={false} />
        <Edges threshold={15} color="#4f7896" />
      </mesh>

      {/* contraction cone hint upstream */}
      <group position={[-L / 2 - CONE / 2, H / 2, 0]} rotation={[0, 0, Math.PI / 2]} scale={[H / W, 1, 1]}>
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <cylinderGeometry args={[coneR * 1.6, coneR, CONE, 4, 1, true]} />
          <meshBasicMaterial color="#7fb2d6" transparent opacity={0.025} depthWrite={false} side={DoubleSide} />
          <Edges threshold={15} color="#2f4a5f" />
        </mesh>
      </group>

      {/* turntable and its payload rotate together */}
      <group rotation={[0, yaw, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[TURNTABLE_RADIUS, TURNTABLE_RADIUS, 0.08, 64]} />
          <meshStandardMaterial color="#222c37" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[TURNTABLE_RADIUS - 0.12, 0.085, 0]}>
          <boxGeometry args={[0.2, 0.02, 0.06]} />
          <meshBasicMaterial color="#ffb347" />
        </mesh>
        <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[TURNTABLE_RADIUS - 0.06, TURNTABLE_RADIUS - 0.03, 64]} />
          <meshBasicMaterial color="#4f7896" />
        </mesh>
        <group position={[0, TURNTABLE_TOP, 0]}>{children}</group>
      </group>

      {/* wind direction */}
      <primitive object={arrow} />
      <sprite position={[-L / 2 + 2.5, H + 1.2, 0]} scale={[3, 0.75, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}
