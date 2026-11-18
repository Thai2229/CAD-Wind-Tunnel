export type Vec3 = [number, number, number]

export type Obstacle = { center: Vec3; halfExtents: Vec3 }

export function velocityAt(_point: Vec3, _obstacle: Obstacle, _freestream: number): Vec3 {
  throw new Error('not implemented')
}

export function pressureCoefficient(_speed: number, _freestream: number): number {
  throw new Error('not implemented')
}

export function surfacePressureCoefficient(_normal: Vec3, _windDir: Vec3): number {
  throw new Error('not implemented')
}
