import { useEffect } from 'react'
import { applyPressureColors } from '../lib/cpColor'
import type { LoadedModel } from '../lib/loadModel'

type Props = { model: LoadedModel; yaw: number; showPressure: boolean }

export function ModelMesh({ model, yaw, showPressure }: Props) {
  useEffect(() => {
    for (const g of model.geometries) applyPressureColors(g, yaw)
  }, [model, yaw])

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
            color={showPressure && '#ffffff' || '#aab4be'}
            vertexColors={showPressure}
            roughness={0.55}
            metalness={0.25}
            side={2}
          />
        </mesh>
      ))}
    </>
  )
}
