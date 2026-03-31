'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { Flame } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SYMBOLS = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY']

// ── IV → heat color ───────────────────────────────────────────────────────────
function ivHeatColor(iv: number | null, minIV: number, maxIV: number): string {
  if (iv == null) return 'rgba(255,255,255,0.04)'
  const range = maxIV - minIV || 1
  const t     = Math.min(Math.max((iv - minIV) / range, 0), 1)
  // green(low) → amber(mid) → red(high)
  if (t < 0.5) {
    const f = t * 2
    const r = Math.round(0   + f * 255)
    const g = Math.round(255 - f * 72)
    return `rgba(${r},${g},0,0.75)`
  } else {
    const f = (t - 0.5) * 2
    const g = Math.round(183 - f * 183)
    return `rgba(255,${g},0,0.75)`
  }
}

function shortExpiry(exp: string): string {
  // "25-Jan-2024" → "25Jan" or "DD-MMM-YYYY" → "DDMon"
  const parts = exp.split('-')
  if (parts.length >= 2) return `${parts[0]}${parts[1].slice(0,3)}`
  return exp.slice(0, 6)
}

// ── Term structure chart ──────────────────────────────────────────────────────
function TermStructureChart({ termStructure }: { termStructure: any[] }) {
  const valid = termStructure.filter(t => t.atmIV != null && t.dte > 0)
  if (valid.length < 2) return <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Not enough data</div>

  const W = 280, H = 80, padX = 28, padY = 10
  const minDTE = Math.min(...valid.map(t => t.dte))
  const maxDTE = Math.max(...valid.map(t => t.dte))
  const minIV  = Math.min(...valid.map(t => t.atmIV!)) - 1
  const maxIV  = Math.max(...valid.map(t => t.atmIV!)) + 1
  const dteRange = maxDTE - minDTE || 1
  const ivRange  = maxIV - minIV || 1

  const points = valid.map(t => {
    const x = padX + ((t.dte - minDTE) / dteRange) * (W - 2 * padX)
    const y = padY + (1 - (t.atmIV! - minIV) / ivRange) * (H - 2 * padY)
    return { x, y, dte: t.dte, atmIV: t.atmIV, expiry: t.expiry }
  })

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--cyan)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--cyan)" />
          <text x={p.x} y={H - 2} fontSize={8} fill="var(--text-dim)" textAnchor="middle">{p.dte}d</text>
          <text x={p.x} y={p.y - 5} fontSize={8} fill="var(--cyan)" textAnchor="middle">{p.atmIV?.toFixed(1)}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Heatmap grid ──────────────────────────────────────────────────────────────
function HeatmapGrid({ surface, expiries, atmStrike }: { surface: any[]; expiries: string[]; atmStrike: number }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const strikes = useMemo(() => {
    const s = [...new Set(surface.map(d => d.strike as number))].sort((a, b) => a - b)
    return s
  }, [surface])

  const allIVs = surface.map(d => d.avgIV).filter((v): v is number => v != null)
  const minIV  = allIVs.length ? Math.min(...allIVs) : 0
  const maxIV  = allIVs.length ? Math.max(...allIVs) : 50

  const cellW  = 70, cellH = 28

  if (!strikes.length || !expiries.length) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>No surface data</div>
  }

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontFamily: 'JetBrains Mono', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', color: 'var(--text-dim)', textAlign: 'right', minWidth: 70, fontSize: 10 }}>Strike</th>
            {expiries.map(exp => (
              <th key={exp} style={{ padding: '4px 8px', color: 'var(--cyan)', textAlign: 'center', minWidth: cellW, fontSize: 10 }}>
                {shortExpiry(exp)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...strikes].reverse().map(strike => {
            const isATM = strike === atmStrike
            return (
              <tr key={strike}>
                <td style={{
                  padding: '4px 8px', textAlign: 'right',
                  color: isATM ? 'var(--amber)' : 'var(--text-muted)',
                  fontWeight: isATM ? 700 : 400,
                  borderRight: isATM ? '2px solid rgba(255,183,0,0.4)' : undefined,
                }}>
                  {strike.toLocaleString('en-IN')}
                  {isATM && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--amber)' }}>ATM</span>}
                </td>
                {expiries.map(exp => {
                  const cell = surface.find(d => d.expiry === exp && d.strike === strike)
                  const iv   = cell?.avgIV ?? null
                  const bg   = ivHeatColor(iv, minIV, maxIV)
                  return (
                    <td key={exp}
                      style={{
                        padding: '4px 6px', textAlign: 'center',
                        background: bg,
                        borderRadius: 3, cursor: 'default',
                        color: iv != null ? '#fff' : 'var(--text-dim)',
                        minWidth: cellW, height: cellH,
                        border: isATM ? '1px solid rgba(255,183,0,0.3)' : '1px solid transparent',
                      }}
                      onMouseEnter={e => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                          text: iv != null
                            ? `${strike} ${shortExpiry(exp)}\nCE: ${cell?.ceIV?.toFixed(1) ?? '—'}%  PE: ${cell?.peIV?.toFixed(1) ?? '—'}%\nAvg: ${iv.toFixed(1)}%`
                            : 'No data',
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}>
                      {iv != null ? `${iv.toFixed(1)}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px', fontSize: 11,
          fontFamily: 'JetBrains Mono', color: 'var(--text)',
          whiteSpace: 'pre', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {tooltip.text}
        </div>
      )}

      {/* IV color scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10 }}>
        <span style={{ color: 'var(--text-dim)' }}>IV:</span>
        <div style={{
          width: 120, height: 10, borderRadius: 3,
          background: 'linear-gradient(to right, rgba(0,255,0,0.6), rgba(255,183,0,0.7), rgba(255,0,0,0.75))',
        }} />
        <span style={{ color: 'var(--green)' }}>Low</span>
        <span style={{ color: 'var(--red)' }}>High</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IVSurface({ defaultSymbol = 'NIFTY' }: { defaultSymbol?: string }) {
  const [symbol, setSymbol] = useState(defaultSymbol)

  const url = `/api/options/iv-surface?symbol=${symbol}`
  const { data, isLoading } = useSWR(url, fetcher, { refreshInterval: 10 * 60 * 1000 })

  const surface     = data?.surface        ?? []
  const expiries    = data?.expiries        ?? []
  const atmStrike   = data?.atmStrike       ?? 0
  const atmIV       = data?.atmIV
  const ivRank      = data?.ivRank
  const ivPercentile= data?.ivPercentile
  const termStructure = data?.termStructure ?? []

  return (
    <TerminalCard title="IV Surface Heatmap" icon={<Flame size={12}/>} accent="red"
      action={
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="term-select" style={{ fontSize: 11 }}>
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      }>

      {isLoading && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Building IV surface...</div>
      )}

      {!isLoading && data?.error && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>{data.error}</div>
      )}

      {!isLoading && !data?.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ATM IV</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 700, color: atmIV != null ? (atmIV > 25 ? 'var(--red)' : atmIV > 15 ? 'var(--amber)' : 'var(--green)') : 'var(--text-dim)' }}>
                {atmIV != null ? `${atmIV.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>IV Rank</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 700, color: ivRank != null ? (ivRank > 70 ? 'var(--red)' : ivRank > 30 ? 'var(--amber)' : 'var(--green)') : 'var(--text-dim)' }}>
                {ivRank != null ? `${ivRank.toFixed(0)}` : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>(0–100, 52-week)</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>IV Percentile</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 700, color: ivPercentile != null ? (ivPercentile > 70 ? 'var(--red)' : ivPercentile > 30 ? 'var(--amber)' : 'var(--green)') : 'var(--text-dim)' }}>
                {ivPercentile != null ? `${ivPercentile.toFixed(0)}%` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Term Structure (ATM IV)</div>
              <TermStructureChart termStructure={termStructure} />
            </div>
          </div>

          {/* Heatmap */}
          <HeatmapGrid surface={surface} expiries={expiries} atmStrike={atmStrike} />
        </div>
      )}
    </TerminalCard>
  )
}
