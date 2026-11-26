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
export function occtToMeshData(result: OcctResult): OcctMeshData[] {
  const out: OcctMeshData[] = []
  if (result.success) {
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
