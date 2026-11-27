import { CadLimitError, occtToMeshData, stepFormatError, type OcctMeshData, type OcctResult } from './occtMesh'

export type ParseRequest = { extension: string; bytes: ArrayBuffer }

export type ParseResponse =
  | { ok: true; result: OcctMeshData[] }
  | { ok: false; error: string; limit?: boolean }

// Reply the worker sends when occt-import-js itself could not be loaded.
export const READER_LOAD_FAILED = 'reader-load-failed'

export function runParse(
  request: ParseRequest,
  reader: {
    ReadStepFile(b: Uint8Array, p: null): OcctResult
    ReadIgesFile(b: Uint8Array, p: null): OcctResult
  },
): ParseResponse {
  const extension = request.extension.toLowerCase()
  try {
    const bytes = new Uint8Array(request.bytes)
    let result: OcctResult
    if (extension === '.step' || extension === '.stp') {
      result = reader.ReadStepFile(bytes, null)
    } else {
      result = reader.ReadIgesFile(bytes, null)
    }
    return { ok: true, result: occtToMeshData(result) }
  } catch (e) {
    if (e instanceof CadLimitError) return { ok: false, error: e.message, limit: true }
    let detail = ''
    if (e instanceof Error) detail = e.message
    return { ok: false, error: stepFormatError(extension, detail) }
  }
}
