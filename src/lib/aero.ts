import type { Vec3 } from './flowField'

export const AIR_DENSITY = 1.225

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in'

const UNIT_METERS: Record<LengthUnit, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254 }

export function unitToMeters(unit: LengthUnit): number {
  return UNIT_METERS[unit]
}

export function dynamicPressure(speed: number, density: number = AIR_DENSITY): number {
  return 0.5 * density * speed * speed
}

export function dragForce(opts: {
  speed: number
  cd: number
  frontalArea: number
  density?: number
}): number {
  return dynamicPressure(opts.speed, opts.density) * opts.cd * opts.frontalArea
}

export function frontalAreaFromBox(size: Vec3, yawDeg: number): number {
  const yaw = (yawDeg * Math.PI) / 180
  return size[1] * (size[2] * Math.abs(Math.cos(yaw)) + size[0] * Math.abs(Math.sin(yaw)))
}

export function reynoldsNumber(
  speed: number,
  length: number,
  kinematicViscosity: number = 1.5e-5,
): number {
  return (speed * length) / kinematicViscosity
}
