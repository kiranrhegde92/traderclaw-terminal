'use client'
import { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import useSWR from 'swr'
import { useSearchParams, useRouter } from 'next/navigation'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { formatPct } from '@/lib/utils/format'
import { Layers, TrendingUp, TrendingDown, Target, BarChart2, Activity } from 'lucide-react'
import Link from 'next/link'
import type { OptionStrike } from '@/types/options'
import PCRGauge from '@/components/options/PCRGauge'
import MaxPainChart from '@/components/options/MaxPainChart'
import GreeksDashboard from '@/components/options/GreeksDashboard'
import IVSurface from '@/components/options/IVSurface'

const SYMBOLS = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY','SENSEX']
const LOT_SIZES: Record<string, number> = {
  NIFTY: 75, BANKNIFTY: 30, FINNIFTY: 65, MIDCPNIFTY: 75, SENSEX: 20,
}
const fetcher  = (url: string) => fetch(url).then(r => r.json())

// ── OI Heatmap helpers ───────────────────────────────────────────────────────
function oiCellStyle(oi: number, maxOI: number, type: 'CE' | 'PE'): React.CSSProperties {
  if (!maxOI || !oi) return {}
  const intensity = Math.min(oi / maxOI, 1)
  const bg = type === 'CE'
    ? `rgba(255,0,64,${(intensity * 0.4).toFixed(3)})`
    : `rgba(0,255,65,${(intensity * 0.4).toFixed(3)})`
  return { backgroundColor: bg, transition: 'background-color 0.3s' }
}

function OIArrow({ change }: { change: number }) {
  if (change == null || change === 0) return null
  return (
    <span style={{ marginLeft: 3, fontSize: 9, color: change > 0 ? 'var(--green)' : 'var(--red)' }}>
      {change > 0 ? '▲' : '▼'}
    </span>
  )
}

// ── Max Pain Calculator ──────────────────────────────────────────────────────
function calcMaxPain(strikes: OptionStrike[], lotSize: number): number | null {
  if (!strikes.length) return null
  const strikePrices = strikes.map(s => s.strikePrice)

  let minPain = Infinity
  let maxPainStrike = strikePrices[0]

  for (const K of strikePrices) {
    let cePain = 0
    let pePain = 0
    for (const row of strikes) {
      const S = row.strikePrice
      // CE writers lose when K > S (stock expired above call strike)
      if (K > S) cePain += (K - S) * row.ce_oi * lotSize
      // PE writers lose when S > K (stock expired below put strike)
      if (S > K) pePain += (S - K) * row.pe_oi * lotSize
    }
    const total = cePain + pePain
    if (total < minPain) {
      minPain = total
      maxPainStrike = K
    }
  }
  return maxPainStrike
}

// ── PCR Chart component ──────────────────────────────────────────────────────
function PCRSection({
  totalCeOI, totalPeOI, pcr, spotPrice, maxPainStrike, symbol,
}: {
  totalCeOI: number; totalPeOI: number; pcr: number
  spotPrice: number; maxPainStrike: number | null; symbol: string
}) {
  const total = totalCeOI + totalPeOI
  const ceWidth = total > 0 ? (totalCeOI / total) * 100 : 50
  const peWidth = total > 0 ? (totalPeOI / total) * 100 : 50

  let pcrLabel = 'Neutral'
  let pcrColor = 'var(--cyan)'
  if (pcr < 0.7) { pcrLabel = 'Bearish'; pcrColor = 'var(--red)' }
  else if (pcr < 1.0) { pcrLabel = 'Slightly Bearish'; pcrColor = 'var(--amber)' }
  else if (pcr <= 1.3) { pcrLabel = 'Neutral'; pcrColor = 'var(--cyan)' }
  else { pcrLabel = 'Bullish'; pcrColor = 'var(--green)' }

  const mpDiff = maxPainStrike != null ? spotPrice - maxPainStrike : null
  const mpDirection = mpDiff != null ? (mpDiff > 0 ? 'above Max Pain' : mpDiff < 0 ? 'below Max Pain' : 'at Max Pain') : null

  return (
    <TerminalCard title="PCR & OI Analysis" icon={<BarChart2 size={12}/>} accent="cyan">
      <div className="space-y-4">

        {/* Row 1: PCR + Max Pain badges */}
        <div className="flex flex-wrap items-center gap-4">
          {/* PCR value */}
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Put/Call Ratio</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color: pcrColor }}>
              {pcr.toFixed(2)}
            </span>
            <span className="badge" style={{
              backgroundColor: `${pcrColor}22`,
              border: `1px solid ${pcrColor}66`,
              color: pcrColor, fontSize: 11, padding: '2px 8px', borderRadius: 4,
            }}>
              {pcrLabel}
            </span>
          </div>

          {/* Max Pain badge */}
          {maxPainStrike != null && (
            <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
              <Target size={12} style={{ color: 'var(--amber)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Max Pain</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--amber)', fontSize: 14 }}>
                ₹{maxPainStrike.toLocaleString('en-IN')}
              </span>
              {mpDiff != null && (
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  ({Math.abs(mpDiff).toFixed(0)} pts {mpDirection})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row 2: CE vs PE bar chart */}
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--red)' }}>CE OI: {formatCompact(totalCeOI)} ({ceWidth.toFixed(1)}%)</span>
            <span style={{ color: 'var(--green)' }}>PE OI: {formatCompact(totalPeOI)} ({peWidth.toFixed(1)}%)</span>
          </div>
          <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{
              width: `${ceWidth}%`,
              background: 'rgba(255,0,64,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontFamily: 'JetBrains Mono',
              transition: 'width 0.5s ease',
            }}>
              {ceWidth > 15 ? 'CE' : ''}
            </div>
            <div style={{
              width: `${peWidth}%`,
              background: 'rgba(0,255,65,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontFamily: 'JetBrains Mono',
              transition: 'width 0.5s ease',
            }}>
              {peWidth > 15 ? 'PE' : ''}
            </div>
          </div>
        </div>

        {/* Row 3: Stats */}
        <div className="flex flex-wrap gap-4 text-xs">
          <StatPill label="Total CE OI" value={formatCompact(totalCeOI)} color="var(--red)" />
          <StatPill label="Total PE OI" value={formatCompact(totalPeOI)} color="var(--green)" />
          <StatPill label="CE/PE Ratio" value={(totalCeOI && totalPeOI ? (totalCeOI / totalPeOI).toFixed(2) : '—')} />
          <StatPill label="PCR Interpretation" value={pcrLabel} color={pcrColor} />
        </div>

        {/* Row 4: OI Heatmap legend */}
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>OI Heatmap Legend:</span>
          <span style={{ background: 'rgba(255,0,64,0.35)', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>■</span>
          <span style={{ fontSize: 10 }}>High CE OI = Resistance</span>
          <span style={{ background: 'rgba(0,255,65,0.35)', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>■</span>
          <span style={{ fontSize: 10 }}>High PE OI = Support</span>
        </div>
      </div>
    </TerminalCard>
  )
}

// ── OI Buildup / Unwinding Panel ─────────────────────────────────────────────
type OISignal = 'Long Buildup' | 'Short Covering' | 'Short Buildup' | 'Long Unwinding'

interface OIEntry {
  strike: number
  type: 'CE' | 'PE'
  signal: OISignal
  changePct: number
  oiChange: number
  oi: number
  ltp: number
}

function classifyOI(changePct: number, oiChange: number): OISignal | null {
  if (!changePct || !oiChange) return null
  if (changePct > 0 && oiChange > 0) return 'Long Buildup'
  if (changePct > 0 && oiChange < 0) return 'Short Covering'
  if (changePct < 0 && oiChange > 0) return 'Short Buildup'
  if (changePct < 0 && oiChange < 0) return 'Long Unwinding'
  return null
}

const SIGNAL_META: Record<OISignal, { color: string; bg: string; desc: string }> = {
  'Long Buildup':    { color: 'var(--green)',  bg: 'rgba(0,255,65,0.08)',   desc: 'Price ↑ + OI ↑ — Bulls adding longs' },
  'Short Covering':  { color: 'var(--cyan)',   bg: 'rgba(0,212,255,0.08)',  desc: 'Price ↑ + OI ↓ — Shorts being closed' },
  'Short Buildup':   { color: 'var(--red)',    bg: 'rgba(255,0,64,0.08)',   desc: 'Price ↓ + OI ↑ — Bears adding shorts' },
  'Long Unwinding':  { color: 'var(--amber)',  bg: 'rgba(255,183,0,0.08)',  desc: 'Price ↓ + OI ↓ — Bulls exiting longs' },
}

function OIBuildupPanel({ strikes, spotPrice }: { strikes: OptionStrike[]; spotPrice: number }) {
  const [filter, setFilter] = useState<OISignal | 'ALL'>('ALL')

  const entries = useMemo<OIEntry[]>(() => {
    const result: OIEntry[] = []
    for (const row of strikes) {
      const ceSig = classifyOI(row.ce_changePct, row.ce_oiChange)
      const peSig = classifyOI(row.pe_changePct, row.pe_oiChange)
      // Only include if OI change is meaningful (> 500 contracts)
      if (ceSig && Math.abs(row.ce_oiChange) > 500) {
        result.push({ strike: row.strikePrice, type: 'CE', signal: ceSig, changePct: row.ce_changePct, oiChange: row.ce_oiChange, oi: row.ce_oi, ltp: row.ce_ltp })
      }
      if (peSig && Math.abs(row.pe_oiChange) > 500) {
        result.push({ strike: row.strikePrice, type: 'PE', signal: peSig, changePct: row.pe_changePct, oiChange: row.pe_oiChange, oi: row.pe_oi, ltp: row.pe_ltp })
      }
    }
    // Sort by absolute OI change descending
    return result.sort((a, b) => Math.abs(b.oiChange) - Math.abs(a.oiChange))
  }, [strikes])

  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.signal === filter)

  const counts = useMemo(() => {
    const c: Record<OISignal, number> = { 'Long Buildup': 0, 'Short Covering': 0, 'Short Buildup': 0, 'Long Unwinding': 0 }
    for (const e of entries) c[e.signal]++
    return c
  }, [entries])

  if (!strikes.length) return null

  return (
    <TerminalCard title="OI Buildup / Unwinding" icon={<TrendingUp size={12}/>} accent="amber">
      <div className="space-y-3">

        {/* Signal filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'Long Buildup', 'Short Buildup', 'Short Covering', 'Long Unwinding'] as const).map(sig => {
            const meta = sig !== 'ALL' ? SIGNAL_META[sig] : null
            const count = sig === 'ALL' ? entries.length : counts[sig]
            const active = filter === sig
            return (
              <button key={sig} onClick={() => setFilter(sig)}
                style={{
                  fontFamily: 'JetBrains Mono', fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${active ? (meta?.color ?? 'var(--text)') : 'var(--border)'}`,
                  background: active ? (meta?.bg ?? 'rgba(255,255,255,0.05)') : 'transparent',
                  color: active ? (meta?.color ?? 'var(--text)') : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}>
                {sig} <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Signal description */}
        {filter !== 'ALL' && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {SIGNAL_META[filter].desc}
          </div>
        )}

        {/* Summary badges when showing ALL */}
        {filter === 'ALL' && entries.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {(Object.entries(counts) as [OISignal, number][]).map(([sig, cnt]) => cnt > 0 && (
              <div key={sig} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 4,
                border: `1px solid ${SIGNAL_META[sig].color}44`,
                background: SIGNAL_META[sig].bg,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: SIGNAL_META[sig].color }}>{cnt}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sig}</span>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
            No significant OI changes detected
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="term-table text-xs w-full">
              <thead>
                <tr>
                  <th className="col-right">Strike</th>
                  <th className="col-center">Type</th>
                  <th className="col-left">Signal</th>
                  <th className="col-right">LTP</th>
                  <th className="col-right">Chg%</th>
                  <th className="col-right">OI Change</th>
                  <th className="col-right">Total OI</th>
                  <th className="col-right">vs Spot</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((e, i) => {
                  const meta = SIGNAL_META[e.signal]
                  const distFromSpot = spotPrice > 0 ? ((e.strike - spotPrice) / spotPrice * 100) : 0
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : undefined }}>
                      <td className="col-right" style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--text)' }}>
                        {e.strike.toLocaleString('en-IN')}
                      </td>
                      <td className="col-center">
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700,
                          padding: '1px 5px', borderRadius: 3,
                          background: e.type === 'CE' ? 'rgba(0,255,65,0.12)' : 'rgba(255,0,64,0.12)',
                          color: e.type === 'CE' ? 'var(--green)' : 'var(--red)',
                          border: `1px solid ${e.type === 'CE' ? 'rgba(0,255,65,0.3)' : 'rgba(255,0,64,0.3)'}`,
                        }}>
                          {e.type}
                        </span>
                      </td>
                      <td className="col-left">
                        <span style={{
                          fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 3,
                          background: meta.bg, color: meta.color,
                          border: `1px solid ${meta.color}44`,
                          whiteSpace: 'nowrap',
                        }}>
                          {e.signal}
                        </span>
                      </td>
                      <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>
                        ₹{e.ltp?.toFixed(2) ?? '—'}
                      </td>
                      <td className="col-right" style={{ color: e.changePct >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'JetBrains Mono' }}>
                        {e.changePct >= 0 ? '+' : ''}{e.changePct?.toFixed(2)}%
                      </td>
                      <td className="col-right" style={{ color: e.oiChange >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'JetBrains Mono' }}>
                        {e.oiChange >= 0 ? '+' : ''}{formatCompact(e.oiChange)}
                      </td>
                      <td className="col-right" style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                        {formatCompact(e.oi)}
                      </td>
                      <td className="col-right" style={{ color: distFromSpot >= 0 ? 'var(--text-dim)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                        {distFromSpot >= 0 ? '+' : ''}{distFromSpot.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TerminalCard>
  )
}

// ── Net Greeks Panel ─────────────────────────────────────────────────────────
function NetGreeksPanel({ selectedLegs, strikes }: { selectedLegs: any[]; strikes: OptionStrike[] }) {
  if (!selectedLegs.length) return null

  // Map strike data for greeks lookup
  const strikeMap = useMemo(() => {
    const m: Record<string, OptionStrike> = {}
    for (const s of strikes) m[s.strikePrice] = s
    return m
  }, [strikes])

  let netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0
  let ceIVSum = 0, ceIVCount = 0, peIVSum = 0, peIVCount = 0

  for (const leg of selectedLegs) {
    const row = strikeMap[leg.strike]
    if (!row) continue
    const sign = leg.action === 'BUY' ? 1 : -1
    const qty  = leg.lots ?? 1

    if (leg.type === 'CE') {
      const delta = row.ce_delta ?? 0
      const gamma = row.ce_gamma ?? 0
      const theta = row.ce_theta ?? 0
      const vega  = row.ce_vega  ?? 0
      netDelta += delta * qty * sign
      netGamma += gamma * qty * sign
      netTheta += theta * qty * sign
      netVega  += vega  * qty * sign
      if (row.ce_iv != null) { ceIVSum += row.ce_iv; ceIVCount++ }
    } else {
      const delta = row.pe_delta ?? 0
      const gamma = row.pe_gamma ?? 0
      const theta = row.pe_theta ?? 0
      const vega  = row.pe_vega  ?? 0
      netDelta += delta * qty * sign
      netGamma += gamma * qty * sign
      netTheta += theta * qty * sign
      netVega  += vega  * qty * sign
      if (row.pe_iv != null) { peIVSum += row.pe_iv; peIVCount++ }
    }
  }

  const avgCeIV   = ceIVCount > 0 ? ceIVSum / ceIVCount : null
  const avgPeIV   = peIVCount > 0 ? peIVSum / peIVCount : null
  const ivSkew    = avgCeIV != null && avgPeIV != null ? avgCeIV - avgPeIV : null

  function greekColor(v: number) {
    return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-dim)'
  }

  return (
    <TerminalCard title="Net Portfolio Greeks" icon={<Activity size={12}/>} accent="green">
      <div className="space-y-3">

        {/* Greeks row */}
        <div className="flex flex-wrap gap-6">
          {([ ['Delta', netDelta, 3], ['Gamma', netGamma, 4], ['Theta', netTheta, 2], ['Vega', netVega, 2] ] as [string, number, number][]).map(([label, val, dp]) => (
            <div key={label} className="text-xs">
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{
                fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 16,
                color: greekColor(val),
              }}>
                {val >= 0 ? '+' : ''}{val.toFixed(dp)}
              </div>
            </div>
          ))}
        </div>

        {/* IV Summary row */}
        {(avgCeIV != null || avgPeIV != null) && (
          <div className="flex flex-wrap gap-4 text-xs" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>IV Summary:</span>
            {avgCeIV != null && (
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Avg CE IV: </span>
                <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--green)' }}>{avgCeIV.toFixed(2)}%</span>
              </span>
            )}
            {avgPeIV != null && (
              <span>
                <span style={{ color: 'var(--text-muted)' }}>Avg PE IV: </span>
                <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--red)' }}>{avgPeIV.toFixed(2)}%</span>
              </span>
            )}
            {ivSkew != null && (
              <span>
                <span style={{ color: 'var(--text-muted)' }}>IV Skew (CE−PE): </span>
                <span style={{ fontFamily: 'JetBrains Mono', color: greekColor(ivSkew) }}>
                  {ivSkew >= 0 ? '+' : ''}{ivSkew.toFixed(2)}%
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </TerminalCard>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
function OptionsPageInner() {
  const sp       = useSearchParams()
  const router   = useRouter()
  const [symbol, setSymbol]   = useState(sp.get('symbol') ?? 'NIFTY')
  const [expiry, setExpiry]   = useState(sp.get('expiry') ?? '')
  const [selectedLegs, setSelectedLegs] = useState<any[]>([])
  const tableRef  = useRef<HTMLDivElement>(null)
  const atmRowRef = useRef<HTMLTableRowElement>(null)

  const chainUrl = `/api/options/chain?symbol=${symbol}&expiry=${expiry}`
  const { data, isLoading } = useSWR(chainUrl, fetcher, { refreshInterval: 30000 })

  const chain    = data?.data
  const expiries = chain?.expiries ?? []
  const strikes  = chain?.strikes  ?? []
  const spot     = chain?.spotPrice ?? 0

  useEffect(() => {
    if (expiries.length && !expiry) setExpiry(expiries[0])
  }, [expiries, expiry])

  // Scroll ATM row to vertical center of table when data loads
  useEffect(() => {
    if (!isLoading && atmRowRef.current && tableRef.current) {
      const container = tableRef.current
      const row       = atmRowRef.current
      const offset    = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2
      container.scrollTop = Math.max(0, offset)
    }
  }, [isLoading, expiry, symbol])

  // ── Derived analytics ──────────────────────────────────────────────────────
  const maxCeOI = useMemo(() => Math.max(...strikes.map((s: OptionStrike) => s.ce_oi ?? 0), 0), [strikes])
  const maxPeOI = useMemo(() => Math.max(...strikes.map((s: OptionStrike) => s.pe_oi ?? 0), 0), [strikes])

  const lotSize = LOT_SIZES[symbol] ?? 75

  const maxPainStrike = useMemo(() => calcMaxPain(strikes, lotSize), [strikes, lotSize])

  function addLeg(strike: OptionStrike, type: 'CE'|'PE', action: 'BUY'|'SELL') {
    const ceIV = strike.ce_iv != null ? strike.ce_iv / 100 : undefined
    const peIV = strike.pe_iv != null ? strike.pe_iv / 100 : undefined
    const leg = {
      type, action,
      strike:   strike.strikePrice,
      expiry:   strike.expiryDate,
      lots:     1, lotSize,
      premium:  type === 'CE' ? strike.ce_ltp : strike.pe_ltp,
      iv:       type === 'CE' ? ceIV : peIV,
    }
    setSelectedLegs(l => [...l, leg])
  }

  function buildStrategy() {
    const params = new URLSearchParams({
      underlying: symbol,
      legs:       JSON.stringify(selectedLegs),
    })
    router.push(`/strategies?${params.toString()}`)
  }

  return (
    <>
      <Topbar title="Options" />
      <div className="page-content space-y-4">

        {/* Controls */}
        <TerminalCard noPadding>
          <div className="flex flex-wrap items-center gap-3 p-3">
            {/* Symbol */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Symbol</span>
              <select value={symbol} onChange={e => { setSymbol(e.target.value); setExpiry('') }}
                className="term-select">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Expiry */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Expiry</span>
              <select value={expiry} onChange={e => setExpiry(e.target.value)} className="term-select">
                {expiries.map((e: string) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {/* Stats */}
            {chain && (
              <>
                <div className="flex items-center gap-4 ml-4">
                  <StatPill label="Spot" value={`₹${spot.toLocaleString('en-IN')}`} />
                  <StatPill label="PCR"  value={chain.pcr?.toFixed(2) ?? '—'} color={chain.pcr > 1 ? 'var(--green)' : 'var(--red)'} />
                  <StatPill label="IV"   value={chain.iv != null ? `${chain.iv.toFixed(1)}%` : '—'} />
                  <StatPill label="CE OI" value={formatCompact(chain.totalCeOI)} color="var(--red)" />
                  <StatPill label="PE OI" value={formatCompact(chain.totalPeOI)} color="var(--green)" />
                  {maxPainStrike != null && (
                    <StatPill label="Max Pain" value={`₹${maxPainStrike.toLocaleString('en-IN')}`} color="var(--amber)" />
                  )}
                </div>
              </>
            )}

            {selectedLegs.length > 0 && (
              <button onClick={buildStrategy} className="btn btn-amber ml-auto">
                Build Strategy ({selectedLegs.length} legs) →
              </button>
            )}
          </div>
        </TerminalCard>

        {/* Option Chain Table — ATM first, scroll to see more */}
        <TerminalCard title={`Option Chain${strikes.length ? ` · ${strikes.length} strikes` : ''}`} icon={<Layers size={12}/>} accent="cyan" noPadding>
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size={24} /> <span className="ml-3 text-xs" style={{ color: 'var(--text-muted)' }}>Loading chain...</span>
            </div>
          )}
          {!isLoading && (
            <div ref={tableRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <table className="term-table text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#111' }}>
                  <tr>
                    {/* CALLS side */}
                    <th className="col-right" style={{ color:'var(--green)' }}>OI Chg</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>OI</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>IV%</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>Delta</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>Vol</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>Chg%</th>
                    <th className="col-right" style={{ color:'var(--green)' }}>CE LTP</th>
                    <th className="col-center" style={{ color:'var(--amber)', background:'rgba(255,183,0,0.08)', minWidth: 100 }}>STRIKE</th>
                    {/* PUTS side */}
                    <th className="col-right" style={{ color:'var(--red)' }}>PE LTP</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>Chg%</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>Vol</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>Delta</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>IV%</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>OI</th>
                    <th className="col-right" style={{ color:'var(--red)' }}>OI Chg</th>
                    <th style={{ color:'var(--text-muted)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {strikes.map((row: OptionStrike) => {
                    const isMaxPain = maxPainStrike != null && row.strikePrice === maxPainStrike
                    const isATM     = row.isATM

                    let rowBg: string | undefined
                    let rowBorder: React.CSSProperties = {}
                    if (isATM && isMaxPain) {
                      rowBg = 'rgba(255,183,0,0.12)'
                      rowBorder = {
                        borderTop: '1px solid rgba(255,183,0,0.5)',
                        borderBottom: '1px solid rgba(255,183,0,0.5)',
                      }
                    } else if (isATM) {
                      rowBg = 'rgba(255,183,0,0.08)'
                      rowBorder = {
                        borderTop: '1px solid rgba(255,183,0,0.4)',
                        borderBottom: '1px solid rgba(255,183,0,0.4)',
                      }
                    } else if (isMaxPain) {
                      rowBg = 'rgba(255,183,0,0.05)'
                      rowBorder = {
                        borderTop: '1px dashed rgba(255,183,0,0.3)',
                        borderBottom: '1px dashed rgba(255,183,0,0.3)',
                      }
                    }

                    return (
                      <tr key={row.strikePrice}
                        ref={isATM ? atmRowRef : undefined}
                        style={{ background: rowBg, fontWeight: isATM ? 700 : undefined, ...rowBorder }}>

                        {/* CE OI Change */}
                        <td className="col-right" style={{ color: row.ce_oiChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatCompact(row.ce_oiChange)}
                          <OIArrow change={row.ce_oiChange} />
                        </td>

                        {/* CE OI with heatmap */}
                        <td className="col-right" style={{ color: 'var(--text-dim)', ...oiCellStyle(row.ce_oi, maxCeOI, 'CE') }}>
                          {formatCompact(row.ce_oi)}
                        </td>

                        <td className="col-right" style={{ color: 'var(--green)' }}>{row.ce_iv?.toFixed(1) ?? '—'}</td>
                        <td className="col-right" style={{ color: 'var(--green)', fontFamily:'JetBrains Mono' }}>{row.ce_delta?.toFixed(2) ?? '—'}</td>
                        <td className="col-right" style={{ color: 'var(--text-dim)' }}>{formatCompact(row.ce_volume)}</td>
                        <td className="col-right" style={{ color: row.ce_changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatPct(row.ce_changePct)}
                        </td>
                        <td className="col-right font-bold" style={{ color: 'var(--green)', fontFamily:'JetBrains Mono' }}>
                          {row.ce_ltp?.toFixed(2) ?? '—'}
                        </td>

                        {/* Strike */}
                        <td className="col-center font-bold" style={{
                          color: isATM ? 'var(--amber)' : 'var(--text)',
                          fontFamily:'JetBrains Mono',
                          background: isATM ? 'rgba(255,183,0,0.08)' : undefined,
                        }}>
                          {row.strikePrice.toLocaleString('en-IN')}
                          {isATM && <span className="ml-1 badge badge-amber">ATM</span>}
                          {isMaxPain && !isATM && (
                            <span className="ml-1" style={{
                              fontSize: 9, color: 'var(--amber)',
                              border: '1px dashed rgba(255,183,0,0.5)',
                              borderRadius: 3, padding: '1px 3px',
                            }}>MP</span>
                          )}
                          {isMaxPain && isATM && (
                            <span className="ml-1" style={{
                              fontSize: 9, color: 'var(--amber)',
                              border: '1px dashed rgba(255,183,0,0.5)',
                              borderRadius: 3, padding: '1px 3px',
                            }}>MP</span>
                          )}
                        </td>

                        {/* PE side */}
                        <td className="col-right font-bold" style={{ color: 'var(--red)', fontFamily:'JetBrains Mono' }}>
                          {row.pe_ltp?.toFixed(2) ?? '—'}
                        </td>
                        <td className="col-right" style={{ color: row.pe_changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatPct(row.pe_changePct)}
                        </td>
                        <td className="col-right" style={{ color: 'var(--text-dim)' }}>{formatCompact(row.pe_volume)}</td>
                        <td className="col-right" style={{ color: 'var(--red)', fontFamily:'JetBrains Mono' }}>{row.pe_delta?.toFixed(2) ?? '—'}</td>
                        <td className="col-right" style={{ color: 'var(--red)' }}>{row.pe_iv?.toFixed(1) ?? '—'}</td>

                        {/* PE OI with heatmap */}
                        <td className="col-right" style={{ color: 'var(--text-dim)', ...oiCellStyle(row.pe_oi, maxPeOI, 'PE') }}>
                          {formatCompact(row.pe_oi)}
                        </td>

                        {/* PE OI Change */}
                        <td className="col-right" style={{ color: row.pe_oiChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatCompact(row.pe_oiChange)}
                          <OIArrow change={row.pe_oiChange} />
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => addLeg(row, 'CE', 'BUY')}  className="btn btn-sm btn-green"  title="Buy CE">BCE</button>
                            <button onClick={() => addLeg(row, 'CE', 'SELL')} className="btn btn-sm btn-red"    title="Sell CE">SCE</button>
                            <button onClick={() => addLeg(row, 'PE', 'BUY')}  className="btn btn-sm btn-green"  title="Buy PE">BPE</button>
                            <button onClick={() => addLeg(row, 'PE', 'SELL')} className="btn btn-sm btn-red"    title="Sell PE">SPE</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TerminalCard>

        {/* PCR Chart + Max Pain section */}
        {!isLoading && chain && (
          <PCRSection
            totalCeOI={chain.totalCeOI}
            totalPeOI={chain.totalPeOI}
            pcr={chain.pcr ?? 0}
            spotPrice={spot}
            maxPainStrike={maxPainStrike}
            symbol={symbol}
          />
        )}

        {/* OI Buildup / Unwinding Detection */}
        {!isLoading && strikes.length > 0 && (
          <OIBuildupPanel strikes={strikes} spotPrice={spot} />
        )}

        {/* Net Greeks panel — only shown if legs are selected */}
        {!isLoading && selectedLegs.length > 0 && (
          <NetGreeksPanel selectedLegs={selectedLegs} strikes={strikes} />
        )}

        {/* ── PCR Tracker ── */}
        <PCRGauge />

        {/* ── Max Pain Calculator ── */}
        <MaxPainChart defaultSymbol={symbol} />

        {/* ── Options Greeks Dashboard ── */}
        <GreeksDashboard defaultSymbol={symbol} />

        {/* ── IV Surface Heatmap ── */}
        <IVSurface defaultSymbol={symbol} />

        {/* Selected Legs preview */}
        {selectedLegs.length > 0 && (
          <TerminalCard title={`Selected Legs (${selectedLegs.length})`} accent="amber">
            <div className="flex flex-wrap gap-2">
              {selectedLegs.map((leg, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded"
                  style={{ background: '#0a0a0a', border: `1px solid ${leg.action === 'BUY' ? 'rgba(0,255,65,0.4)' : 'rgba(255,0,64,0.4)'}` }}>
                  <span style={{ color: leg.action === 'BUY' ? 'var(--green)' : 'var(--red)', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                    {leg.action} {leg.type} {leg.strike} @ ₹{(leg.premium ?? 0).toFixed(2)}
                  </span>
                  <button onClick={() => setSelectedLegs(l => l.filter((_, j) => j !== i))}
                    style={{ color: 'var(--text-muted)' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setSelectedLegs([])} className="btn btn-sm btn-ghost">Clear All</button>
            </div>
          </TerminalCard>
        )}
      </div>
    </>
  )
}

export default function OptionsPage() {
  return <Suspense fallback={<div className="page-content flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>}><OptionsPageInner /></Suspense>
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-xs">
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span style={{ color: color ?? 'var(--text)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{value}</span>
    </div>
  )
}

function formatCompact(n: number): string {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e7) return `${(n/1e7).toFixed(1)}Cr`
  if (Math.abs(n) >= 1e5) return `${(n/1e5).toFixed(1)}L`
  if (Math.abs(n) >= 1e3) return `${(n/1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-IN')
}
