import { describe, expect, it } from 'vitest'
import {
  pressureCoefficient,
  surfacePressureCoefficient,
  velocityAt,
  type Obstacle,
  type Vec3,
} from './flowField'

const R = 2
const U = 10
const sphere: Obstacle = { center: [0, 0, 0], halfExtents: [R, R, R] }

describe('velocityAt (sphere)', () => {
  it('approaches the freestream far away', () => {
    const v = velocityAt([100 * R, 0, 0], sphere, U)
    expect(Math.abs(v[0] - U)).toBeLessThan(1e-3 * U)
    expect(Math.abs(v[1])).toBeLessThan(1e-3 * U)
    expect(Math.abs(v[2])).toBeLessThan(1e-3 * U)
  })

  it('far field in other directions is also ~freestream', () => {
    const v = velocityAt([-50 * R, 80 * R, 30 * R], sphere, U)
    expect(Math.abs(v[0] - U)).toBeLessThan(1e-3 * U)
    expect(Math.hypot(v[1], v[2])).toBeLessThan(1e-3 * U)
  })

  it('has a stagnation point at the front', () => {
    const v = velocityAt([-R * (1 + 1e-6), 0, 0], sphere, U)
    expect(Math.hypot(...v)).toBeLessThan(1e-3 * U)
  })

  it('has a stagnation point at the rear', () => {
    const v = velocityAt([R * (1 + 1e-6), 0, 0], sphere, U)
    expect(Math.hypot(...v)).toBeLessThan(1e-3 * U)
  })

  it('is 1.5 U along the equator', () => {
    const v = velocityAt([0, R, 0], sphere, U)
    expect(v[0]).toBeCloseTo(1.5 * U, 6)
    expect(v[1]).toBeCloseTo(0, 6)
    expect(v[2]).toBeCloseTo(0, 6)
    const vz = velocityAt([0, 0, R], sphere, U)
    expect(vz[0]).toBeCloseTo(1.5 * U, 6)
  })

  it('matches the analytic gradient at an off-axis point', () => {
    const [x, y, z] = [1.5, 2.5, -1]
    const r2 = x * x + y * y + z * z
    const r = Math.sqrt(r2)
    const k = (R ** 3) / 2
    const expected: Vec3 = [
      U * (1 + k / r ** 3 - (3 * k * x * x) / r ** 5),
      U * ((-3 * k * x * y) / r ** 5),
      U * ((-3 * k * x * z) / r ** 5),
    ]
    const v = velocityAt([x, y, z], sphere, U)
    expect(v[0]).toBeCloseTo(expected[0], 6)
    expect(v[1]).toBeCloseTo(expected[1], 6)
    expect(v[2]).toBeCloseTo(expected[2], 6)
  })

  it('returns zero inside the obstacle', () => {
    expect(velocityAt([0, 0, 0], sphere, U)).toEqual([0, 0, 0])
    expect(velocityAt([R * 0.5, 0, 0], sphere, U)).toEqual([0, 0, 0])
  })

  it('mirrors vy when the point is mirrored in y', () => {
    const a = velocityAt([-3, 2.5, 1], sphere, U)
    const b = velocityAt([-3, -2.5, 1], sphere, U)
    expect(b[0]).toBeCloseTo(a[0], 9)
    expect(b[1]).toBeCloseTo(-a[1], 9)
    expect(b[2]).toBeCloseTo(a[2], 9)
  })

  it('scales linearly with freestream', () => {
    const p: Vec3 = [-3, 2.5, 1]
    const a = velocityAt(p, sphere, U)
    const b = velocityAt(p, sphere, 3 * U)
    for (let i = 0; i < 3; i++) {
      expect(b[i]).toBeCloseTo(3 * a[i], 9)
    }
  })

  it('returns zero everywhere for zero freestream', () => {
    const v = velocityAt([5, 5, 5], sphere, 0)
    expect(v[0] + 0).toBeCloseTo(0, 12)
    expect(v[1] + 0).toBeCloseTo(0, 12)
    expect(v[2] + 0).toBeCloseTo(0, 12)
  })

  it('works with a non-zero center', () => {
    const c: Vec3 = [10, -4, 7]
    const shifted: Obstacle = { center: c, halfExtents: [R, R, R] }
    const v = velocityAt([c[0], c[1] + R, c[2]], shifted, U)
    expect(v[0]).toBeCloseTo(1.5 * U, 6)
    expect(v[1]).toBeCloseTo(0, 6)
    expect(v[2]).toBeCloseTo(0, 6)
    const inside = velocityAt(c, shifted, U)
    expect(inside).toEqual([0, 0, 0])
  })
})

describe('velocityAt (ellipsoid)', () => {
  const ellipsoid: Obstacle = { center: [1, 2, 3], halfExtents: [3, 1, 2] }

  it('is ~freestream far away', () => {
    const v = velocityAt([1 + 1000, 2, 3], ellipsoid, U)
    expect(Math.abs(v[0] - U)).toBeLessThan(1e-2 * U)
    expect(Math.hypot(v[1], v[2])).toBeLessThan(1e-2 * U)
  })

  it('is zero inside', () => {
    expect(velocityAt([1, 2, 3], ellipsoid, U)).toEqual([0, 0, 0])
    expect(velocityAt([1 + 2.9, 2, 3], ellipsoid, U)).toEqual([0, 0, 0])
  })

  it('is finite on and just outside the surface', () => {
    const pts: Vec3[] = [
      [1 + 3 * (1 + 1e-6), 2, 3],
      [1, 2 + 1 * (1 + 1e-6), 3],
      [1, 2, 3 + 2 * (1 + 1e-6)],
      [1 - 3 * (1 + 1e-6), 2, 3],
    ]
    for (const p of pts) {
      const v = velocityAt(p, ellipsoid, U)
      expect(v.every((c) => Number.isFinite(c))).toBe(true)
    }
  })
})

describe('pressureCoefficient', () => {
  it('is 0 at freestream speed', () => {
    expect(pressureCoefficient(U, U)).toBeCloseTo(0, 12)
  })
  it('is 1 at stagnation', () => {
    expect(pressureCoefficient(0, U)).toBeCloseTo(1, 12)
  })
  it('is 1 - 2.25 at 1.5 U', () => {
    expect(pressureCoefficient(1.5 * U, U)).toBeCloseTo(-1.25, 12)
  })
  it('returns 0 when freestream is 0', () => {
    expect(pressureCoefficient(5, 0)).toBe(0)
    expect(pressureCoefficient(0, 0)).toBe(0)
  })
})

describe('surfacePressureCoefficient', () => {
  const wind: Vec3 = [1, 0, 0]

  it('is 1 for a face pointing into the wind', () => {
    expect(surfacePressureCoefficient([-1, 0, 0], wind)).toBeCloseTo(1, 9)
  })
  it('is -1.25 for faces parallel to the wind', () => {
    expect(surfacePressureCoefficient([0, 1, 0], wind)).toBeCloseTo(-1.25, 9)
    expect(surfacePressureCoefficient([0, 0, -1], wind)).toBeCloseTo(-1.25, 9)
  })
  it('is 1 for a face facing downstream (symmetry)', () => {
    expect(surfacePressureCoefficient([1, 0, 0], wind)).toBeCloseTo(1, 9)
  })
  it('is 1 - 2.25 sin^2 at 30 degrees', () => {
    const n: Vec3 = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0]
    expect(surfacePressureCoefficient(n, wind)).toBeCloseTo(1 - 2.25 * 0.25, 9)
  })
  it('normalizes both inputs', () => {
    expect(surfacePressureCoefficient([-5, 0, 0], [3, 0, 0])).toBeCloseTo(1, 9)
    expect(surfacePressureCoefficient([0, 7, 0], [0.1, 0, 0])).toBeCloseTo(-1.25, 9)
  })
  it('returns 0 for a zero-length normal', () => {
    expect(surfacePressureCoefficient([0, 0, 0], wind)).toBe(0)
  })
})

describe('velocityAt (degenerate flat plate)', () => {
  const plates: Obstacle[] = [
    { center: [0, 0, 0], halfExtents: [1, 0, 1] },
    { center: [0, 0, 0], halfExtents: [0, 1, 1] },
    { center: [1, 2, 3], halfExtents: [1, 1, 0] },
  ]
  const points: Vec3[] = [
    [0, 0, 0],
    [1, 2, 3],
    [-2, 0, 0],
    [0, 0.5, 0],
    [0.5, 0, 0.5],
    [3, 2, 3],
    [-5, 1, 2],
    [2, 0, 0],
  ]

  it.each(plates.map((p, i) => [i, p] as const))('is finite everywhere for plate %i', (_i, plate) => {
    for (const p of points) {
      const v = velocityAt(p, plate, U)
      expect(v.every((c) => Number.isFinite(c))).toBe(true)
    }
  })

  it.each(plates.map((p, i) => [i, p] as const))('far field is about the freestream for plate %i', (_i, plate) => {
    const far: Vec3 = [plate.center[0] + 1000, plate.center[1] + 50, plate.center[2] - 50]
    const v = velocityAt(far, plate, U)
    expect(Math.abs(v[0] - U)).toBeLessThan(1e-2 * U)
    expect(Math.hypot(v[1], v[2])).toBeLessThan(1e-1 * U)
  })
})

describe('velocityAt out parameter', () => {
  it('writes into out and returns the same instance', () => {
    const out: Vec3 = [0, 0, 0]
    const r = velocityAt([-3, 2.5, 1], sphere, U, out)
    expect(r).toBe(out)
  })
  it('gives the same values as the call without out', () => {
    const p: Vec3 = [-3, 2.5, 1]
    const out: Vec3 = [9, 9, 9]
    velocityAt(p, sphere, U, out)
    expect(out).toEqual(velocityAt(p, sphere, U))
  })
  it('overwrites out with zeros inside the obstacle', () => {
    const out: Vec3 = [9, 9, 9]
    const r = velocityAt([0, 0, 0], sphere, U, out)
    expect(r).toBe(out)
    expect(out).toEqual([0, 0, 0])
  })
})
