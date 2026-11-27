import { describe, expect, it } from 'vitest'
import {
  MAX_MESHES,
  MAX_VERTICES,
  assertModelBudget,
  sanitizeResourceUrl,
  loadModel,
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
  it.each(['.stl', '.obj', '.ply', '.step', '.stp', '.iges', '.igs'])('suggests mm for %s', (ext) => {
    expect(suggestedUnit(ext)).toBe('mm')
  })
})

describe('loadModel (.ply)', () => {
  const ply = (vertices: string[], faces: string[]) =>
    [
      'ply',
      'format ascii 1.0',
      `element vertex ${vertices.length}`,
      'property float x',
      'property float y',
      'property float z',
      `element face ${faces.length}`,
      'property list uchar int vertex_indices',
      'end_header',
      ...vertices,
      ...faces,
    ].join('\n') + '\n'
  const asFile = (name: string, text: string) => {
    const bytes = new TextEncoder().encode(text)
    return {
      name,
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
      text: async () => text,
    } as unknown as File
  }

  it('rejects a face-less PLY even when the vertex count is a multiple of 3', async () => {
    const cloud = ply(['0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1'], [])
    await expect(loadModel(asFile('cloud.ply', cloud), '.ply')).rejects.toThrow(/point cloud|no faces/i)
  })

  it('loads a PLY with one triangle', async () => {
    const tri = ply(['0 0 0', '1 0 0', '0 1 0'], ['3 0 1 2'])
    const model = await loadModel(asFile('tri.ply', tri), '.ply')
    expect(model.geometries).toHaveLength(1)
  })
})
