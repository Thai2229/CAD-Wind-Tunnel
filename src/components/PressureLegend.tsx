import { CP_MAX, CP_MIN, cpColor } from '../lib/cpColor'

const stops = Array.from({ length: 12 }, (_, i) => {
  const cp = CP_MIN + (i / 11) * (CP_MAX - CP_MIN)
  const [r, g, b] = cpColor(cp)
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}) ${Math.round((i / 11) * 100)}%`
})

export function PressureLegend() {
  return (
    <div className="legend">
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <div className="legend-ticks num">
        <span>{CP_MIN}</span>
        <span>0</span>
        <span>{CP_MAX}</span>
      </div>
      <div className="legend-caption">Cp: suction (blue), freestream (pale), stagnation (red)</div>
      <div className="legend-caption">The leeward side also reads high Cp because potential flow has no wake. That is not real.</div>
    </div>
  )
}
