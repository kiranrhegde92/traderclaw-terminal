'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import { Layers, Search, TrendingUp, TrendingDown, RefreshCw, User, Lock } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Deal {
  symbol: string
  clientName: string
  dealType: 'bulk' | 'block'
  buyOrSell: 'BUY' | 'SELL'
  qty: number
  price: number
  value: number
  exchange: string
  date: string
}

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
  mode?: string
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

export default function BulkDealsPage() {
  const [tab, setTab] = useState<'deals' | 'insider' | 'pledging'>('deals')

  const { data, isLoading, mutate } = useSWR('/api/market/bulk-deals', fetcher, {
    refreshInterval: 10 * 60 * 1000,
  })
  const { data: insiderData, isLoading: insiderLoading, mutate: mutateInsider } = useSWR(
    tab === 'insider' ? '/api/market/insider-trading' : null,
    fetcher,
    { refreshInterval: 30 * 60 * 1000 }
  )
  const { data: pledgingData, isLoading: pledgingLoading, mutate: mutatePledging } = useSWR(
    tab === 'pledging' ? '/api/market/pledging' : null,
    fetcher,
    { refreshInterval: 60 * 60 * 1000 }
  )

  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'bulk' | 'block'>('all')
  const [bsFilter,  setBsFilter]  = useState<'all' | 'BUY' | 'SELL'>('all')
  const [sort, setSort] = useState<{ key: keyof Deal; dir: 1 | -1 }>({ key: 'value', dir: -1 })

  const [insiderSearch, setInsiderSearch] = useState('')
  const [insiderTxnFilter, setInsiderTxnFilter] = useState<'all' | 'BUY' | 'SELL' | 'PLEDGE'>('all')
  const [insiderSort, setInsiderSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'value', dir: -1 })

  const [pledgingSearch, setPledgingSearch] = useState('')
  const [pledgingSort, setPledgingSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'pledgedPct', dir: -1 })

  const deals: Deal[] = data?.deals ?? []

  const filtered = useMemo(() => {
    let d = [...deals]
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      d = d.filter(x => x.symbol.includes(q) || x.clientName.toUpperCase().includes(q))
    }
    if (typeFilter !== 'all') d = d.filter(x => x.dealType === typeFilter)
    if (bsFilter  !== 'all') d = d.filter(x => x.buyOrSell === bsFilter)
    d.sort((a, b) => {
      const av = a[sort.key] as any
      const bv = b[sort.key] as any
      if (av < bv) return -sort.dir
      if (av > bv) return sort.dir
      return 0
    })
    return d
  }, [deals, search, typeFilter, bsFilter, sort])

  function toggleSort(key: keyof Deal) {
    setSort(s => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 })
  }

  const SortIndicator = ({ k }: { k: keyof Deal }) => (
    <span style={{ opacity: sort.key === k ? 1 : 0.3, marginLeft: 3 }}>
      {sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : '▼'}
    </span>
  )

  const totalBuy  = filtered.filter(d => d.buyOrSell === 'BUY').reduce((s, d) => s + d.value, 0)
  const totalSell = filtered.filter(d => d.buyOrSell === 'SELL').reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={20} style={{ color: 'var(--amber)' }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {tab === 'deals' ? 'Bulk & Block Deals' : tab === 'insider' ? 'Insider Trading' : 'Promoter Pledging'}
              </h1>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {tab === 'deals' ? 'NSE institutional activity · refreshes every 10 min' : tab === 'insider' ? 'PIT disclosures · refreshes every 30 min' : 'Promoter pledging activity · refreshes every 60 min'}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (tab === 'deals') mutate()
              else if (tab === 'insider') mutateInsider()
              else mutatePledging()
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'deals', label: 'Bulk & Block Deals', icon: Layers },
            { id: 'insider', label: 'Insider Trading', icon: User },
            { id: 'pledging', label: 'Promoter Pledging', icon: Lock },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 16px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, letterSpacing: '0.05em',
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--green)' : 'none',
                marginBottom: -1,
              }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* DEALS TAB */}
        {tab === 'deals' && (
        <>
        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Deals',  value: `${filtered.length}`,             color: 'var(--text)' },
            { label: 'Buy Value',    value: `₹${fmt(totalBuy)} Cr`,           color: 'var(--green)' },
            { label: 'Sell Value',   value: `₹${fmt(totalSell)} Cr`,          color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol or client…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Deal type toggle */}
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'bulk', 'block'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '6px 14px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                background: typeFilter === t ? 'var(--amber)' : 'transparent',
                color: typeFilter === t ? '#000' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', fontWeight: typeFilter === t ? 700 : 400, textTransform: 'uppercase',
              }}>
                {t}
              </button>
            ))}
          </div>

          {/* Buy/Sell toggle */}
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['all', 'BUY', 'SELL'] as const).map(t => (
              <button key={t} onClick={() => setBsFilter(t)} style={{
                padding: '6px 14px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                background: bsFilter === t ? (t === 'BUY' ? 'var(--green)' : t === 'SELL' ? 'var(--red)' : 'var(--cyan)') : 'transparent',
                color: bsFilter === t ? (t === 'all' ? '#000' : '#fff') : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', fontWeight: bsFilter === t ? 700 : 400,
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <TerminalCard noPadding accent="amber">
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading deals…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {deals.length === 0 ? 'No deals data available from NSE' : 'No deals match the current filters'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'Symbol',     k: 'symbol'     as keyof Deal },
                      { label: 'Client',     k: 'clientName' as keyof Deal },
                      { label: 'Type',       k: 'dealType'   as keyof Deal },
                      { label: 'B/S',        k: 'buyOrSell'  as keyof Deal },
                      { label: 'Qty',        k: 'qty'        as keyof Deal },
                      { label: 'Price (₹)',  k: 'price'      as keyof Deal },
                      { label: 'Value (Cr)', k: 'value'      as keyof Deal },
                      { label: 'Exch',       k: 'exchange'   as keyof Deal },
                      { label: 'Date',       k: 'date'       as keyof Deal },
                    ].map(col => (
                      <th
                        key={col.k}
                        onClick={() => toggleSort(col.k)}
                        style={{
                          padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)',
                          fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                          fontSize: 11, letterSpacing: '0.05em',
                        }}
                      >
                        {col.label}<SortIndicator k={col.k} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((deal, i) => {
                    const isBuy = deal.buyOrSell === 'BUY'
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}
                      >
                        <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--cyan)' }}>
                          {deal.symbol}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deal.clientName || '—'}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: deal.dealType === 'bulk' ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.15)',
                            color: deal.dealType === 'bulk' ? 'var(--amber)' : '#a78bfa',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {deal.dealType}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: isBuy ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 12,
                          }}>
                            {isBuy ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {deal.buyOrSell}
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>
                          {deal.qty > 0 ? deal.qty.toLocaleString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>
                          {deal.price > 0 ? fmt(deal.price) : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', fontWeight: 700, textAlign: 'right', color: isBuy ? 'var(--green)' : 'var(--red)' }}>
                          {deal.value > 0 ? `₹${fmt(deal.value)} Cr` : '—'}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11 }}>
                          {deal.exchange}
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {deal.date}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TerminalCard>

        {data?.lastUpdated && (
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
            Last updated: {new Date(data.lastUpdated).toLocaleString('en-IN')}
          </div>
        )}
        </>
        )}

        {/* INSIDER TAB */}
        {tab === 'insider' && (
        <>
        <InsiderTradingTab data={insiderData?.transactions ?? []} isLoading={insiderLoading} search={insiderSearch} setSearch={setInsiderSearch} txnFilter={insiderTxnFilter} setTxnFilter={setInsiderTxnFilter} sort={insiderSort} setSort={setInsiderSort} />
        </>
        )}

        {/* PLEDGING TAB */}
        {tab === 'pledging' && (
        <>
        <PledgingTab data={pledgingData?.records ?? []} isLoading={pledgingLoading} search={pledgingSearch} setSearch={setPledgingSearch} sort={pledgingSort} setSort={setPledgingSort} />
        </>
        )}
      </div>
    </div>
  )
}

/* ── Insider Trading Tab ────────────────────────────────────────────── */
function InsiderTradingTab({
  data, isLoading, search, setSearch, txnFilter, setTxnFilter, sort, setSort,
}: {
  data: InsiderTransaction[]
  isLoading: boolean
  search: string
  setSearch: (s: string) => void
  txnFilter: 'all' | 'BUY' | 'SELL' | 'PLEDGE'
  setTxnFilter: (t: 'all' | 'BUY' | 'SELL' | 'PLEDGE') => void
  sort: { key: string; dir: 1 | -1 }
  setSort: (s: any) => void
}) {
  const filtered = useMemo(() => {
    let d = [...data]
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      d = d.filter(x => x.symbol.includes(q) || x.person.toUpperCase().includes(q) || x.company.toUpperCase().includes(q))
    }
    if (txnFilter !== 'all') d = d.filter(x => x.txnType === txnFilter)
    d.sort((a: any, b: any) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av < bv) return -sort.dir
      if (av > bv) return sort.dir
      return 0
    })
    return d
  }, [data, search, txnFilter, sort])

  const totalBuy = filtered.filter(t => t.txnType === 'BUY').reduce((s, t) => s + t.value, 0)
  const totalSell = filtered.filter(t => t.txnType === 'SELL').reduce((s, t) => s + t.value, 0)
  const totalPledge = filtered.filter(t => t.txnType === 'PLEDGE').reduce((s, t) => s + t.value, 0)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Buy Value',     value: `₹${fmt(totalBuy)} Cr`,   color: 'var(--green)' },
          { label: 'Sell Value',    value: `₹${fmt(totalSell)} Cr`,  color: 'var(--red)' },
          { label: 'Pledge Value',  value: `₹${fmt(totalPledge)} Cr`, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol or person…"
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['all', 'BUY', 'SELL', 'PLEDGE'] as const).map(t => (
            <button key={t} onClick={() => setTxnFilter(t)} style={{
              padding: '6px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              background: txnFilter === t ? (t === 'BUY' ? 'var(--green)' : t === 'SELL' ? 'var(--red)' : t === 'PLEDGE' ? 'var(--amber)' : 'var(--cyan)') : 'transparent',
              color: txnFilter === t ? (t === 'all' ? '#000' : '#fff') : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', fontWeight: txnFilter === t ? 700 : 400, textTransform: 'uppercase',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <TerminalCard noPadding accent="green">
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading insider transactions…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {data.length === 0 ? 'No insider transaction data available' : 'No transactions match the current filters'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Symbol',     key: 'symbol' },
                    { label: 'Company',    key: 'company' },
                    { label: 'Person',     key: 'person' },
                    { label: 'Category',   key: 'category' },
                    { label: 'Type',       key: 'txnType' },
                    { label: 'Shares',     key: 'shares' },
                    { label: 'Price (₹)',  key: 'price' },
                    { label: 'Value (Cr)', key: 'value' },
                    { label: 'Date',       key: 'date' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => setSort(sort.key === col.key ? { key: col.key, dir: sort.dir === 1 ? -1 : 1 } : { key: col.key, dir: -1 })}
                      style={{
                        padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)',
                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                        fontSize: 11, letterSpacing: '0.05em',
                      }}
                    >
                      {col.label} <span style={{ opacity: sort.key === col.key ? 1 : 0.3 }}>{sort.key === col.key ? (sort.dir === 1 ? '▲' : '▼') : '▼'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--cyan)' }}>{t.symbol}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-dim)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.company}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text)' }}>{t.person}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--text-muted)' }}>{t.category}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        background: t.txnType === 'BUY' ? 'rgba(0,255,65,0.15)' : t.txnType === 'SELL' ? 'rgba(255,0,64,0.15)' : 'rgba(255,183,0,0.15)',
                        color: t.txnType === 'BUY' ? 'var(--green)' : t.txnType === 'SELL' ? 'var(--red)' : 'var(--amber)',
                        letterSpacing: '0.05em',
                      }}>
                        {t.txnType}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>{t.shares.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>{fmt(t.price)}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, textAlign: 'right', color: t.txnType === 'BUY' ? 'var(--green)' : t.txnType === 'SELL' ? 'var(--red)' : 'var(--amber)' }}>
                      ₹{fmt(t.value)} Cr
                    </td>
                    <td style={{ padding: '9px 14px', color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap' }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TerminalCard>
    </>
  )
}

/* ── Pledging Tab ────────────────────────────────────────────────────── */
function PledgingTab({
  data, isLoading, search, setSearch, sort, setSort,
}: {
  data: PledgingRecord[]
  isLoading: boolean
  search: string
  setSearch: (s: string) => void
  sort: { key: string; dir: 1 | -1 }
  setSort: (s: any) => void
}) {
  const filtered = useMemo(() => {
    let d = [...data]
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      d = d.filter(x => x.symbol.includes(q) || x.promoterName.toUpperCase().includes(q) || x.company.toUpperCase().includes(q))
    }
    d.sort((a: any, b: any) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av < bv) return -sort.dir
      if (av > bv) return sort.dir
      return 0
    })
    return d
  }, [data, search, sort])

  const totalPledged = filtered.reduce((s, r) => s + r.pledgedShares, 0)
  const avgPledgePct = filtered.length > 0 ? filtered.reduce((s, r) => s + r.pledgedPct, 0) / filtered.length : 0

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Records',   value: `${filtered.length}`,              color: 'var(--text)' },
          { label: 'Pledged Shares',  value: `${fmt(totalPledged, 0)}`,         color: 'var(--amber)' },
          { label: 'Avg Pledge %',    value: `${fmt(avgPledgePct, 1)}%`,        color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol or promoter…"
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <TerminalCard noPadding accent="amber">
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading pledging data…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {data.length === 0 ? 'No pledging data available' : 'No records match the current filter'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Symbol',          key: 'symbol' },
                    { label: 'Company',         key: 'company' },
                    { label: 'Promoter',        key: 'promoterName' },
                    { label: 'Total Shares',    key: 'totalShares' },
                    { label: 'Pledged Shares',  key: 'pledgedShares' },
                    { label: 'Pledge %',        key: 'pledgedPct' },
                    { label: 'Date',            key: 'date' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => setSort(sort.key === col.key ? { key: col.key, dir: sort.dir === 1 ? -1 : 1 } : { key: col.key, dir: -1 })}
                      style={{
                        padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)',
                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                        fontSize: 11, letterSpacing: '0.05em',
                      }}
                    >
                      {col.label} <span style={{ opacity: sort.key === col.key ? 1 : 0.3 }}>{sort.key === col.key ? (sort.dir === 1 ? '▲' : '▼') : '▼'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  let pledgeColor = 'var(--green)'
                  if (r.pledgedPct > 50) pledgeColor = 'var(--red)'
                  else if (r.pledgedPct > 25) pledgeColor = 'var(--amber)'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--cyan)' }}>{r.symbol}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-dim)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.company}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text)' }}>{r.promoterName}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>{r.totalShares.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>{r.pledgedShares.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 700, textAlign: 'right', color: pledgeColor }}>
                        {fmt(r.pledgedPct, 1)}%
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap' }}>{r.date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TerminalCard>
    </>
  )
}
