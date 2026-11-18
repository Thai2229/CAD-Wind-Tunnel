import { useState } from 'react'
import type { LengthUnit } from '../lib/aero'
import { PressureLegend } from './PressureLegend'

export type Readouts = {
  size: string
  frontalArea: string
  dynamicPressure: string
  drag: string
  reynolds: string
}

type Props = {
  fileName: string | null
  onRemove: () => void
  onBrowse: () => void
  speed: number
  setSpeed: (v: number) => void
  yaw: number
  setYaw: (v: number) => void
  unit: LengthUnit
  setUnit: (u: LengthUnit) => void
  cd: number
  setCd: (v: number) => void
  showStreamlines: boolean
  setShowStreamlines: (v: boolean) => void
  showParticles: boolean
  setShowParticles: (v: boolean) => void
  showPressure: boolean
  setShowPressure: (v: boolean) => void
  readouts: Readouts
}

type SliderProps = {
  id: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}

type NumberInputProps = {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  id?: string
  label?: string
}

// Keeps the typed text locally so the field can be cleared while typing.
function NumberInput({ value, min, max, step, onChange, id, label }: NumberInputProps) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      type="number"
      className="num"
      id={id}
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw !== '' && Number.isFinite(Number(raw))) onChange(Math.min(max, Math.max(min, Number(raw))))
      }}
      onBlur={() => setText(null)}
    />
  )
}

function SliderField({ id, label, unit, min, max, step, value, onChange }: SliderProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        <input type="range" id={id} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <NumberInput value={value} min={min} max={max} step={step} onChange={onChange} label={`${label} value`} />
        <span className="unit num">{unit}</span>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function ControlPanel(p: Props) {
  const rows: [string, string, string][] = [
    ['Model size', p.readouts.size, 'm'],
    ['Frontal area', p.readouts.frontalArea, 'm²'],
    ['Dynamic pressure', p.readouts.dynamicPressure, 'Pa'],
    ['Est. drag', p.readouts.drag, 'N'],
    ['Reynolds number', p.readouts.reynolds, ''],
  ]
  return (
    <aside className="panel">
      <header className="panel-head">
        <h1>CAD Wind Tunnel</h1>
        <p>Low-speed test section, +X flow</p>
      </header>

      <section className="group">
        <h2>Model</h2>
        {p.fileName && (
          <div className="file">
            <span className="file-name" title={p.fileName}>
              {p.fileName}
            </span>
            <button type="button" className="btn" onClick={p.onBrowse}>
              Replace
            </button>
            <button type="button" className="btn" onClick={p.onRemove}>
              Remove
            </button>
          </div>
        )}
        {!p.fileName && <p className="muted">No model loaded.</p>}
        <div className="field">
          <label htmlFor="unit">Model units</label>
          <select id="unit" value={p.unit} onChange={(e) => p.setUnit(e.target.value as LengthUnit)}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
            <option value="in">in</option>
          </select>
        </div>
      </section>

      <section className="group">
        <h2>Test conditions</h2>
        <SliderField id="speed" label="Wind speed" unit="m/s" min={0} max={60} step={1} value={p.speed} onChange={p.setSpeed} />
        <SliderField id="yaw" label="Yaw angle" unit="deg" min={-90} max={90} step={1} value={p.yaw} onChange={p.setYaw} />
        <div className="field">
          <label htmlFor="cd">Drag coefficient Cd</label>
          <NumberInput id="cd" value={p.cd} min={0} max={Infinity} step={0.05} onChange={p.setCd} />
          <p className="hint">Estimate, e.g. 0.3 car, 1.0 bluff body</p>
        </div>
      </section>

      <section className="group">
        <h2>Flow visualization</h2>
        <Toggle label="Smoke streamlines" checked={p.showStreamlines} onChange={p.setShowStreamlines} />
        <Toggle label="Particles" checked={p.showParticles} onChange={p.setShowParticles} />
        <Toggle label="Pressure map" checked={p.showPressure} onChange={p.setShowPressure} />
        <PressureLegend />
      </section>

      <section className="group">
        <h2>Readouts</h2>
        <dl className="readouts">
          {rows.map(([name, value, unit]) => (
            <div key={name} className="readout">
              <dt>{name}</dt>
              <dd className="num">
                {value}
                {unit && <small>{unit}</small>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="disclaimer">
        Approximate potential-flow visualization around a fitted ellipsoid. Not CFD; do not use for engineering decisions.
      </p>
    </aside>
  )
}
