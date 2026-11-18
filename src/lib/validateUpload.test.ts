import { describe, expect, it } from 'vitest'
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, validateUpload } from './validateUpload'

const f = (name: string, size = 1024) => ({ name, size })

describe('constants', () => {
  it('lists accepted extensions and the 50 MB limit', () => {
    expect(ACCEPTED_EXTENSIONS).toEqual(['.stl', '.obj', '.glb', '.ply'])
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024)
  })
})

describe('validateUpload', () => {
  it.each(['.stl', '.obj', '.glb', '.ply'])('accepts %s and returns the file', (ext) => {
    const file = f(`model${ext}`)
    const result = validateUpload([file])
    expect(result).toEqual({ ok: true, file, extension: ext })
  })

  it('accepts uppercase extensions and returns lowercase', () => {
    const file = f('MODEL.STL')
    const result = validateUpload([file])
    expect(result).toEqual({ ok: true, file, extension: '.stl' })
  })

  it('accepts a file exactly at the size limit', () => {
    expect(validateUpload([f('a.glb', MAX_FILE_BYTES)]).ok).toBe(true)
  })

  it('accepts a 1 byte file', () => {
    expect(validateUpload([f('a.ply', 1)]).ok).toBe(true)
  })

  it('accepts names with multiple dots using the last extension', () => {
    const result = validateUpload([f('my.part.v2.obj')])
    expect(result).toMatchObject({ ok: true, extension: '.obj' })
  })

  it('accepts array-likes such as a FileList shape', () => {
    const file = f('a.stl')
    const list = { 0: file, length: 1 } as ArrayLike<typeof file>
    expect(validateUpload(list).ok).toBe(true)
  })

  it('rejects zero files', () => {
    const result = validateUpload([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no file|select|choose|upload/i)
  })

  it('rejects more than one file', () => {
    const result = validateUpload([f('a.stl'), f('b.stl')])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/one model/i)
  })

  it.each(['model.step', 'noext', 'archive.stl.zip', 'model.', '.gitignore', 'a.fbx'])(
    'rejects unsupported name %s',
    (name) => {
      const result = validateUpload([f(name)])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/unsupported|format|type|extension/i)
    },
  )

  it('rejects an empty file', () => {
    const result = validateUpload([f('a.stl', 0)])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/empty/i)
  })

  it('rejects a file one byte over the limit', () => {
    const result = validateUpload([f('a.stl', MAX_FILE_BYTES + 1)])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/large|size|50/i)
  })
})
