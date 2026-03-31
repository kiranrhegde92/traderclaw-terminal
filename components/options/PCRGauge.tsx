'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { BarChart2 } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Gauge arc SVG ─────────────────────────────────────────────────────────────
function GaugeArc({ pcr, color }: { pcr: number; color: string }) {
  // Arc spans from 180° to 0° (half-circle), value 0–2 mapped to 0–180°
  const clampedPCR = Math.min(Math.max(pcr, 0), 2)
  const angleDeg   = (clampedPCR / 2) * 180
  const angleRad   = ((180 - angleDeg) * Math.PI) / 180

  const cx = 80, cy = 80, r = 60
  const needleX = cx + r * Math.cos(angleRad)
  const needleY = cy - r * Math.sin(angleRad)

  // Background arc segments: red 0-0.7, amber 0.7-1.0, cyan 1.0-1.3, green 1.3-2.0
  function arcPath(startVal: number, endVal: number): string {
    const startAngle = ((180 - (startVal / 2) * 180) * Math.PI) / 180
    const endAngle   = ((180 - (endVal   / 2) * 180) * Math.PI) / 180
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy - r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy - r * Math.sin(endAngle)
    const largeArc = Math.abs(endVal - startVal) > 1 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const segments = [
    { start: 0,   end: 0.7, color: '#ff0040' },
    { start: 0.7, end: 1.0, color: '#ffb700' },
    { start: 1.0, end: 1.3, color: '#00e5ff' },
    { start: 1.3, end: 2.0, color: '#00ff41' },
  ]

  return (
    <svg width={160} height={96} viewBox="0 0 160 96">
      {/* Track */}
      <path d={`M 20 80 A 60 60 0 0 1 140 80`} fill="none" stroke="var(--border)" strokeWidth={8} strokeLinecap="round" />
      {/* Colored segments */}
      {segments.map((s, i) => (
        <path key={i} d={arcPath(s.start, s.end)} fill="none" stroke={s.color} strokeWidth={8} strokeLinecap="butt" opacity={0.35} />
      ))}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={color} />
      {/* Labels */}
      <text x={18}  y={94} fontSize={9} fill="var(--red)"   fontFamily="JetBrains Mono">0</text>
      <text x={73}  y={20} fontSize={9} fill="var(--text-muted)"  fontFamily="JetBrains Mono">1.0</text>
      <text x={130} y={94} fontSize={9} fill="var(--green)" fontFamily="JetBrains Mono">2+</text>
    </svg>
  )
}

// ── Mini line chart ───────────────────────────────────────────────────────────
function PCRLineChart({ data, symbol }: { data: any[]; symbol: string }) {
  const filtered = useMemo(() => data.filter(d => d.symbol === symbol), [data, symbol])
  if (filtered.length < 2) return <div style={{ color: 'var(--text-dim)', fontSize: 11, padding: '8px 0' }}>Not enough history</div>

  const values = filtered.map(d => d.pcr_oi)
  const min    = Math.min(...values)
  const max    = Math.max(...values)
  const range  = max - min || 1

  const W = 300, H = 60, padX = 8, padY = 6
  const points = filtered.map((d, i) => {
    const x = padX + (i / (filtered.length - 1)) * (W - 2 * padX)
    const y = padY + (1 - (d.pcr_oi - min) / range) * (H - 2 * padY)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* 1.0 reference line */}
      {min < 1.0 && max > 1.0 && (
        <line
          x1={padX} y1={padY + (1 - (1.0 - min) / range) * (H - 2 * padY)}
          x2={W - padX} y2={padY + (1 - (1.0 - min) / range) * (H - 2 * padY)}
          stroke="rgba(255,183,0,0.3)" strokeWidth={1} strokeDasharray="3,3"
        />
      )}
      <polyline points={points} fill="none" stroke="var(--cyan)" strokeWidth={1.5} />
      {filtered.map((d, i) => {
        const x = padX + (i / (filtered.length - 1)) * (W - 2 * padX)
        const y = padY + (1 - (d.pcr_oi - min) / range) * (H - 2 * padY)
        return <circle key={i} cx={x} cy={y} r={2} fill="var(--cyan)" />
      })}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PCRGauge() {
  const [activeSymbol, setActiveSymbol] = useState<'nifty' | 'banknifty'>('nifty')
  const { data, isLoading } = useSWR('/api/options/pcr', fetcher, { refreshInterval: 5 * 60 * 1000 })

  const symData = data?.[activeSymbol]
  const history = data?.history ?? []

  function pcrColor(pcr: number): string {
    if (!pcr) return 'var(--text-muted)'
    if (pcr < 0.7)  return 'var(--red)'
    if (pcr < 1.0)  return 'var(--amber)'
    if (pcr <= 1.3) return 'var(--cyan)'
    return 'var(--green)'
  }

  const color    = symData ? pcrColor(symData.pcrOI) : 'var(--text-muted)'
  const sentiment = symData?.sentiment ?? '—'

  return (
    <TerminalCard title="PCR Tracker" icon={<BarChart2 size={12}/>} accent="cyan"
      action={
        <div className="flex gap-1">
          {(['nifty', 'banknifty'] as const).map(s => (
            <button key={s} onClick={() => setActiveSymbol(s)}
              style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10,
                fontFamily: 'JetBrains Mono', cursor: 'pointer',
                background: activeSymbol === s ? 'rgba(0,229,255,0.15)' : 'transparent',
                border: `1px solid ${activeSymbol === s ? 'var(--cyan)' : 'var(--border)'}`,
                color: activeSymbol === s ? 'var(--cyan)' : 'var(--text-muted)',
              }}>
              {s === 'nifty' ? 'NIFTY' : 'BANKNIFTY'}
            </button>
          ))}
        </div>
      }>

      {isLoading && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Loading PCR data...</div>
      )}

      {!isLoading && !symData && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>Failed to load PCR data</div>
      )}

      {!isLoading && symData && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Gauge + numbers */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 160 }}>
            <GaugeArc pcr={symData.pcrOI} color={color} />
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
              {symData.pcrOI.toFixed(2)}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600,
              padding: '2px 10px', borderRadius: 4,
              background: `${color}22`,
              border: `1px solid ${color}66`,
              color,
            }}>
              {sentiment}
            </div>
            <div className="flex gap-3" style={{ marginTop: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>PCR OI</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color }}>{symData.pcrOI.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>PCR Vol</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--text)' }}>{symData.pcrVol.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Spot</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: 'var(--text)' }}>
                  {symData.spot > 0 ? symData.spot.toLocaleString('en-IN') : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Historical chart */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              PCR OI — Last 10 Trading Days
            </div>
            <PCRLineChart data={history} symbol={activeSymbol === 'nifty' ? 'NIFTY' : 'BANKNIFTY'} />
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9, color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--red)'  }}>■ &lt;0.7 Bearish</span>
              <span style={{ color: 'var(--amber)'}}>■ 0.7–1.0 Neutral</span>
              <span style={{ color: 'var(--cyan)' }}>■ 1.0–1.3 Bullish</span>
              <span style={{ color: 'var(--green)'}}>■ &gt;1.3 Extreme</span>
            </div>
          </div>
        </div>
      )}
    </TerminalCard>
  )
}
