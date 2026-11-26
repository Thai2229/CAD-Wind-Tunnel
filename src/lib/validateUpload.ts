export const ACCEPTED_EXTENSIONS = ['.stl', '.obj', '.glb', '.ply', '.step', '.stp', '.iges', '.igs']
export const MAX_FILE_BYTES = 50 * 1024 * 1024

export type UploadResult<F extends { name: string; size: number } = { name: string; size: number }> =
  | { ok: true; file: F; extension: string }
  | { ok: false; error: string }

export function validateUpload<F extends { name: string; size: number }>(
  files: ArrayLike<F>,
): UploadResult<F> {
  if (files.length === 0) return { ok: false, error: 'No file selected. Choose an STL, OBJ, GLB, PLY, STEP or IGES file.' }
  if (files.length > 1) return { ok: false, error: 'Upload one model at a time.' }
  const file = files[0]!
  const dot = file.name.lastIndexOf('.')
  const extension = file.name.slice(dot).toLowerCase()
  if (dot < 0 || !ACCEPTED_EXTENSIONS.includes(extension)) {
    return { ok: false, error: `Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(', ')}.` }
  }
  if (file.size === 0) return { ok: false, error: 'This file is empty.' }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'File is too large. The limit is 50 MB.' }
  return { ok: true, file, extension }
}
