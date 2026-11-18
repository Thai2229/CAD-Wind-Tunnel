export const ACCEPTED_EXTENSIONS = ['.stl', '.obj', '.glb', '.ply']
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export type UploadResult<F extends { name: string; size: number } = { name: string; size: number }> =
  | { ok: true; file: F; extension: string }
  | { ok: false; error: string }

export function validateUpload<F extends { name: string; size: number }>(
  _files: ArrayLike<F>,
): UploadResult<F> {
  throw new Error('not implemented')
}
