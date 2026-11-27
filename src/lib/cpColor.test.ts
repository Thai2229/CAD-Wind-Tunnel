import { describe, expect, it } from 'vitest'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { applyPressureColors, cpColor } from './cpColor'
import { surfacePressureCoefficient, type Vec3 } from './flowField'

// Deterministic pseudo-random unit-ish normals.
function normals(n: number): Vec3[] {
  const out: Vec3[] = []
  for (let i = 0; i < n; i++) {
    out.push([Math.sin(i * 12.9898) * 2, Math.sin(i * 78.233), Math.sin(i * 37.719) * 0.5])
  }
  return out
}

describe('applyPressureColors', () => {
  it.each([0, 0.6, -1.1])('matches surfacePressureCoefficient for 50 normals at yaw %f', (yaw) => {
    const ns = normals(50)
    const g = new BufferGeometry()
    g.setAttribute('normal', new Float32BufferAttribute(ns.flat(), 3))
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(50 * 3), 3))
    applyPressureColors(g, yaw)
    const color = g.getAttribute('color')
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    ns.forEach((n, i) => {
      // rotate the normal about Y by yaw, as the model group is
      const world: Vec3 = [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]
      const expected = cpColor(surfacePressureCoefficient(world, [1, 0, 0]))
      expect(color.getX(i)).toBeCloseTo(expected[0], 5)
      expect(color.getY(i)).toBeCloseTo(expected[1], 5)
      expect(color.getZ(i)).toBeCloseTo(expected[2], 5)
    })
  })
})
