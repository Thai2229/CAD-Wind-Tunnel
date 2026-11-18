import { useEffect } from 'react'
import { Vector3 } from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Obstacle } from '../lib/flowField'
import type { LoadedModel } from '../lib/loadModel'
import { SECTION } from '../lib/tunnel'
import { TestSection } from './TestSection'
import { ModelMesh } from './ModelMesh'
import { Streamlines } from './Streamlines'
import { Particles } from './Particles'

type Props = {
  model: LoadedModel | null
  obstacle: Obstacle
  speed: number
  yaw: number
  showStreamlines: boolean
  showParticles: boolean
  showPressure: boolean
}

const BASE_POSITION = new Vector3(9, 8, 19)

// Pull the camera back on narrow viewports so the whole section stays in frame.
function FitCamera() {
  const camera = useThree((s) => s.camera)
  const narrow = useThree((s) => s.size.width < s.size.height)
  useEffect(() => {
    const base = BASE_POSITION.clone()
    if (narrow) base.multiplyScalar(1.9)
    camera.position.copy(base)
  }, [camera, narrow])
  return null
}

export function TunnelScene(props: Props) {
  return (
    <Canvas camera={{ position: BASE_POSITION.toArray(), fov: 40 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#090c10']} />
      <hemisphereLight args={['#bcd6ee', '#10151b', 0.9]} />
      <directionalLight position={[-4, 9, 6]} intensity={1.6} />
      <TestSection yaw={props.yaw}>
        {props.model && (
          <ModelMesh model={props.model} yaw={props.yaw} showPressure={props.showPressure} />
        )}
      </TestSection>
      {props.showStreamlines && <Streamlines obstacle={props.obstacle} />}
      {props.showParticles && <Particles obstacle={props.obstacle} speed={props.speed} />}
      <OrbitControls target={[0, SECTION.H / 2 - 0.5, 0]} maxPolarAngle={Math.PI * 0.49} minDistance={4} maxDistance={50} />
      <FitCamera />
    </Canvas>
  )
}
