'use client'
import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { Activity } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SYMBOLS = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY']

// ── Color helpers ─────────────────────────────────────────────────────────────
function deltaColor(delta: number | null, type: 'CE' | 'PE'): string {
  if (delta == null) return 'var(--text-dim)'
  const abs = Math.abs(delta)
  if (abs > 0.6) return type === 'CE' ? 'var(--green)' : 'var(--red)'
  if (abs > 0.4) return 'rgba(0,229,255,0.9)'
  return 'var(--text-muted)'
}

function thetaColor(theta: number | null): string {
  if (theta == null) return 'var(--text-dim)'
  // Theta is always negative for long options; more negative = more red
  if (theta < -2)    return 'var(--red)'
  if (theta < -0.5)  return 'var(--amber)'
  return 'var(--text-muted)'
}

function ivColor(iv: number | null): string {
  if (iv == null) return 'var(--text-dim)'
  if (iv > 30) return 'var(--red)'
  if (iv > 20) return 'var(--amber)'
  return 'var(--green)'
}

function fmt(n: number | null, dp = 2): string {
  if (n == null) return '—'
  return n.toFixed(dp)
}

function fmtIV(iv: number | null): string {
  if (iv == null) return '—'
  return `${iv.toFixed(1)}%`
}

// ── Summary totals row ────────────────────────────────────────────────────────
function SummaryRow({ strikes, selectedSet }: { strikes: any[]; selectedSet: Set<number> }) {
  const selected = strikes.filter(s => selectedSet.has(s.strikePrice))
  if (!selected.length) return null

  const sumCeDelta = selected.reduce((s, r) => s + (r.ceDelta ?? 0), 0)
  const sumPeDelta = selected.reduce((s, r) => s + (r.peDelta ?? 0), 0)
  const sumCeTheta = selected.reduce((s, r) => s + (r.ceTheta ?? 0), 0)
  const sumPeTheta = selected.reduce((s, r) => s + (r.peTheta ?? 0), 0)
  const sumCeVega  = selected.reduce((s, r) => s + (r.ceVega  ?? 0), 0)
  const sumPeVega  = selected.reduce((s, r) => s + (r.peVega  ?? 0), 0)
  const sumCeGamma = selected.reduce((s, r) => s + (r.ceGamma ?? 0), 0)
  const sumPeGamma = selected.reduce((s, r) => s + (r.peGamma ?? 0), 0)

  return (
    <tr style={{ borderTop: '1px solid var(--cyan)', background: 'rgba(0,229,255,0.05)' }}>
      <td style={{ color: 'var(--cyan)', fontSize: 10, fontWeight: 700, padding: '4px 6px' }} colSpan={2}>Σ Selected ({selected.length})</td>
      <td style={{ color: 'var(--green)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumCeDelta, 3)}</td>
      <td style={{ color: 'var(--text-muted)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumCeGamma, 4)}</td>
      <td style={{ color: thetaColor(sumCeTheta), textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumCeTheta, 2)}</td>
      <td style={{ color: 'var(--text-muted)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumCeVega, 2)}</td>
      <td style={{ padding: '4px 6px' }} />
      {/* center strike */}
      <td style={{ padding: '4px 6px' }} />
      {/* PE side */}
      <td style={{ padding: '4px 6px' }} />
      <td style={{ color: 'var(--text-muted)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumPeVega, 2)}</td>
      <td style={{ color: thetaColor(sumPeTheta), textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumPeTheta, 2)}</td>
      <td style={{ color: 'var(--text-muted)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumPeGamma, 4)}</td>
      <td style={{ color: 'var(--red)', textAlign: 'right', padding: '4px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }}>{fmt(sumPeDelta, 3)}</td>
      <td style={{ padding: '4px 6px' }} />
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GreeksDashboard({ defaultSymbol = 'NIFTY' }: { defaultSymbol?: string }) {
  const [symbol, setSymbol]     = useState(defaultSymbol)
  const [expiry, setExpiry]     = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const url = `/api/options/greeks-chain?symbol=${symbol}&expiry=${encodeURIComponent(expiry)}`
  const { data, isLoading } = useSWR(url, fetcher, { refreshInterval: 5 * 60 * 1000 })

  useEffect(() => {
    if (data?.expiries?.length && !expiry) setExpiry(data.expiries[0])
  }, [data, expiry])
  useEffect(() => { setExpiry(''); setSelected(new Set()) }, [symbol])

  // Filter ±10 strikes around ATM
  const displayStrikes = useMemo(() => {
    const strikes = data?.strikes ?? []
    if (!strikes.length) return []
    const atmIdx = strikes.findIndex((s: any) => s.isATM)
    if (atmIdx < 0) return strikes
    return strikes.slice(Math.max(0, atmIdx - 10), atmIdx + 11)
  }, [data])

  function toggleStrike(sp: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(sp) ? next.delete(sp) : next.add(sp)
      return next
    })
  }

  const thStyle: React.CSSProperties = { padding: '5px 6px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', userSelect: 'none' }
  const tdBase: React.CSSProperties  = { padding: '3px 6px', fontFamily: 'JetBrains Mono', fontSize: 11, textAlign: 'right' }

  return (
    <TerminalCard title="Options Greeks Dashboard" icon={<Activity size={12}/>} accent="green"
      action={
        <div className="flex gap-2 items-center">
          <select value={symbol} onChange={e => setSymbol(e.target.value)} className="term-select" style={{ fontSize: 11 }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={expiry} onChange={e => setExpiry(e.target.value)} className="term-select" style={{ fontSize: 11 }}>
            {(data?.expiries ?? []).map((e: string) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      }>

      {isLoading && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Loading Greeks...</div>
      )}

      {!isLoading && data?.error && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>{data.error}</div>
      )}

      {!isLoading && !data?.error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE Price</th>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE Δ</th>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE Γ</th>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE Θ</th>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE ν</th>
                <th style={{ ...thStyle, color: 'var(--green)', textAlign: 'right' }}>CE IV</th>
                <th style={{ ...thStyle, color: 'var(--amber)', textAlign: 'center', background: 'rgba(255,183,0,0.07)', minWidth: 90 }}>STRIKE</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE IV</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE ν</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE Θ</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE Γ</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE Δ</th>
                <th style={{ ...thStyle, color: 'var(--red)',   textAlign: 'right' }}>PE Price</th>
                <th style={{ ...thStyle, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>Sel</th>
              </tr>
            </thead>
            <tbody>
              {displayStrikes.map((row: any) => {
                const isATM  = row.isATM
                const isSel  = selected.has(row.strikePrice)
                const rowBg  = isATM
                  ? 'rgba(255,183,0,0.08)'
                  : isSel
                  ? 'rgba(0,229,255,0.06)'
                  : undefined
                const border = isATM
                  ? { borderTop: '1px solid rgba(255,183,0,0.4)', borderBottom: '1px solid rgba(255,183,0,0.4)' }
                  : {}

                return (
                  <tr key={row.strikePrice} style={{ background: rowBg, ...border, cursor: 'pointer' }}
                    onClick={() => toggleStrike(row.strikePrice)}>
                    <td style={{ ...tdBase, color: 'var(--green)' }}>{fmt(row.ceLTP)}</td>
                    <td style={{ ...tdBase, color: deltaColor(row.ceDelta, 'CE') }}>{fmt(row.ceDelta, 3)}</td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)' }}>{fmt(row.ceGamma, 4)}</td>
                    <td style={{ ...tdBase, color: thetaColor(row.ceTheta) }}>{fmt(row.ceTheta)}</td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)' }}>{fmt(row.ceVega)}</td>
                    <td style={{ ...tdBase, color: ivColor(row.ceIV) }}>{fmtIV(row.ceIV)}</td>
                    {/* Strike */}
                    <td style={{
                      ...tdBase, textAlign: 'center', fontWeight: isATM ? 700 : 500,
                      color: isATM ? 'var(--amber)' : 'var(--text)',
                      background: isATM ? 'rgba(255,183,0,0.08)' : undefined,
                    }}>
                      {row.strikePrice.toLocaleString('en-IN')}
                      {isATM && <span style={{ marginLeft: 4, fontSize: 8, color: 'var(--amber)', border: '1px solid rgba(255,183,0,0.5)', borderRadius: 3, padding: '1px 3px' }}>ATM</span>}
                    </td>
                    <td style={{ ...tdBase, color: ivColor(row.peIV) }}>{fmtIV(row.peIV)}</td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)' }}>{fmt(row.peVega)}</td>
                    <td style={{ ...tdBase, color: thetaColor(row.peTheta) }}>{fmt(row.peTheta)}</td>
                    <td style={{ ...tdBase, color: 'var(--text-muted)' }}>{fmt(row.peGamma, 4)}</td>
                    <td style={{ ...tdBase, color: deltaColor(row.peDelta, 'PE') }}>{fmt(row.peDelta, 3)}</td>
                    <td style={{ ...tdBase, color: 'var(--red)' }}>{fmt(row.peLTP)}</td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, margin: '0 auto',
                        background: isSel ? 'var(--cyan)' : 'transparent',
                        border: `1px solid ${isSel ? 'var(--cyan)' : 'var(--border)'}`,
                      }} />
                    </td>
                  </tr>
                )
              })}
              {/* Summary row */}
              <SummaryRow strikes={displayStrikes} selectedSet={selected} />
            </tbody>
          </table>

          {displayStrikes.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>No data</div>
          )}
        </div>
      )}
    </TerminalCard>
  )
}
