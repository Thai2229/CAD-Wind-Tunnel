import { describe, expect, it } from 'vitest'
import {
  MAX_MESHES,
  MAX_VERTICES,
  assertModelBudget,
  sanitizeResourceUrl,
  suggestedUnit,
} from './loadModel'

describe('sanitizeResourceUrl', () => {
  it.each(['data:image/png;base64,AAAA', 'blob:http://localhost/abc', 'DATA:image/png;base64,AA', 'Blob:xyz'])(
    'keeps %s',
    (url) => {
      expect(sanitizeResourceUrl(url)).toBe(url)
    },
  )

  it.each([
    'http://example.com/a.png',
    'https://example.com/a.png',
    '//host/x.png',
    'tex.png',
    'javascript:alert(1)',
    '',
  ])('blocks %s', (url) => {
    expect(sanitizeResourceUrl(url)).toBe('')
  })
})

describe('assertModelBudget', () => {
  it('allows an empty model', () => {
    expect(() => assertModelBudget([])).not.toThrow()
  })
  it('allows exactly MAX_VERTICES vertices', () => {
    expect(() => assertModelBudget([MAX_VERTICES])).not.toThrow()
    expect(() => assertModelBudget([MAX_VERTICES - 1, 1])).not.toThrow()
  })
  it('allows exactly MAX_MESHES meshes', () => {
    expect(() => assertModelBudget(new Array(MAX_MESHES).fill(1))).not.toThrow()
  })
  it('throws when total vertices exceed the limit', () => {
    expect(() => assertModelBudget([MAX_VERTICES + 1])).toThrow(/too (complex|large|many)/i)
    expect(() => assertModelBudget([MAX_VERTICES, 1])).toThrow(/too (complex|large|many)/i)
  })
  it('throws when there are too many meshes', () => {
    expect(() => assertModelBudget(new Array(MAX_MESHES + 1).fill(1))).toThrow(/too (complex|large|many)/i)
  })
})

describe('suggestedUnit', () => {
  it('suggests meters for glb', () => {
    expect(suggestedUnit('.glb')).toBe('m')
  })
  it.each(['.stl', '.obj', '.ply'])('suggests mm for %s', (ext) => {
    expect(suggestedUnit(ext)).toBe('mm')
  })
})
