import { useEffect } from 'react'
import { DoubleSide } from 'three'
import { applyPressureColors } from '../lib/cpColor'
import type { LoadedModel } from '../lib/loadModel'

const COLOR: Record<string, string> = { true: '#ffffff', false: '#aab4be' }

type Props = { model: LoadedModel; yaw: number; showPressure: boolean }

export function ModelMesh({ model, yaw, showPressure }: Props) {
  useEffect(() => {
    if (!showPressure) return
    for (const g of model.geometries) applyPressureColors(g, yaw)
  }, [model, yaw, showPressure])

  useEffect(() => {
    const geometries = model.geometries
    return () => {
      for (const g of geometries) g.dispose()
    }
  }, [model])

  return (
    <>
      {model.geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial
            key={String(showPressure)}
            color={COLOR[String(showPressure)]}
            vertexColors={showPressure}
            roughness={0.55}
            metalness={0.25}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </>
  )
}
