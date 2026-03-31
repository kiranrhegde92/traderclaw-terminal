'use client'
import { useState } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { Eye, TrendingUp, TrendingDown, RefreshCw, Shield } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface InsiderTransaction {
  symbol: string
  company: string
  person: string
  category: string
  shares: number
  value: number
  price: number
  txnType: 'BUY' | 'SELL' | 'PLEDGE' | 'OTHER'
  date: string
  mode: string
}

interface PledgingRecord {
  symbol: string
  company: string
  promoterName: string
  totalShares: number
  pledgedShares: number
  pledgedPct: number
  date: string
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function TxnBadge({ type }: { type: InsiderTransaction['txnType'] }) {
  const cfg = {
    BUY:    { color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)',  icon: <TrendingUp  size={10}/> },
    SELL:   { color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)',  icon: <TrendingDown size={10}/> },
    PLEDGE: { color: 'var(--amber)',  bg: 'rgba(251,191,36,0.12)', icon: <Shield size={10}/> },
    OTHER:  { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', icon: null },
  }[type]

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 4,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      {cfg.icon}{type}
    </span>
  )
}

function CategoryBadge({ cat }: { cat: string }) {
  const c = cat.toLowerCase()
  const color = c.includes('promoter') ? 'var(--cyan)' : c.includes('director') ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <span style={{ fontSize: 9, color, background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>
      {cat || 'Insider'}
    </span>
  )
}

export default function InsiderTradingFeed({ limit = 20 }: { limit?: number }) {
  const [tab, setTab] = useState<'insider' | 'pledging'>('insider')

  const { data: insiderData, isLoading: insiderLoading, mutate: refreshInsider } =
    useSWR('/api/market/insider-trading', fetcher, { refreshInterval: 30 * 60 * 1000 })

  const { data: pledgingData, isLoading: pledgingLoading } =
    useSWR('/api/market/pledging', fetcher, { refreshInterval: 30 * 60 * 1000 })

  const transactions: InsiderTransaction[] = (insiderData?.transactions ?? []).slice(0, limit)
  const pledging: PledgingRecord[]         = (pledgingData?.records     ?? []).slice(0, limit)

  const isLoading = tab === 'insider' ? insiderLoading : pledgingLoading

  return (
    <TerminalCard
      title="Insider / Pledging"
      icon={<Eye size={14} />}
      accent="cyan"
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
            {(['insider', 'pledging'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '3px 10px', fontSize: 10, border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--cyan)' : 'transparent',
                color: tab === t ? '#000' : 'var(--text-muted)',
                fontWeight: tab === t ? 700 : 400, textTransform: 'capitalize',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={() => refreshInsider()} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            <RefreshCw size={11} />
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Loading…</div>
      ) : tab === 'insider' ? (
        transactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No insider transactions found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {transactions.map((tx, i) => (
              <div key={i} style={{
                padding: '9px 0',
                borderBottom: i < transactions.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start',
              }}>
                {/* Left */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 12 }}>{tx.symbol}</span>
                    <TxnBadge type={tx.txnType} />
                    <CategoryBadge cat={tx.category} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 1 }}>
                    {tx.person || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {tx.shares > 0 ? `${tx.shares.toLocaleString('en-IN')} shares` : ''}
                    {tx.mode ? ` · ${tx.mode}` : ''}
                  </div>
                </div>

                {/* Right */}
                <div style={{ textAlign: 'right' }}>
                  {tx.value > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: tx.txnType === 'BUY' ? 'var(--green)' : tx.txnType === 'SELL' ? 'var(--red)' : 'var(--amber)' }}>
                      ₹{fmt(tx.value)} Cr
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{tx.date}</div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        pledging.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pledging data found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {pledging.map((p, i) => (
              <div key={i} style={{
                padding: '9px 0',
                borderBottom: i < pledging.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 12 }}>{p.symbol}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.company}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.promoterName || 'Promoter'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: p.pledgedPct > 50 ? 'var(--red)' : p.pledgedPct > 25 ? 'var(--amber)' : 'var(--green)',
                  }}>
                    {fmt(p.pledgedPct)}%
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>pledged · {p.date}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </TerminalCard>
  )
}
