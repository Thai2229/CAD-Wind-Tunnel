import { describe, expect, it, vi } from 'vitest'
import { CadLimitError, stepFormatError, type OcctResult } from './occtMesh'
import * as occtMesh from './occtMesh'
import { runParse } from './workerProtocol'

const oneTriangle: OcctResult = {
  success: true,
  meshes: [
    {
      attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
      index: { array: [0, 1, 2] },
    },
  ],
}

function fakeReader(result: OcctResult = oneTriangle) {
  return {
    ReadStepFile: vi.fn(() => result),
    ReadIgesFile: vi.fn(() => result),
  }
}

const req = (extension: string) => ({ extension, bytes: new Uint8Array([1, 2, 3]).buffer })

describe('runParse', () => {
  it.each(['.step', '.stp', '.STEP', '.Stp'])('uses ReadStepFile for %s', (ext) => {
    const reader = fakeReader()
    const res = runParse(req(ext), reader)
    expect(reader.ReadStepFile).toHaveBeenCalledTimes(1)
    expect(reader.ReadIgesFile).not.toHaveBeenCalled()
    expect(res.ok).toBe(true)
  })

  it.each(['.iges', '.igs', '.IGES', '.Igs'])('uses ReadIgesFile for %s', (ext) => {
    const reader = fakeReader()
    const res = runParse(req(ext), reader)
    expect(reader.ReadIgesFile).toHaveBeenCalledTimes(1)
    expect(reader.ReadStepFile).not.toHaveBeenCalled()
    expect(res.ok).toBe(true)
  })

  it('passes the bytes as a Uint8Array and null params', () => {
    const reader = fakeReader()
    runParse(req('.step'), reader)
    const [bytes, params] = reader.ReadStepFile.mock.calls[0] as unknown as [Uint8Array, null]
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes)).toEqual([1, 2, 3])
    expect(params).toBeNull()
  })

  it('returns mesh data for a one-triangle result', () => {
    const res = runParse(req('.step'), fakeReader())
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.result).toHaveLength(1)
      expect(Array.from(res.result[0]!.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
      expect(Array.from(res.result[0]!.indices)).toEqual([0, 1, 2])
    }
  })

  it('maps a CadLimitError to a limit response with its message', () => {
    const spy = vi.spyOn(occtMesh, 'occtToMeshData').mockImplementation(() => {
      throw new CadLimitError('too big')
    })
    try {
      const res = runParse(req('.step'), fakeReader())
      expect(res).toEqual({ ok: false, error: 'too big', limit: true })
    } finally {
      spy.mockRestore()
    }
  })

  it('maps a real over-budget model to a limit response', () => {
    const meshes = Array.from({ length: 501 }, () => oneTriangle.meshes[0]!)
    const res = runParse(req('.step'), fakeReader({ success: true, meshes }))
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.limit).toBe(true)
      expect(res.error).toMatch(/too complex/i)
    }
  })

  it('formats other errors with stepFormatError and no limit flag', () => {
    const res = runParse(req('.step'), fakeReader({ success: false, meshes: [] }))
    expect(res).toEqual({
      ok: false,
      error: stepFormatError('.step', 'Could not read any geometry from this CAD file.'),
    })
    expect((res as { limit?: boolean }).limit).toBeUndefined()
  })

  it('formats IGES errors as IGES', () => {
    const res = runParse(req('.igs'), fakeReader({ success: false, meshes: [] }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/IGES/)
  })

  it('catches errors thrown by the reader', () => {
    const reader = fakeReader()
    reader.ReadStepFile.mockImplementation(() => {
      throw new Error('wasm exploded')
    })
    const res = runParse(req('.step'), reader)
    expect(res).toEqual({ ok: false, error: stepFormatError('.step', 'wasm exploded') })
  })
})
