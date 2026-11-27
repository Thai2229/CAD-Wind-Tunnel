import { describe, expect, it } from 'vitest'
import { aimedSpawn } from './aimedSpawn'
import type { Obstacle } from './flowField'

const bounds = { width: 5, height: 4 }
const ZMAX = 5 / 2 - 0.1
const grid = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]

const obstacle = (cy: number, hy: number, hz: number, cz = 0): Obstacle => ({
  center: [0, cy, cz],
  halfExtents: [2, hy, hz],
})

describe('aimedSpawn', () => {
  it.each([0.5, 1.75, 3, 10])('keeps z inside the side walls for half extent %f', (hz) => {
    for (const r1 of grid) {
      for (const r2 of grid) {
        const [, z] = aimedSpawn(obstacle(1, 0.5, hz), bounds, r1, r2, [0, 0])
        expect(Math.abs(z)).toBeLessThanOrEqual(ZMAX + 1e-12)
      }
    }
  })

  it.each([
    ['tall near the ceiling', obstacle(3.9, 3, 1)],
    ['low near the floor', obstacle(0.05, 3, 1)],
    ['huge', obstacle(2, 50, 1)],
    ['centered', obstacle(2, 0.5, 1)],
  ])('keeps y within [0.1, H - 0.1] on both sides (%s)', (_name, o) => {
    for (const r1 of grid) {
      for (const r2 of grid) {
        const [y] = aimedSpawn(o, bounds, r1, r2, [0, 0])
        expect(y).toBeGreaterThanOrEqual(0.1 - 1e-12)
        expect(y).toBeLessThanOrEqual(4 - 0.1 + 1e-12)
      }
    }
  })

  it('aims at the model: y spans center +/- 1.6 half extent, z likewise', () => {
    const o = obstacle(2, 0.5, 0.75)
    expect(aimedSpawn(o, bounds, 0, 0, [0, 0])[0]).toBeCloseTo(2 - 0.8, 12)
    expect(aimedSpawn(o, bounds, 1, 0, [0, 0])[0]).toBeCloseTo(2 + 0.8, 12)
    expect(aimedSpawn(o, bounds, 0, 0, [0, 0])[1]).toBeCloseTo(-1.2, 12)
    expect(aimedSpawn(o, bounds, 0, 1, [0, 0])[1]).toBeCloseTo(1.2, 12)
  })

  it('spreads over the allowed range instead of piling up when the aimed range is empty', () => {
    const o = obstacle(10, 0.5, 1) // far above the ceiling: aimed y range does not intersect the section
    const ys = grid.map((r) => aimedSpawn(o, bounds, r, 0.5, [0, 0])[0])
    expect(new Set(ys).size).toBe(grid.length)
    expect(ys[0]).toBeCloseTo(0.1, 12)
    expect(ys[ys.length - 1]).toBeCloseTo(3.9, 12)
    const zo = obstacle(2, 0.5, 1, 20) // far to the side
    const zs = grid.map((r) => aimedSpawn(zo, bounds, 0.5, r, [0, 0])[1])
    expect(new Set(zs).size).toBe(grid.length)
    expect(zs[0]).toBeCloseTo(-ZMAX, 12)
    expect(zs[zs.length - 1]).toBeCloseTo(ZMAX, 12)
  })

  it('is deterministic for the same inputs', () => {
    const o = obstacle(2, 0.7, 0.9)
    expect(aimedSpawn(o, bounds, 0.3, 0.8, [0, 0])).toEqual(aimedSpawn(o, bounds, 0.3, 0.8, [9, 9]))
  })

  it('writes into out and returns the same instance', () => {
    const out: [number, number] = [9, 9]
    const r = aimedSpawn(obstacle(2, 0.5, 0.5), bounds, 0.5, 0.5, out)
    expect(r).toBe(out)
    expect(out[0]).toBeCloseTo(2, 12)
    expect(out[1]).toBeCloseTo(0, 12)
  })
})
