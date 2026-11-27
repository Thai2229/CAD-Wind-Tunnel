export type OcctResult = {
  success: boolean
  meshes: {
    name?: string
    attributes: { position: { array: number[] }; normal?: { array: number[] } }
    index: { array: number[] }
  }[]
}

export type OcctMeshData = {
  positions: Float32Array
  normals: Float32Array | null
  indices: Uint32Array
}

// Converts occt-import-js output to typed arrays, dropping empty meshes.
export const MAX_CAD_TRIANGLES = 3_000_000
export const MAX_CAD_MESHES = 500

// Thrown for models over the budget; shown to the user as is.
export class CadLimitError extends Error {}

export type OcctLimits = { maxTriangles: number; maxMeshes: number }

export function occtToMeshData(
  result: OcctResult,
  limits: OcctLimits = { maxTriangles: MAX_CAD_TRIANGLES, maxMeshes: MAX_CAD_MESHES },
): OcctMeshData[] {
  const out: OcctMeshData[] = []
  // a failed read can come back without a meshes array
  if (result.success && Array.isArray(result.meshes)) {
    // check sizes from .length alone, before any copy
    let triangles = 0
    for (const m of result.meshes) triangles += m.index.array.length / 3
    if (result.meshes.length > limits.maxMeshes || triangles > limits.maxTriangles) {
      throw new CadLimitError('This CAD model is too complex for the browser. Simplify it or export a coarser model and try again.')
    }
    for (const m of result.meshes) {
      if (m.index.array.length === 0 || m.attributes.position.array.length === 0) continue
      const positions = Float32Array.from(m.attributes.position.array)
      let normals: Float32Array | null = null
      const n = m.attributes.normal
      if (n && n.array.length === positions.length) normals = Float32Array.from(n.array)
      out.push({ positions, normals, indices: Uint32Array.from(m.index.array) })
    }
  }
  if (out.length === 0) throw new Error('Could not read any geometry from this CAD file.')
  return out
}

const FORMAT_NAME: Record<string, string> = {
  '.step': 'STEP',
  '.stp': 'STEP',
  '.iges': 'IGES',
  '.igs': 'IGES',
}

export function stepFormatError(extension: string, message: string): string {
  const name = FORMAT_NAME[extension] || 'CAD'
  return `Could not read this ${name} file. It may be corrupt or use unsupported features. ${message}`
}
