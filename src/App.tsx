import { useMemo, useRef, useState, type DragEvent } from 'react'
import { TURNTABLE_TOP } from './lib/tunnel'
import { TunnelScene } from './components/TunnelScene'
import { ControlPanel, type Readouts } from './components/ControlPanel'
import { UploadOverlay } from './components/UploadOverlay'
import { dragForce, dynamicPressure, frontalAreaFromBox, reynoldsNumber, unitToMeters, type LengthUnit } from './lib/aero'
import type { Obstacle, Vec3 } from './lib/flowField'
import { loadModel, suggestedUnit, type LoadedModel } from './lib/loadModel'
import { validateUpload } from './lib/validateUpload'
import { cx } from './lib/cx'
import './App.css'

// No model: a negligible obstacle far from the flow gives uniform straight streams.
const NO_OBSTACLE: Obstacle = { center: [0, -100, 0], halfExtents: [0.01, 0.01, 0.01] }

function fmt(n: number, digits: number): string {
  return n.toFixed(digits)
}

export default function App() {
  const [model, setModel] = useState<LoadedModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [speed, setSpeed] = useState(25)
  const [yaw, setYaw] = useState(0)
  const [unit, setUnit] = useState<LengthUnit>('mm')
  const [cd, setCd] = useState(1)
  const [showStreamlines, setShowStreamlines] = useState(true)
  const [showParticles, setShowParticles] = useState(true)
  const [showPressure, setShowPressure] = useState(true)
  const input = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)

  const handleFiles = async (files: ArrayLike<File>) => {
    const result = validateUpload(files)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setLoading(true)
    requestId.current += 1
    const id = requestId.current
    try {
      const loaded = await loadModel(result.file, result.extension)
      if (id !== requestId.current) return
      setModel(loaded)
      setUnit(suggestedUnit(result.extension))
    } catch (e) {
      if (id !== requestId.current) return
      let message = 'Could not read this file.'
      if (e instanceof Error) message = e.message
      setError(message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void handleFiles(e.dataTransfer.files)
  }

  const yawRad = (yaw * Math.PI) / 180
  const obstacle = useMemo<Obstacle>(() => {
    if (!model) return NO_OBSTACLE
    const [sx, sy, sz] = model.displaySize
    const c = Math.abs(Math.cos(yawRad))
    const s = Math.abs(Math.sin(yawRad))
    const half: Vec3 = [(sx * c + sz * s) / 2, sy / 2, (sx * s + sz * c) / 2]
    // flat models keep a tiny thickness so the flow field stays finite
    const min = Math.max(1e-3 * Math.max(...half), 1e-6)
    const clamped: Vec3 = [Math.max(half[0], min), Math.max(half[1], min), Math.max(half[2], min)]
    return { center: [0, sy / 2 + TURNTABLE_TOP, 0], halfExtents: clamped }
  }, [model, yawRad])

  const q = dynamicPressure(speed)
  let readouts: Readouts = { size: '—', frontalArea: '—', dynamicPressure: fmt(q, 1), drag: '—', reynolds: '—' }
  if (model) {
    const k = unitToMeters(unit)
    const size: Vec3 = [model.rawSize[0] * k, model.rawSize[1] * k, model.rawSize[2] * k]
    const area = frontalAreaFromBox(size, yaw)
    const length = size[0] * Math.abs(Math.cos(yawRad)) + size[2] * Math.abs(Math.sin(yawRad))
    readouts = {
      size: size.map((v) => fmt(v, 3)).join(' × '),
      frontalArea: fmt(area, 4),
      dynamicPressure: fmt(q, 1),
      drag: fmt(dragForce({ speed, cd, frontalArea: area }), 2),
      reynolds: reynoldsNumber(speed, length).toExponential(2),
    }
  }

  return (
    <div className="app">
      <main
        className={cx('viewport', dragging && 'is-dragging')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <TunnelScene
          model={model}
          obstacle={obstacle}
          speed={speed}
          yaw={yawRad}
          showStreamlines={showStreamlines}
          showParticles={showParticles}
          showPressure={showPressure}
        />
        <UploadOverlay
          hasModel={model !== null}
          loading={loading}
          error={error}
          dragging={dragging}
          onBrowse={() => input.current?.click()}
        />
        <input
          ref={input}
          type="file"
          hidden
          accept=".stl,.obj,.glb,.ply"
          onChange={(e) => {
            void handleFiles(e.target.files ?? [])
            e.target.value = ''
          }}
        />
      </main>
      <ControlPanel
        fileName={model && model.name}
        onRemove={() => {
          requestId.current += 1
          setLoading(false)
          setModel(null)
          setError(null)
        }}
        onBrowse={() => input.current?.click()}
        speed={speed}
        setSpeed={setSpeed}
        yaw={yaw}
        setYaw={setYaw}
        unit={unit}
        setUnit={setUnit}
        cd={cd}
        setCd={setCd}
        showStreamlines={showStreamlines}
        setShowStreamlines={setShowStreamlines}
        showParticles={showParticles}
        setShowParticles={setShowParticles}
        showPressure={showPressure}
        setShowPressure={setShowPressure}
        readouts={readouts}
      />
    </div>
  )
}
