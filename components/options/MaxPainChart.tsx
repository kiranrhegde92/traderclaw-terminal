'use client'
import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { Target } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SYMBOLS = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY']

function formatCompact(n: number): string {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e7) return `${(n/1e7).toFixed(1)}Cr`
  if (Math.abs(n) >= 1e5) return `${(n/1e5).toFixed(1)}L`
  if (Math.abs(n) >= 1e3) return `${(n/1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-IN')
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function MaxPainBarChart({
  strikes, maxPain, spot,
}: {
  strikes: any[]
  maxPain: number
  spot:    number
}) {
  const W = 600, H = 140, padLeft = 60, padRight = 16, padTop = 12, padBottom = 30
  const innerW = W - padLeft - padRight
  const innerH = H - padTop - padBottom

  const filtered = useMemo(() => {
    if (!strikes.length) return []
    // Show ±15 strikes around ATM/max-pain
    const center = spot || maxPain
    const sorted = [...strikes].sort((a, b) => a.strike - b.strike)
    const idx    = sorted.findIndex(s => Math.abs(s.strike - center) === Math.min(...sorted.map(ss => Math.abs(ss.strike - center))))
    return sorted.slice(Math.max(0, idx - 12), idx + 13)
  }, [strikes, spot, maxPain])

  if (!filtered.length) return null

  const maxOI    = Math.max(...filtered.map(s => Math.max(s.callOI, s.putOI)), 1)
  const barWidth = innerW / filtered.length

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = padTop + innerH * (1 - f)
        return (
          <g key={f}>
            <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="var(--border)" strokeWidth={0.5} />
            <text x={padLeft - 4} y={y + 4} fontSize={8} fill="var(--text-dim)" textAnchor="end">
              {formatCompact(maxOI * f)}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {filtered.map((s, i) => {
        const x        = padLeft + i * barWidth
        const ceH      = (s.callOI / maxOI) * innerH
        const peH      = (s.putOI  / maxOI) * innerH
        const isMP     = s.strike === maxPain
        const isSpot   = Math.abs(s.strike - spot) === Math.min(...filtered.map(f => Math.abs(f.strike - spot)))
        const bw       = barWidth * 0.42

        return (
          <g key={s.strike}>
            {/* Call OI bar */}
            <rect
              x={x + barWidth * 0.03} y={padTop + innerH - ceH}
              width={bw} height={ceH}
              fill={isMP ? 'rgba(255,183,0,0.6)' : 'rgba(255,0,64,0.5)'}
            />
            {/* Put OI bar */}
            <rect
              x={x + barWidth * 0.5} y={padTop + innerH - peH}
              width={bw} height={peH}
              fill={isMP ? 'rgba(255,183,0,0.6)' : 'rgba(0,255,65,0.45)'}
            />
            {/* Strike label */}
            <text
              x={x + barWidth / 2} y={H - 4}
              fontSize={isMP || isSpot ? 8.5 : 7.5}
              fontWeight={isMP || isSpot ? 700 : 400}
              fill={isMP ? 'var(--amber)' : isSpot ? 'var(--cyan)' : 'var(--text-dim)'}
              textAnchor="middle"
              fontFamily="JetBrains Mono"
            >
              {s.strike >= 1000 ? (s.strike / 1000).toFixed(1) + 'k' : s.strike}
            </text>
          </g>
        )
      })}

      {/* Max Pain line */}
      {(() => {
        const mpIdx = filtered.findIndex(s => s.strike === maxPain)
        if (mpIdx < 0) return null
        const x = padLeft + mpIdx * barWidth + barWidth / 2
        return (
          <g>
            <line x1={x} y1={padTop} x2={x} y2={H - padBottom} stroke="var(--amber)" strokeWidth={2} strokeDasharray="4,3" />
            <text x={x + 4} y={padTop + 10} fontSize={9} fill="var(--amber)" fontFamily="JetBrains Mono">MP</text>
          </g>
        )
      })()}

      {/* Spot line */}
      {(() => {
        if (!spot) return null
        const spotIdx = filtered.reduce((best, s, i) =>
          Math.abs(s.strike - spot) < Math.abs(filtered[best].strike - spot) ? i : best, 0)
        const x = padLeft + spotIdx * barWidth + barWidth / 2
        return (
          <g>
            <line x1={x} y1={padTop} x2={x} y2={H - padBottom} stroke="var(--cyan)" strokeWidth={1.5} />
            <text x={x + 4} y={padTop + 20} fontSize={9} fill="var(--cyan)" fontFamily="JetBrains Mono">Spot</text>
          </g>
        )
      })()}

      {/* Legend */}
      <rect x={padLeft}     y={padTop - 10} width={8} height={6} fill="rgba(255,0,64,0.5)" />
      <text x={padLeft+10}  y={padTop - 4}  fontSize={8} fill="var(--red)"  >Call OI</text>
      <rect x={padLeft+60}  y={padTop - 10} width={8} height={6} fill="rgba(0,255,65,0.45)" />
      <text x={padLeft+70}  y={padTop - 4}  fontSize={8} fill="var(--green)">Put OI</text>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MaxPainChart({ defaultSymbol = 'NIFTY' }: { defaultSymbol?: string }) {
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [expiry, setExpiry] = useState('')

  const url     = `/api/options/max-pain?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}`
  const { data, isLoading } = useSWR(url, fetcher, { refreshInterval: 5 * 60 * 1000 })

  useEffect(() => {
    if (data?.expiries?.length && !expiry) {
      setExpiry(data.expiries[0])
    }
  }, [data, expiry])

  useEffect(() => { setExpiry('') }, [symbol])

  const maxPain    = data?.maxPain ?? 0
  const spot       = data?.currentSpot ?? 0
  const deviation  = data?.deviation ?? 0
  const devPct     = data?.deviationPct ?? 0
  const strikes    = data?.strikes ?? []
  const expiries   = data?.expiries ?? []

  const devColor   = deviation === 0 ? 'var(--text-muted)' : deviation > 0 ? 'var(--green)' : 'var(--red)'
  const devLabel   = deviation > 0 ? `+${deviation.toFixed(0)} above Max Pain` : deviation < 0 ? `${deviation.toFixed(0)} below Max Pain` : 'at Max Pain'

  return (
    <TerminalCard title="Max Pain Calculator" icon={<Target size={12}/>} accent="amber"
      action={
        <div className="flex gap-2 items-center">
          <select value={symbol} onChange={e => setSymbol(e.target.value)} className="term-select" style={{ fontSize: 11 }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={expiry} onChange={e => setExpiry(e.target.value)} className="term-select" style={{ fontSize: 11 }}>
            {expiries.map((e: string) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      }>

      {isLoading && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Calculating max pain...</div>
      )}

      {!isLoading && data?.error && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>{data.error}</div>
      )}

      {!isLoading && !data?.error && maxPain > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Max Pain</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>
                ₹{maxPain.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current Spot</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: 'var(--cyan)' }}>
                ₹{spot.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Deviation</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: devColor }}>
                {devPct > 0 ? '+' : ''}{devPct.toFixed(2)}%
              </div>
              <div style={{ fontSize: 10, color: devColor }}>{devLabel}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Expiry</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text)' }}>{data?.expiry ?? '—'}</div>
            </div>
          </div>

          {/* Bar chart */}
          <div style={{ overflowX: 'auto' }}>
            <MaxPainBarChart strikes={strikes} maxPain={maxPain} spot={spot} />
          </div>
        </div>
      )}
    </TerminalCard>
  )
}
