import {
  Box3,
  LoadingManager,
  Matrix4,
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { Vec3 } from './flowField'
import type { LengthUnit } from './aero'
import { SECTION } from './tunnel'
import type { OcctMeshData } from './occtMesh'
import { WorkerCallError, callWorker, type WorkerLike } from './workerClient'
import { READER_LOAD_FAILED, type ParseRequest } from './workerProtocol'

const IDENTITY = new Matrix4()

export type LoadedModel = {
  name: string
  geometries: BufferGeometry[]
  /** bounding-box size in the file's own units */
  rawSize: Vec3
  /** bounding-box size after fitting to the scene */
  displaySize: Vec3
}

export const MAX_VERTICES = 3_000_000
export const MAX_MESHES = 500

// Friendly, user-facing errors; everything else gets a generic "could not read" message.
class ModelError extends Error {}

// Only inline resources are allowed: a model must never trigger a network request.
export function sanitizeResourceUrl(url: string): string {
  const u = url.toLowerCase()
  if (u.startsWith('data:') || u.startsWith('blob:')) return url
  return ''
}

export function assertModelBudget(vertexCounts: number[]): void {
  let total = 0
  for (const n of vertexCounts) total += n
  if (total > MAX_VERTICES || vertexCounts.length > MAX_MESHES) {
    throw new ModelError('This model is too complex for the browser (limit: 3 million vertices, 500 meshes). Simplify or decimate it and try again.')
  }
}

// Caches a successful load; a failed one is forgotten so the next drop retries.
export function retryableOnce<T>(factory: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null
  return () => {
    if (!promise) {
      promise = factory().catch((e: unknown) => {
        promise = null
        throw e
      })
    }
    return promise
  }
}

async function parseCad(file: File, extension: string): Promise<BufferGeometry[]> {
  let data: OcctMeshData[]
  try {
    const bytes = await file.arrayBuffer()
    // fresh worker per file: a failed load is retried on the next drop (the wasm is HTTP-cached)
    const worker = new Worker(new URL('../workers/cadParse.worker.ts', import.meta.url), { type: 'module' })
    data = await callWorker<ParseRequest, OcctMeshData[]>(
      worker as unknown as WorkerLike,
      { extension, bytes },
      { transfer: [bytes] },
    )
  } catch (e) {
    let message = ''
    let kind = ''
    let limit = false
    if (e instanceof WorkerCallError) {
      message = e.message
      kind = e.kind
      limit = e.limit
    }
    if (kind === 'timeout' || limit) throw new ModelError(message)
    if (kind === 'reply' && message !== READER_LOAD_FAILED) throw new ModelError(message)
    console.error(e)
    throw new ModelError('Could not load the STEP/IGES reader. Check your connection and try again.')
  }
  assertModelBudget(data.map((d) => d.positions.length / 3))
  return data.map((d) => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(d.positions, 3))
    if (d.normals) g.setAttribute('normal', new Float32BufferAttribute(d.normals, 3))
    g.setIndex(new Uint32BufferAttribute(d.indices, 1))
    g.rotateX(-Math.PI / 2) // CAD STEP/IGES is Z-up, the scene is Y-up
    return g
  })
}

const CAD_EXTENSIONS = ['.step', '.stp', '.iges', '.igs']

const SUGGESTED_UNIT: Record<string, LengthUnit> = { '.glb': 'm' }

export function suggestedUnit(extension: string): LengthUnit {
  return SUGGESTED_UNIT[extension] || 'mm'
}

function toFloat32(g: BufferGeometry) {
  for (const name of ['position', 'normal']) {
    const a = g.getAttribute(name)
    if (a && !(a.array instanceof Float32Array)) {
      const f = new Float32Array(a.count * 3)
      for (let i = 0; i < a.count; i++) {
        f[i * 3] = a.getX(i)
        f[i * 3 + 1] = a.getY(i)
        f[i * 3 + 2] = a.getZ(i)
      }
      g.setAttribute(name, new Float32BufferAttribute(f, 3))
    }
  }
}

function disposeMaterial(m: Material) {
  for (const v of Object.values(m)) {
    if (v && (v as Texture).isTexture) (v as Texture).dispose()
  }
  m.dispose()
}

// Bakes every mesh's world transform into a geometry, then frees the source scene.
function meshesOf(root: Object3D): BufferGeometry[] {
  const meshes: Mesh[] = []
  root.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o)
  })
  try {
    assertModelBudget(meshes.map((m) => m.geometry.getAttribute('position')?.count || 0))
  } catch (e) {
    for (const m of meshes) {
      m.geometry.dispose()
      for (const mat of [m.material].flat()) disposeMaterial(mat)
    }
    throw e
  }
  root.updateMatrixWorld(true)
  const out: BufferGeometry[] = []
  const seen = new Set<BufferGeometry>()
  for (const m of meshes) {
    // reuse the source geometry only for its first identity-matrix mesh
    const identity = m.matrixWorld.equals(IDENTITY) && !seen.has(m.geometry)
    seen.add(m.geometry)
    let g = m.geometry as BufferGeometry
    if (!identity) g = g.clone()
    toFloat32(g)
    if (!identity) g.applyMatrix4(m.matrixWorld)
    out.push(g)
    // sources we cloned are released; reused ones now belong to the model
    if (!identity && !out.includes(m.geometry)) m.geometry.dispose()
    for (const mat of [m.material].flat()) disposeMaterial(mat)
  }
  return out
}

async function parse(file: File, extension: string): Promise<BufferGeometry[]> {
  if (CAD_EXTENSIONS.includes(extension)) return parseCad(file, extension)
  if (extension === '.obj') {
    return meshesOf(new OBJLoader().parse(await file.text()))
  }
  const buffer = await file.arrayBuffer()
  if (extension === '.stl') {
    const g = new STLLoader().parse(buffer)
    assertModelBudget([g.getAttribute('position').count])
    g.rotateX(-Math.PI / 2) // CAD STL is Z-up, the scene is Y-up
    g.deleteAttribute('normal') // file normals are often zeroed; recompute per face
    return [g]
  }
  if (extension === '.ply') {
    const g = new PLYLoader().parse(buffer)
    const count = g.getAttribute('position')?.count || 0
    assertModelBudget([count])
    // PLYLoader only sets an index when the file has faces
    const index = g.getIndex()
    if (count === 0 || !index || index.count < 3) {
      throw new ModelError(`"${file.name}" has no faces. Point clouds are not supported; use a meshed PLY.`)
    }
    g.rotateX(-Math.PI / 2) // treated as Z-up like STL
    return [g]
  }
  const manager = new LoadingManager()
  manager.setURLModifier(sanitizeResourceUrl)
  const gltf = await new GLTFLoader(manager).parseAsync(buffer, '')
  return meshesOf(gltf.scene)
}

export async function loadModel(file: File, extension: string): Promise<LoadedModel> {
  let geometries: BufferGeometry[]
  try {
    geometries = await parse(file, extension)
  } catch (e) {
    if (e instanceof ModelError) throw e
    console.error(e)
    let hint = ''
    let detail = ''
    if (e instanceof Error) detail = e.message
    if (/draco|meshopt/i.test(detail)) {
      hint = " Compressed (Draco/meshopt) GLB isn't supported yet."
    }
    throw new Error(`Could not read "${file.name}". The file may be corrupt or not a valid ${extension.slice(1).toUpperCase()}.${hint}`)
  }
  geometries = geometries.filter((g) => g.getAttribute('position')?.count)
  if (geometries.length === 0) {
    throw new Error(`"${file.name}" contains no surface geometry to display.`)
  }

  const box = new Box3()
  for (const g of geometries) {
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    g.computeBoundingBox()
    box.union(g.boundingBox!)
  }
  const size = box.getSize(new Vector3())
  const max = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`"${file.name}" has no measurable size.`)
  }

  // Rest on the turntable, centered, and fit to ~40% of the section (and inside its walls).
  const scale = Math.min(
    (0.4 * SECTION.L) / max,
    (0.6 * SECTION.H) / (size.y || Infinity),
    (0.7 * SECTION.W) / (Math.hypot(size.x, size.z) || Infinity),
  )
  const center = box.getCenter(new Vector3())
  for (const g of geometries) {
    g.translate(-center.x, -box.min.y, -center.z)
    g.scale(scale, scale, scale)
    g.computeBoundingBox()
    g.computeBoundingSphere()
    const count = g.getAttribute('position').count
    g.setAttribute('color', new Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3))
  }

  return {
    name: file.name,
    geometries,
    rawSize: [size.x, size.y, size.z],
    displaySize: [size.x * scale, size.y * scale, size.z * scale],
  }
}
