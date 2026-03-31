'use client'
import useSWR from 'swr'
import { formatINR } from '@/lib/utils/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PnLAttribution() {
  const { data, isLoading, error } = useSWR('/api/portfolio/attribution', fetcher, { refreshInterval: 30000 })

  if (isLoading) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
      Loading P&L attribution...
    </div>
  )
  if (error || data?.error) return (
    <div style={{ padding: 24, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>
      {data?.error ?? 'Failed to load'}
    </div>
  )

  const { totalPnl = 0, byStock = [], bySector = [], byDirection = { long: 0, short: 0 } } = data ?? {}
  const maxAbsPnl = Math.max(...byStock.map((s: any) => Math.abs(s.pnl)), 1)

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', fontSize: 13 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>TOTAL P&L</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatINR(totalPnl)}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>LONG P&L</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: byDirection.long >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatINR(byDirection.long)}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>SHORT P&L</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: byDirection.short >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {formatINR(byDirection.short)}
          </div>
        </div>
      </div>

      {byStock.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', padding: '24px 0', textAlign: 'center' }}>No positions found</div>
      ) : (
        <>
          {/* Waterfall bars — by stock */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>P&L BY STOCK</div>
            {byStock.map((s: any) => {
              const barWidth = (Math.abs(s.pnl) / maxAbsPnl) * 100
              const color = s.pnl >= 0 ? 'var(--green)' : 'var(--red)'
              return (
                <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 90, color: 'var(--text)', fontSize: 12, flexShrink: 0 }}>{s.symbol}</div>
                  <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 3, height: 18, overflow: 'hidden' }}>
                    <div style={{
                      width: `${barWidth}%`, height: '100%',
                      background: color, opacity: 0.85,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ width: 90, textAlign: 'right', color, fontWeight: 600, fontSize: 12 }}>
                    {formatINR(s.pnl)}
                  </div>
                  <div style={{ width: 55, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                    {s.pnlPct > 0 ? '+' : ''}{s.pnlPct}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sector breakdown */}
          {bySector.length > 0 && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>P&L BY SECTOR</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bySector.map((s: any) => (
                  <div key={s.sector} style={{
                    background: 'var(--surface)', border: `1px solid ${s.pnl >= 0 ? 'var(--green)' : 'var(--red)'}`,
                    borderRadius: 6, padding: '6px 12px', minWidth: 110,
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 3 }}>{s.sector}</div>
                    <div style={{ color: s.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 13 }}>
                      {formatINR(s.pnl)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
