import { describe, expect, it } from 'vitest'
import {
  AIR_DENSITY,
  dragForce,
  dynamicPressure,
  frontalAreaFromBox,
  reynoldsNumber,
  unitToMeters,
} from './aero'

describe('unitToMeters', () => {
  it.each([
    ['mm', 0.001],
    ['cm', 0.01],
    ['m', 1],
    ['in', 0.0254],
  ] as const)('%s -> %d', (unit, expected) => {
    expect(unitToMeters(unit)).toBeCloseTo(expected, 12)
  })
})

describe('dynamicPressure', () => {
  it('uses sea level air density by default', () => {
    expect(AIR_DENSITY).toBe(1.225)
    expect(dynamicPressure(10)).toBeCloseTo(0.5 * 1.225 * 100, 9)
  })
  it('accepts a custom density', () => {
    expect(dynamicPressure(10, 1000)).toBeCloseTo(50000, 9)
  })
  it('is zero at zero speed', () => {
    expect(dynamicPressure(0)).toBe(0)
  })
  it('scales with speed squared', () => {
    expect(dynamicPressure(20)).toBeCloseTo(4 * dynamicPressure(10), 9)
  })
})

describe('dragForce', () => {
  it('computes 0.5 rho v^2 Cd A', () => {
    expect(dragForce({ speed: 10, cd: 0.5, frontalArea: 2 })).toBeCloseTo(0.5 * 1.225 * 100 * 0.5 * 2, 9)
  })
  it('honours a custom density', () => {
    expect(dragForce({ speed: 2, cd: 1, frontalArea: 1, density: 1000 })).toBeCloseTo(2000, 9)
  })
  it('is zero when speed, cd or area is zero', () => {
    expect(dragForce({ speed: 0, cd: 1, frontalArea: 1 })).toBe(0)
    expect(dragForce({ speed: 5, cd: 0, frontalArea: 1 })).toBe(0)
    expect(dragForce({ speed: 5, cd: 1, frontalArea: 0 })).toBe(0)
  })
})

describe('frontalAreaFromBox', () => {
  const size: [number, number, number] = [2, 3, 5]

  it('yaw 0 gives height x depth (y*z)', () => {
    expect(frontalAreaFromBox(size, 0)).toBeCloseTo(15, 9)
  })
  it('yaw 90 gives height x length (y*x)', () => {
    expect(frontalAreaFromBox(size, 90)).toBeCloseTo(6, 9)
  })
  it('yaw 45 mixes both', () => {
    const expected = 3 * (2 * Math.SQRT1_2 + 5 * Math.SQRT1_2)
    expect(frontalAreaFromBox(size, 45)).toBeCloseTo(expected, 9)
  })
  it('is symmetric in the sign of yaw and periodic by 180', () => {
    expect(frontalAreaFromBox(size, -30)).toBeCloseTo(frontalAreaFromBox(size, 30), 9)
    expect(frontalAreaFromBox(size, 180)).toBeCloseTo(frontalAreaFromBox(size, 0), 9)
  })
  it('is zero for a flat (zero height) box', () => {
    expect(frontalAreaFromBox([2, 0, 5], 20)).toBe(0)
  })
})

describe('reynoldsNumber', () => {
  it('computes v L / nu with air default viscosity', () => {
    expect(reynoldsNumber(10, 1.5)).toBeCloseTo((10 * 1.5) / 1.5e-5, 3)
  })
  it('accepts a custom viscosity', () => {
    expect(reynoldsNumber(2, 3, 1e-6)).toBeCloseTo(6e6, 3)
  })
  it('is zero at zero speed', () => {
    expect(reynoldsNumber(0, 1)).toBe(0)
  })
})
