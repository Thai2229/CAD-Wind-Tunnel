import type { Vec3 } from './flowField'

export const AIR_DENSITY = 1.225

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in'

export function unitToMeters(_unit: LengthUnit): number {
  throw new Error('not implemented')
}

export function dynamicPressure(_speed: number, _density: number = AIR_DENSITY): number {
  throw new Error('not implemented')
}

export function dragForce(_opts: {
  speed: number
  cd: number
  frontalArea: number
  density?: number
}): number {
  throw new Error('not implemented')
}

export function frontalAreaFromBox(_size: Vec3, _yawDeg: number): number {
  throw new Error('not implemented')
}

export function reynoldsNumber(
  _speed: number,
  _length: number,
  _kinematicViscosity: number = 1.5e-5,
): number {
  throw new Error('not implemented')
}
