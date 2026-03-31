'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import { BarChart2, Calendar, TrendingUp, TrendingDown, Clock, RefreshCw, Search } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ResultEvent {
  symbol: string
  company: string
  date: string
  time?: string
  period?: string
  estimate?: number
  actual?: number
  surprise?: number
  surprisePct?: number
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function daysFromNow(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d     = new Date(dateStr + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function SurpriseBadge({ pct }: { pct: number }) {
  const up    = pct >= 0
  const color = up ? 'var(--green)' : 'var(--red)'
  const Icon  = up ? TrendingUp : TrendingDown
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}>
      <Icon size={11} />
      {up ? '+' : ''}{fmt(pct)}%
    </span>
  )
}

export default function ResultsCalendarPage() {
  const { data, isLoading, mutate } = useSWR('/api/market/results-calendar', fetcher, {
    refreshInterval: 60 * 60 * 1000,
  })

  const [search, setSearch]   = useState('')
  const [view,   setView]     = useState<'upcoming' | 'recent' | 'all'>('upcoming')

  const events: ResultEvent[] = data?.events ?? []
  const today = new Date().toISOString().slice(0, 10)
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    let d = [...events]
    if (search.trim()) {
      const q = search.trim().toUpperCase()
      d = d.filter(e => e.symbol.includes(q) || (e.company ?? '').toUpperCase().includes(q))
    }
    if (view === 'upcoming') d = d.filter(e => e.date >= today && e.date <= next7)
    if (view === 'recent')   d = d.filter(e => e.date < today)
    return d
  }, [events, search, view, today, next7])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ResultEvent[]>()
    for (const e of filtered) {
      const key = e.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    // Sort dates
    return Array.from(map.entries()).sort((a, b) =>
      view === 'recent' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    )
  }, [filtered, view])

  const upcoming = events.filter(e => e.date >= today && e.date <= next7)
  const withActual = events.filter(e => e.actual !== undefined)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={20} style={{ color: 'var(--green)' }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Results Calendar</h1>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Earnings announcements · EPS tracker</div>
            </div>
          </div>
          <button
            onClick={() => mutate()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Next 7 Days',    value: upcoming.length,    color: 'var(--green)' },
            { label: 'Total Events',   value: events.length,      color: 'var(--text)' },
            { label: 'With Results',   value: withActual.length,  color: 'var(--cyan)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by symbol…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['upcoming', 'recent', 'all'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', fontSize: 11, border: 'none', cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                background: view === v ? 'var(--green)' : 'transparent',
                color: view === v ? '#000' : 'var(--text-muted)',
                fontWeight: view === v ? 700 : 400, textTransform: 'capitalize',
              }}>
                {v === 'upcoming' ? 'Upcoming (7d)' : v === 'recent' ? 'Recent' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar groups */}
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading results calendar…</div>
        ) : grouped.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {events.length === 0 ? 'No results available from NSE' : 'No events match the current filter'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {grouped.map(([date, dayEvents]) => {
              const days  = daysFromNow(date)
              const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : null
              const isPast = days < 0

              return (
                <div key={date}>
                  {/* Date header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Calendar size={13} style={{ color: isPast ? 'var(--text-dim)' : 'var(--green)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isPast ? 'var(--text-muted)' : 'var(--text)' }}>
                      {formatDateLabel(date)}
                    </span>
                    {label && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: label === 'Today' ? 'var(--green)' : 'rgba(255,255,255,0.08)',
                        color: label === 'Today' ? '#000' : 'var(--text-muted)',
                      }}>
                        {label}
                      </span>
                    )}
                    {!isPast && days > 1 && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
                        in {days} days
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{dayEvents.length} companies</span>
                  </div>

                  <TerminalCard noPadding accent={isPast ? 'amber' : 'green'}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Symbol', 'Company', 'Period', 'Estimate EPS', 'Actual EPS', 'Surprise', 'Time'].map(h => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayEvents.map((e, i) => (
                          <tr key={i} style={{ borderBottom: i < dayEvents.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--cyan)' }}>{e.symbol}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.company || '—'}
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 11 }}>{e.period || '—'}</td>
                            <td style={{ padding: '9px 14px', color: 'var(--text)', textAlign: 'right' }}>
                              {e.estimate !== undefined ? fmt(e.estimate) : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', fontWeight: e.actual !== undefined ? 700 : 400, color: 'var(--text)', textAlign: 'right' }}>
                              {e.actual !== undefined ? fmt(e.actual) : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                              {e.surprisePct !== undefined ? <SurpriseBadge pct={e.surprisePct} /> : '—'}
                            </td>
                            <td style={{ padding: '9px 14px', color: 'var(--text-dim)', fontSize: 11 }}>
                              {e.time || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TerminalCard>
                </div>
              )
            })}
          </div>
        )}

        {data?.lastUpdated && (
          <div style={{ marginTop: 16, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
            Last updated: {new Date(data.lastUpdated).toLocaleString('en-IN')}
          </div>
        )}
      </div>
    </div>
  )
}
