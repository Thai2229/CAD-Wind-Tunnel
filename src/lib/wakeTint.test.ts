import { describe, expect, it } from 'vitest'
import { WAKE_TINT_AMBER, WAKE_TINT_BASE, wakeTint } from './wakeTint'

type C = [number, number, number]

describe('wakeTint', () => {
  it('is the base colour at factor 0', () => {
    expect(wakeTint(0, [0, 0, 0])).toEqual(WAKE_TINT_BASE)
  })
  it('is full amber from factor 1/3 up', () => {
    for (const f of [1 / 3 + 1e-9, 0.5, 1, 5]) {
      const c = wakeTint(f, [0, 0, 0])
      c.forEach((v, i) => expect(v).toBeCloseTo(WAKE_TINT_AMBER[i]!, 9))
    }
  })
  it('blends linearly in between', () => {
    const c = wakeTint(1 / 6, [0, 0, 0])
    c.forEach((v, i) => expect(v).toBeCloseTo((WAKE_TINT_BASE[i]! + WAKE_TINT_AMBER[i]!) / 2, 9))
  })
  it('moves monotonically from base toward amber', () => {
    let prev = wakeTint(0, [0, 0, 0])
    for (const f of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
      const c = wakeTint(f, [0, 0, 0])
      for (let i = 0; i < 3; i++) {
        const dir = Math.sign(WAKE_TINT_AMBER[i]! - WAKE_TINT_BASE[i]!)
        expect((c[i]! - prev[i]!) * dir).toBeGreaterThanOrEqual(-1e-12)
      }
      prev = c
    }
  })
  it('clamps negative and non-finite-low factors to base', () => {
    expect(wakeTint(-3, [0, 0, 0])).toEqual(WAKE_TINT_BASE)
  })
  it('writes into out and returns the same instance', () => {
    const out: C = [9, 9, 9]
    const r = wakeTint(1, out)
    expect(r).toBe(out)
    expect(out[0]).toBeCloseTo(WAKE_TINT_AMBER[0]!, 9)
  })
  it('does not share state with the exported constants', () => {
    const out: C = [0, 0, 0]
    wakeTint(0.2, out)
    expect(WAKE_TINT_BASE).toEqual([0.839, 0.925, 1])
  })
})
