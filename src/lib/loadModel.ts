import {
  Box3,
  Float32BufferAttribute,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { Vec3 } from './flowField'
import { SECTION } from './tunnel'

export type LoadedModel = {
  name: string
  geometries: BufferGeometry[]
  /** bounding-box size in the file's own units */
  rawSize: Vec3
  /** bounding-box size after fitting to the scene */
  displaySize: Vec3
}

function meshesOf(root: Object3D): BufferGeometry[] {
  const out: BufferGeometry[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const g = (o.geometry as BufferGeometry).clone()
      g.applyMatrix4(o.matrixWorld)
      out.push(g)
    }
  })
  return out
}

async function parse(file: File, extension: string): Promise<BufferGeometry[]> {
  if (extension === '.obj') {
    return meshesOf(new OBJLoader().parse(await file.text()))
  }
  const buffer = await file.arrayBuffer()
  if (extension === '.stl') {
    const g = new STLLoader().parse(buffer)
    g.rotateX(-Math.PI / 2) // CAD STL is Z-up, the scene is Y-up
    g.deleteAttribute('normal') // file normals are often zeroed; recompute per face
    return [g]
  }
  if (extension === '.ply') {
    return [new PLYLoader().parse(buffer)]
  }
  const gltf = await new GLTFLoader().parseAsync(buffer, '')
  return meshesOf(gltf.scene)
}

export async function loadModel(file: File, extension: string): Promise<LoadedModel> {
  let geometries: BufferGeometry[]
  try {
    geometries = await parse(file, extension)
  } catch {
    throw new Error(`Could not read "${file.name}". The file may be corrupt or not a valid ${extension.slice(1).toUpperCase()}.`)
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
