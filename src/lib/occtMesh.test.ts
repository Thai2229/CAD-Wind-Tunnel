import { describe, expect, it } from 'vitest'
import { MAX_CAD_TRIANGLES, occtToMeshData, stepFormatError, type OcctResult } from './occtMesh'

const tri = (extra: Partial<OcctResult['meshes'][number]['attributes']> = {}) => ({
  attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] }, ...extra },
  index: { array: [0, 1, 2] },
})

describe('occtToMeshData', () => {
  it('converts a single triangle to typed arrays with correct values', () => {
    const out = occtToMeshData({ success: true, meshes: [tri()] })
    expect(out).toHaveLength(1)
    expect(out[0]!.positions).toBeInstanceOf(Float32Array)
    expect(out[0]!.indices).toBeInstanceOf(Uint32Array)
    expect(Array.from(out[0]!.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(Array.from(out[0]!.indices)).toEqual([0, 1, 2])
  })

  it('returns one entry per mesh', () => {
    const second = {
      attributes: { position: { array: [0, 0, 1, 1, 0, 1, 0, 1, 1] } },
      index: { array: [2, 1, 0] },
    }
    const out = occtToMeshData({ success: true, meshes: [tri(), second] })
    expect(out).toHaveLength(2)
    expect(Array.from(out[1]!.positions)).toEqual([0, 0, 1, 1, 0, 1, 0, 1, 1])
    expect(Array.from(out[1]!.indices)).toEqual([2, 1, 0])
  })

  it('skips meshes with an empty index', () => {
    const empty = { attributes: { position: { array: [0, 0, 0] } }, index: { array: [] } }
    const out = occtToMeshData({ success: true, meshes: [empty, tri()] })
    expect(out).toHaveLength(1)
    expect(Array.from(out[0]!.indices)).toEqual([0, 1, 2])
  })

  it('keeps normals as Float32Array when lengths match', () => {
    const n = [0, 0, 1, 0, 0, 1, 0, 0, 1]
    const out = occtToMeshData({ success: true, meshes: [tri({ normal: { array: n } })] })
    expect(out[0]!.normals).toBeInstanceOf(Float32Array)
    expect(Array.from(out[0]!.normals!)).toEqual(n)
  })

  it('returns null normals when absent', () => {
    const out = occtToMeshData({ success: true, meshes: [tri()] })
    expect(out[0]!.normals).toBeNull()
  })

  it('returns null normals when the length differs from positions', () => {
    const out = occtToMeshData({ success: true, meshes: [tri({ normal: { array: [0, 0, 1] } })] })
    expect(out[0]!.normals).toBeNull()
  })

  it('throws when success is false', () => {
    expect(() => occtToMeshData({ success: false, meshes: [tri()] })).toThrow(/could not read|no geometry|failed/i)
  })

  it('throws when there are no meshes', () => {
    expect(() => occtToMeshData({ success: true, meshes: [] })).toThrow(/could not read|no geometry|failed/i)
  })

  it('throws when every mesh is empty', () => {
    const empty = { attributes: { position: { array: [] } }, index: { array: [] } }
    expect(() => occtToMeshData({ success: true, meshes: [empty, empty] })).toThrow(/could not read|no geometry|failed/i)
  })
})

describe('stepFormatError', () => {
  it.each(['.step', '.stp'])('names STEP for %s and includes the message', (ext) => {
    const msg = stepFormatError(ext, 'bad header')
    expect(msg).toMatch(/STEP/)
    expect(msg).toContain('bad header')
  })

  it.each(['.iges', '.igs'])('names IGES for %s and includes the message', (ext) => {
    const msg = stepFormatError(ext, 'bad header')
    expect(msg).toMatch(/IGES/)
    expect(msg).toContain('bad header')
  })

  it('falls back to CAD for an unknown extension', () => {
    const msg = stepFormatError('.xyz', 'boom')
    expect(msg).toMatch(/CAD/)
    expect(msg).toContain('boom')
  })
})

describe('occtToMeshData budget guard', () => {
  const fake = (triangles: number) => ({
    attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
    index: { array: { length: triangles * 3 } as unknown as number[] },
  })
  const small = { maxTriangles: 4, maxMeshes: 3 }

  it('exports the default triangle cap', () => {
    expect(MAX_CAD_TRIANGLES).toBe(3_000_000)
  })

  it('throws when total triangles exceed the limit', () => {
    expect(() => occtToMeshData({ success: true, meshes: [fake(5)] }, small)).toThrow(/too (complex|large|many)/i)
  })

  it('sums triangles across meshes', () => {
    expect(() => occtToMeshData({ success: true, meshes: [fake(2), fake(3)] }, small)).toThrow(/too (complex|large|many)/i)
  })

  it('throws when there are too many meshes', () => {
    const meshes = [tri(), tri(), tri(), tri()]
    expect(() => occtToMeshData({ success: true, meshes }, small)).toThrow(/too (complex|large|many)/i)
  })

  it('allows exactly the triangle and mesh limits', () => {
    const meshes = [tri(), tri(), { ...tri(), index: { array: [0, 1, 2, 0, 1, 2] } }]
    const out = occtToMeshData({ success: true, meshes }, { maxTriangles: 4, maxMeshes: 3 })
    expect(out).toHaveLength(3)
  })

  it('applies the default limit of MAX_CAD_TRIANGLES before copying', () => {
    const result = { success: true, meshes: [fake(MAX_CAD_TRIANGLES + 1)] }
    expect(() => occtToMeshData(result)).toThrow(/too (complex|large|many)/i)
  })
})
