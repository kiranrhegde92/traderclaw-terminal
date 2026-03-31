'use client'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { TrendingUp, TrendingDown, Globe, RefreshCw } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface GlobalIndex {
  symbol: string
  name: string
  ltp: number
  change: number
  changePct: number
  premium: number | null
  premiumPct: number | null
  source: string
  timestamp: string
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function PctBadge({ val }: { val: number }) {
  const up = val >= 0
  const color = up ? 'var(--green)' : 'var(--red)'
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600 }}>
      <Icon size={11} />
      {up ? '+' : ''}{fmt(val)}%
    </span>
  )
}

export default function GiftNiftyWidget() {
  const { data, isLoading, mutate } = useSWR('/api/market/gift-nifty', fetcher, {
    refreshInterval: 5 * 60 * 1000,
  })

  const indices: GlobalIndex[] = data?.data ?? []

  return (
    <TerminalCard
      title="GIFT / Global Pre-Market"
      icon={<Globe size={14} />}
      accent="cyan"
      action={
        <button
          onClick={() => mutate()}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      }
    >
      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Loading…</div>
      ) : indices.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data available</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {indices.map((idx, i) => {
            const up = idx.changePct >= 0
            const ltpColor = up ? 'var(--green)' : 'var(--red)'
            return (
              <div
                key={idx.symbol}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '7px 0',
                  borderBottom: i < indices.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Name */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {idx.symbol}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{idx.name}</div>
                </div>

                {/* LTP */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ltpColor, fontFamily: 'JetBrains Mono, monospace' }}>
                    {idx.ltp > 0 ? fmt(idx.ltp) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
                    {idx.change >= 0 ? '+' : ''}{fmt(idx.change)}
                  </div>
                </div>

                {/* Change % */}
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <PctBadge val={idx.changePct} />
                </div>

                {/* Premium (only for Nifty proxies) */}
                <div style={{ textAlign: 'right', minWidth: 72 }}>
                  {idx.premium !== null ? (
                    <div>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: idx.premium >= 0 ? 'var(--cyan)' : 'var(--amber)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {idx.premium >= 0 ? '+' : ''}{fmt(idx.premium, 0)} pts
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
                        {idx.premiumPct !== null ? `${idx.premiumPct >= 0 ? '+' : ''}${fmt(idx.premiumPct)}% prem` : ''}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Footer */}
          {indices[0] && (
            <div style={{ fontSize: 9, color: 'var(--text-dim)', paddingTop: 6, textAlign: 'right' }}>
              src: {indices[0].source} · {new Date(indices[0].timestamp).toLocaleTimeString('en-IN')}
            </div>
          )}
        </div>
      )}
    </TerminalCard>
  )
}
