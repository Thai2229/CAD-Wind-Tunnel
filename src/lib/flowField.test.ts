import { describe, expect, it } from 'vitest'
import {
  pressureCoefficient,
  surfacePressureCoefficient,
  velocityAt,
  applyWake,
  wakeFactor,
  BASE_CP,
  SEPARATION_END_DEG,
  SEPARATION_START_DEG,
  WAKE_DEFICIT,
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
  it('is the midpoint of potential and BASE_CP for faces parallel to the wind', () => {
    expect(surfacePressureCoefficient([0, 1, 0], wind)).toBeCloseTo(-0.825, 9)
    expect(surfacePressureCoefficient([0, 0, -1], wind)).toBeCloseTo(-0.825, 9)
  })
  it('is BASE_CP for a face facing downstream (separated wake)', () => {
    expect(surfacePressureCoefficient([1, 0, 0], wind)).toBeCloseTo(BASE_CP, 9)
  })
  it('is 1 - 2.25 sin^2 at 30 degrees', () => {
    const n: Vec3 = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0]
    expect(surfacePressureCoefficient(n, wind)).toBeCloseTo(1 - 2.25 * 0.25, 9)
  })
  it('normalizes both inputs', () => {
    expect(surfacePressureCoefficient([-5, 0, 0], [3, 0, 0])).toBeCloseTo(1, 9)
    expect(surfacePressureCoefficient([0, 7, 0], [0.1, 0, 0])).toBeCloseTo(-0.825, 9)
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

describe('surfacePressureCoefficient separation', () => {
  const wind: Vec3 = [1, 0, 0]
  const potential = (deg: number) => 1 - 2.25 * Math.sin((deg * Math.PI) / 180) ** 2
  // face normal at angle deg from the upwind direction, tilted in +y
  const at = (deg: number, tilt: 'y' | '-y' | 'z' = 'y'): Vec3 => {
    const t = (deg * Math.PI) / 180
    if (tilt === '-y') return [-Math.cos(t), -Math.sin(t), 0]
    if (tilt === 'z') return [-Math.cos(t), 0, Math.sin(t)]
    return [-Math.cos(t), Math.sin(t), 0]
  }

  it('exports the separation constants', () => {
    expect(SEPARATION_START_DEG).toBe(80)
    expect(SEPARATION_END_DEG).toBe(100)
    expect(BASE_CP).toBe(-0.4)
  })
  it('is 1 at 0 degrees', () => {
    expect(surfacePressureCoefficient(at(0), wind)).toBeCloseTo(1, 9)
  })
  it('is unchanged potential flow at 30 degrees', () => {
    expect(surfacePressureCoefficient(at(30), wind)).toBeCloseTo(1 - 2.25 * 0.25, 9)
  })
  it('equals potential flow at the separation start (80 degrees)', () => {
    expect(surfacePressureCoefficient(at(80), wind)).toBeCloseTo(potential(80), 9)
  })
  it('is exactly the midpoint of potential(90) and BASE_CP at 90 degrees', () => {
    expect(potential(90)).toBeCloseTo(-1.25, 12)
    expect(surfacePressureCoefficient(at(90), wind)).toBeCloseTo(-0.825, 9)
  })
  it('blends with a smoothstep between 80 and 100 degrees', () => {
    const deg = 85
    const t = (deg - 80) / 20
    const s = 3 * t * t - 2 * t * t * t
    expect(surfacePressureCoefficient(at(deg), wind)).toBeCloseTo(potential(deg) + (BASE_CP - potential(deg)) * s, 9)
  })
  it.each([100, 101, 135, 180])('is BASE_CP at %i degrees', (deg) => {
    expect(surfacePressureCoefficient(at(deg), wind)).toBeCloseTo(BASE_CP, 12)
  })
  it('stays within [-1.25, 1] for 200 sampled angles', () => {
    for (let i = 0; i < 200; i++) {
      const cp = surfacePressureCoefficient(at((i * 180) / 199), wind)
      expect(cp).toBeLessThanOrEqual(1 + 1e-12)
      expect(cp).toBeGreaterThanOrEqual(-1.25 - 1e-12)
    }
  })
  it('is symmetric in the sign and axis of an off-axis tilt', () => {
    for (const deg of [10, 60, 85, 95, 120]) {
      const a = surfacePressureCoefficient(at(deg, 'y'), wind)
      expect(surfacePressureCoefficient(at(deg, '-y'), wind)).toBeCloseTo(a, 12)
      expect(surfacePressureCoefficient(at(deg, 'z'), wind)).toBeCloseTo(a, 12)
    }
  })
  it('normalizes non-unit inputs', () => {
    expect(surfacePressureCoefficient([-3, 3 * Math.tan(Math.PI / 6), 0], [0.5, 0, 0])).toBeCloseTo(
      1 - 2.25 * 0.25,
      9,
    )
    expect(surfacePressureCoefficient([0, 0, 0], wind)).toBe(0)
  })
})

describe('wakeFactor', () => {
  const box: Obstacle = { center: [1, 2, 3], halfExtents: [2, 1, 1.5] }
  const rear = 1 + 2
  const behind = (d: number, dy = 0, dz = 0): Vec3 => [rear + d, 2 + dy, 3 + dz]

  it('is 0 upstream, alongside and inside the body, and at d = 0', () => {
    expect(wakeFactor([-10, 2, 3], box)).toBe(0)
    expect(wakeFactor([1, 2, 3], box)).toBe(0)
    expect(wakeFactor([1, 50, 3], box)).toBe(0)
    expect(wakeFactor(behind(0), box)).toBe(0)
    expect(wakeFactor(behind(-0.5), box)).toBe(0)
  })
  it('is about 1 on the centerline just behind the body', () => {
    expect(wakeFactor(behind(1e-6), box)).toBeGreaterThan(0.99)
  })
  it('matches the closed form on and off the centerline', () => {
    const d = 3
    expect(wakeFactor(behind(d), box)).toBeCloseTo(1 / (1 + d / (3 * 2)), 9)
    const dy = 0.5
    const dz = 0.7
    const q = (dy / (1 + 0.15 * d)) ** 2 + (dz / (1.5 + 0.15 * d)) ** 2
    expect(wakeFactor(behind(d, dy, dz), box)).toBeCloseTo(Math.exp(-2 * q) / (1 + d / 6), 9)
  })
  it('decreases monotonically with distance on the centerline', () => {
    let prev = Infinity
    for (const d of [0.01, 0.5, 1, 2, 5, 10, 40]) {
      const f = wakeFactor(behind(d), box)
      expect(f).toBeLessThan(prev)
      prev = f
    }
  })
  it('decreases with lateral offset', () => {
    let prev = Infinity
    for (const dy of [0, 0.5, 1, 2, 4]) {
      const f = wakeFactor(behind(2, dy), box)
      expect(f).toBeLessThan(prev)
      prev = f
    }
    expect(wakeFactor(behind(2, 0, 3), box)).toBeLessThan(wakeFactor(behind(2, 0, 1), box))
  })
  it('is below 0.01 far to the side', () => {
    expect(wakeFactor(behind(1, 5 * 1), box)).toBeLessThan(0.01)
    expect(wakeFactor(behind(1, 0, 5 * 1.5), box)).toBeLessThan(0.01)
  })
  it('is symmetric in +/- y and +/- z', () => {
    expect(wakeFactor(behind(2, 0.8, 0.3), box)).toBeCloseTo(wakeFactor(behind(2, -0.8, 0.3), box), 12)
    expect(wakeFactor(behind(2, 0.8, 0.3), box)).toBeCloseTo(wakeFactor(behind(2, 0.8, -0.3), box), 12)
  })
  it.each([
    [{ center: [0, 0, 0], halfExtents: [1, 0, 1] } as Obstacle],
    [{ center: [0, 0, 0], halfExtents: [0, 1, 1] } as Obstacle],
    [box],
  ])('is finite and within [0, 1] for sampled points (obstacle %#)', (obstacle) => {
    for (let i = 0; i < 300; i++) {
      const p: Vec3 = [
        Math.sin(i * 12.9898) * 20,
        Math.sin(i * 78.233) * 10,
        Math.sin(i * 37.719) * 10,
      ]
      const f = wakeFactor(p, obstacle)
      expect(Number.isFinite(f)).toBe(true)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
    expect(Number.isFinite(wakeFactor([1e-9, 0, 0], obstacle))).toBe(true)
  })
})

describe('applyWake', () => {
  it('exports a 0.6 deficit', () => {
    expect(WAKE_DEFICIT).toBe(0.6)
  })
  it('leaves v unchanged for factor 0', () => {
    expect(applyWake([1, -2, 3], 0)).toEqual([1, -2, 3])
  })
  it('scales to 0.4 v for factor 1', () => {
    const r = applyWake([10, -5, 2], 1)
    expect(r[0]).toBeCloseTo(4, 12)
    expect(r[1]).toBeCloseTo(-2, 12)
    expect(r[2]).toBeCloseTo(0.8, 12)
  })
  it('scales by 1 - deficit * factor in between', () => {
    expect(applyWake([10, 0, 0], 0.5)[0]).toBeCloseTo(10 * (1 - 0.6 * 0.5), 12)
  })
  it('does not mutate the input when no out is given', () => {
    const v: Vec3 = [1, 2, 3]
    const r = applyWake(v, 1)
    expect(r).not.toBe(v)
    expect(v).toEqual([1, 2, 3])
  })
  it('writes in place into out and returns the same instance', () => {
    const out: Vec3 = [0, 0, 0]
    const r = applyWake([10, 0, 5], 1, out)
    expect(r).toBe(out)
    expect(out[0]).toBeCloseTo(4, 12)
    expect(out[2]).toBeCloseTo(2, 12)
  })
  it('works when out === v', () => {
    const v: Vec3 = [10, 20, 30]
    const r = applyWake(v, 1, v)
    expect(r).toBe(v)
    expect(v[0]).toBeCloseTo(4, 12)
    expect(v[1]).toBeCloseTo(8, 12)
    expect(v[2]).toBeCloseTo(12, 12)
  })
  it('clamps factor to [0, 1]', () => {
    expect(applyWake([10, 0, 0], 2)[0]).toBeCloseTo(4, 12)
    expect(applyWake([10, 0, 0], -1)[0]).toBeCloseTo(10, 12)
  })
})
