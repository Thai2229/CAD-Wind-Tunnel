import { describe, expect, it, vi } from 'vitest'
import {
  MAX_MESHES,
  MAX_VERTICES,
  assertModelBudget,
  sanitizeResourceUrl,
  loadModel,
  retryableOnce,
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

describe('retryableOnce', () => {
  it('does not call the factory at creation', () => {
    const factory = vi.fn(async () => 1)
    retryableOnce(factory)
    expect(factory).not.toHaveBeenCalled()
  })

  it('shares one promise between concurrent callers', async () => {
    const factory = vi.fn(async () => 'x')
    const get = retryableOnce(factory)
    const a = get()
    const b = get()
    expect(a).toBe(b)
    expect(await Promise.all([a, b])).toEqual(['x', 'x'])
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('caches a successful result across sequential calls', async () => {
    const factory = vi.fn(async () => 'x')
    const get = retryableOnce(factory)
    await get()
    await get()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('calls the factory again after a rejection', async () => {
    const factory = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok')
    const get = retryableOnce(factory)
    await expect(get()).rejects.toThrow('boom')
    await expect(get()).resolves.toBe('ok')
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
