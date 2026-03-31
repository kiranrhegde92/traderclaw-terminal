'use client'
import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { timeAgo } from '@/lib/utils/date'
import {
  Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown,
  Minus, Bell, Filter, X, BarChart2, Calendar, Zap, Rss, Plus, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { RSS_SOURCES } from '@/lib/news/sources'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const BUILTIN_SOURCES = [{ id: 'all', name: 'All Sources' }, ...RSS_SOURCES]

// ── helpers ──────────────────────────────────────────────────────────────────
function highlightText(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return <>{text}</>
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        re.test(p)
          ? <mark key={i} style={{ background: 'rgba(255,183,0,0.35)', color: 'var(--amber)', borderRadius: 2, padding: '0 1px' }}>{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function articleMatchesKeyword(title: string, summary: string, keywords: string[]): string | null {
  const haystack = `${title} ${summary}`.toLowerCase()
  for (const kw of keywords) {
    if (haystack.includes(kw.toLowerCase())) return kw
  }
  return null
}

// ── SVG Sentiment Trend Chart ─────────────────────────────────────────────────
function SentimentChart({ news }: { news: any[] }) {
  const W = 520, H = 130, PAD = { top: 12, right: 12, bottom: 28, left: 32 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  // Build last 7 days
  const days: { label: string; date: string; pos: number; neg: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    days.push({ label, date: iso, pos: 0, neg: 0 })
  }

  for (const item of news) {
    const d = (item.published_at ?? '').slice(0, 10)
    const bucket = days.find(b => b.date === d)
    if (!bucket) continue
    if (item.sentiment === 'positive') bucket.pos++
    else if (item.sentiment === 'negative') bucket.neg++
  }

  const maxVal = Math.max(1, ...days.map(d => Math.max(d.pos, d.neg)))
  const scaleY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH
  const scaleX = (i: number) => PAD.left + (i / (days.length - 1)) * innerW

  const polyline = (vals: number[], color: string) => {
    const pts = vals.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ')
    return <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  }
  const dots = (vals: number[], color: string) =>
    vals.map((v, i) => (
      <circle key={i} cx={scaleX(i)} cy={scaleY(v)} r={3} fill={color} />
    ))

  const todayPos = days[days.length - 1]?.pos ?? 0
  const todayNeg = days[days.length - 1]?.neg ?? 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Today: <span style={{ color: 'var(--green)' }}>{todayPos} positive</span>, <span style={{ color: 'var(--red)' }}>{todayNeg} negative</span></span>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block' }} /> Positive</span>
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 2, background: 'var(--red)', display: 'inline-block' }} /> Negative</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} overflow="visible">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PAD.top + innerH * (1 - t)
          return <line key={i} x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y}
            stroke="#1e1e1e" strokeWidth="1" />
        })}
        {/* Y labels */}
        {[0, Math.round(maxVal / 2), maxVal].map((v, i) => {
          const y = scaleY(v)
          return <text key={i} x={PAD.left - 4} y={y + 4} textAnchor="end"
            fontSize={8} fill="var(--text-muted)">{v}</text>
        })}
        {/* Lines */}
        {polyline(days.map(d => d.pos), 'var(--green)')}
        {polyline(days.map(d => d.neg), 'var(--red)')}
        {dots(days.map(d => d.pos), 'var(--green)')}
        {dots(days.map(d => d.neg), 'var(--red)')}
        {/* X labels */}
        {days.map((d, i) => (
          <text key={i} x={scaleX(i)} y={H - 4} textAnchor="middle"
            fontSize={8} fill="var(--text-muted)">{d.label}</text>
        ))}
      </svg>
    </div>
  )
}

// ── Keyword Alerts Panel ──────────────────────────────────────────────────────
function KeywordAlertsPanel({ onKeywordsChange }: { onKeywordsChange: (kws: string[]) => void }) {
  const { data, mutate } = useSWR('/api/news/keywords', fetcher)
  const keywords: any[] = data?.data ?? []
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const kwString = keywords.map((k: any) => k.keyword).join(',')
  const prevKwRef = useRef<string>('')
  useEffect(() => {
    if (kwString !== prevKwRef.current) {
      prevKwRef.current = kwString
      onKeywordsChange(kwString ? kwString.split(',') : [])
    }
  }) // no dep array — runs every render but bails early via ref

  const addKeyword = async () => {
    if (!input.trim()) return
    setLoading(true)
    await fetch('/api/news/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: input.trim() }),
    })
    setInput('')
    setLoading(false)
    mutate()
  }

  const removeKeyword = async (id: number) => {
    await fetch('/api/news/keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    mutate()
  }

  return (
    <TerminalCard title="Keyword Alerts" icon={<Bell size={12} />} accent="amber">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="e.g. RBI, rate hike, Infosys..."
            className="input-terminal flex-1 text-xs"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          />
          <button onClick={addKeyword} disabled={loading} className="btn btn-sm btn-amber">
            Add Alert
          </button>
        </div>
        {keywords.length === 0 ? (
          <div className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>
            No keyword alerts. Add one above.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw: any) => (
              <span key={kw.id} className="badge badge-amber flex items-center gap-1" style={{ cursor: 'default' }}>
                <Bell size={9} />
                {kw.keyword}
                <button onClick={() => removeKeyword(kw.id)} style={{ lineHeight: 1, marginLeft: 2 }}>
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </TerminalCard>
  )
}

// ── Earnings Calendar Panel ───────────────────────────────────────────────────
function EarningsCalendarPanel({ earningsMap }: { earningsMap: Record<string, any> }) {
  const { data, isLoading } = useSWR('/api/news/earnings-calendar', fetcher)
  const calendar: any[] = data?.data ?? []

  return (
    <TerminalCard title="Earnings Calendar" icon={<Calendar size={12} />} accent="amber">
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 justify-center"><Spinner /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span></div>
      ) : (
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                {['Company', 'Results Date', 'EPS Est.', 'Prev EPS'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', color: 'var(--text-muted)', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendar.map((row: any) => (
                <tr key={row.symbol} style={{ borderBottom: '1px solid #111' }}
                  className={row.upcoming ? 'bg-amber-flash' : ''}>
                  <td style={{ padding: '4px 6px', color: 'var(--text)' }}>
                    <span className="font-bold" style={{ color: 'var(--cyan)' }}>{row.symbol}</span>
                    <br /><span style={{ color: 'var(--text-muted)' }}>{row.company}</span>
                  </td>
                  <td style={{ padding: '4px 6px', color: 'var(--text)' }}>
                    {row.resultsDate}
                    {row.upcoming && (
                      <span className="badge badge-amber ml-1" style={{ fontSize: '9px' }}>📅 Soon</span>
                    )}
                  </td>
                  <td style={{ padding: '4px 6px', color: 'var(--green)' }}>₹{row.epsEstimate}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--text-dim)' }}>₹{row.prevEps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TerminalCard>
  )
}

// ── Economic Calendar Panel ───────────────────────────────────────────────────
const IMPORTANCE_META: Record<string, { color: string; label: string }> = {
  high:   { color: 'var(--red)',    label: '●●● HIGH'   },
  medium: { color: 'var(--amber)',  label: '●●○ MED'    },
  low:    { color: 'var(--text-dim)', label: '●○○ LOW'  },
}
const TYPE_META: Record<string, { color: string; icon: string }> = {
  fo_expiry:   { color: 'var(--cyan)',   icon: '📆' },
  rbi_mpc:     { color: 'var(--red)',    icon: '🏦' },
  budget:      { color: 'var(--amber)',  icon: '💰' },
  rebalancing: { color: 'var(--green)',  icon: '⚖️' },
  fed:         { color: '#387ed1',       icon: '🇺🇸' },
  us_cpi:      { color: '#387ed1',       icon: '📊' },
  us_ppi:      { color: '#387ed1',       icon: '📊' },
  custom:      { color: 'var(--text)',   icon: '📌' },
}
function EconomicCalendarPanel() {
  const [days, setDays] = useState(90)
  const [filterType, setFilterType] = useState<string>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ date: '', title: '', description: '', type: 'custom', country: 'IN', importance: 'medium' })
  const [adding, setAdding] = useState(false)

  const { data, isLoading, mutate } = useSWR(`/api/market/economic-calendar?days=${days}`, fetcher)
  const events: any[] = data?.events ?? []

  const filtered = filterType === 'all' ? events : events.filter(e => e.type === filterType)

  const typeGroups = ['fo_expiry', 'rbi_mpc', 'fed', 'budget', 'rebalancing', 'us_cpi', 'us_ppi', 'custom']
  const counts: Record<string, number> = {}
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    await fetch('/api/market/economic-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ date: '', title: '', description: '', type: 'custom', country: 'IN', importance: 'medium' })
    setShowAdd(false)
    setAdding(false)
    mutate()
  }

  // Group events by month
  const byMonth: Record<string, any[]> = {}
  for (const ev of filtered) {
    const month = ev.date.slice(0, 7) // YYYY-MM
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(ev)
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <TerminalCard title="Economic Calendar" icon={<Calendar size={12}/>} accent="amber"
        action={
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(+e.target.value)} className="term-select" style={{ fontSize: 11, padding: '2px 6px' }}>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
            <button onClick={() => setShowAdd(v => !v)} className="btn btn-sm btn-amber">
              <Plus size={10}/> Add Event
            </button>
          </div>
        }
      >
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 mb-4">
          <button onClick={() => setFilterType('all')}
            className={`btn btn-sm ${filterType === 'all' ? 'btn-amber' : 'btn-ghost'}`}>
            All ({events.length})
          </button>
          {typeGroups.filter(t => (counts[t] ?? 0) > 0).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`btn btn-sm ${filterType === t ? 'btn-amber' : 'btn-ghost'}`}
              style={{ fontSize: 10 }}>
              {TYPE_META[t]?.icon} {t.replace(/_/g, ' ').toUpperCase()} ({counts[t] ?? 0})
            </button>
          ))}
        </div>

        {/* Add event form */}
        {showAdd && (
          <form onSubmit={addEvent}
            style={{ background: 'rgba(255,183,0,0.04)', border: '1px solid rgba(255,183,0,0.2)', borderRadius: 6, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>DATE</div>
                <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-terminal" style={{ padding: '4px 8px', fontSize: 11, width: '100%' }}/>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>TITLE</div>
                <input type="text" required placeholder="Event name" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input-terminal" style={{ padding: '4px 8px', fontSize: 11, width: '100%' }}/>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>IMPORTANCE</div>
                <select value={form.importance} onChange={e => setForm(f => ({ ...f, importance: e.target.value }))}
                  className="term-select" style={{ width: '100%', fontSize: 11 }}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>COUNTRY</div>
                <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  className="term-select" style={{ width: '100%', fontSize: 11 }}>
                  <option value="IN">India</option>
                  <option value="US">US</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={adding} className="btn btn-sm btn-amber">
                {adding ? 'Adding…' : 'Add Event'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn btn-sm btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 gap-2"><Spinner size={16}/><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading calendar...</span></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No events in the selected range</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byMonth).map(([month, monthEvents]) => (
              <div key={month}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', fontFamily: 'JetBrains Mono', marginBottom: 10, letterSpacing: '0.08em' }}>
                  {new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
                </div>
                <div className="space-y-2">
                  {monthEvents.map((ev, i) => {
                    const imp     = IMPORTANCE_META[ev.importance] ?? IMPORTANCE_META.low
                    const typ     = TYPE_META[ev.type] ?? TYPE_META.custom
                    const isToday = ev.daysAway === 0
                    const isPast  = ev.daysAway < 0
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 12px', borderRadius: 6,
                        background: isToday ? 'rgba(255,183,0,0.06)' : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${isToday ? 'rgba(255,183,0,0.3)' : 'var(--border)'}`,
                        opacity: isPast ? 0.5 : 1,
                      }}>
                        {/* Date block */}
                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 42 }}>
                          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 700, color: isPast ? 'var(--text-dim)' : 'var(--text)', lineHeight: 1 }}>
                            {ev.date.slice(8)}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                            {new Date(ev.date + 'T00:00:00').toLocaleString('en-IN', { weekday: 'short' }).toUpperCase()}
                          </div>
                        </div>

                        {/* Event info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13 }}>{typ.icon}</span>
                            <span style={{ fontWeight: 700, color: typ.color, fontSize: 12, fontFamily: 'JetBrains Mono' }}>{ev.title}</span>
                            {isToday && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', background: 'rgba(255,183,0,0.15)', border: '1px solid rgba(255,183,0,0.4)', borderRadius: 3, padding: '1px 5px' }}>TODAY</span>}
                          </div>
                          {ev.description && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{ev.description}</div>
                          )}
                        </div>

                        {/* Meta */}
                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: imp.color, fontFamily: 'JetBrains Mono' }}>{imp.label}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                            {ev.daysAway === 0 ? 'Today' : ev.daysAway > 0 ? `in ${ev.daysAway}d` : `${Math.abs(ev.daysAway)}d ago`}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                            {ev.country === 'IN' ? '🇮🇳' : ev.country === 'US' ? '🇺🇸' : '🌍'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </TerminalCard>
    </div>
  )
}

// ── RSS Feeds Panel ───────────────────────────────────────────────────────────
function RssFeedsPanel({ onSourcesChange }: { onSourcesChange: (ids: string[]) => void }) {
  const { data, mutate } = useSWR('/api/news/sources', fetcher)
  const custom: any[] = data?.custom ?? []

  const [form,    setForm]    = useState({ name: '', url: '', color: '#00ff41' })
  const [adding,  setAdding]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const customKey = custom.filter((s: any) => s.enabled).map((s: any) => `custom_${s.id}`).join(',')
  const prevCustomRef = useRef<string>('')
  useEffect(() => {
    if (customKey !== prevCustomRef.current) {
      prevCustomRef.current = customKey
      onSourcesChange(customKey ? customKey.split(',') : [])
    }
  }) // no dep array — bails early via ref

  const addFeed = async () => {
    if (!form.name.trim() || !form.url.trim()) { setError('Name and URL are required'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/news/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setForm({ name: '', url: '', color: '#00ff41' })
      setAdding(false)
      mutate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFeed = async (id: number, enabled: boolean) => {
    await fetch('/api/news/sources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    mutate()
  }

  const deleteFeed = async (id: number) => {
    await fetch(`/api/news/sources?id=${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <TerminalCard title="RSS Feeds" icon={<Rss size={12} />} accent="amber">
      <div className="space-y-3">

        {/* Built-in feeds (read-only) */}
        <div className="space-y-1">
          <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>BUILT-IN</div>
          {RSS_SOURCES.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span className="text-xs flex-1" style={{ color: 'var(--text-dim)' }}>{s.name}</span>
              <span className="badge badge-green" style={{ fontSize: '9px' }}>on</span>
            </div>
          ))}
        </div>

        {/* Custom feeds */}
        {custom.length > 0 && (
          <div className="space-y-1 pt-2 border-t" style={{ borderColor: '#1e1e1e' }}>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>CUSTOM</div>
            {custom.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 py-1">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span className="text-xs flex-1 truncate" style={{ color: s.enabled ? 'var(--text)' : 'var(--text-muted)' }} title={s.url}>
                  {s.name}
                </span>
                <button
                  onClick={() => toggleFeed(s.id, !s.enabled)}
                  className="text-xs"
                  style={{ color: s.enabled ? 'var(--green)' : 'var(--text-muted)', fontSize: '9px', fontFamily: 'JetBrains Mono' }}
                  title={s.enabled ? 'Disable' : 'Enable'}>
                  {s.enabled ? 'on' : 'off'}
                </button>
                <button onClick={() => deleteFeed(s.id)} style={{ color: 'var(--text-muted)' }} title="Delete">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add feed form */}
        {adding ? (
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: '#1e1e1e' }}>
            <input
              placeholder="Feed name (e.g. Mint Markets)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-terminal w-full text-xs"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            />
            <input
              placeholder="RSS URL (e.g. https://...)"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="input-terminal w-full text-xs"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Color</label>
              <input type="color" value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              />
              <button onClick={addFeed} disabled={loading} className="btn btn-sm btn-amber ml-auto">
                {loading ? <Spinner size={10} /> : <Plus size={10} />} Add
              </button>
              <button onClick={() => { setAdding(false); setError('') }} className="btn btn-sm btn-ghost">
                <X size={10} />
              </button>
            </div>
            {error && <div className="text-xs" style={{ color: 'var(--red)' }}>{error}</div>}
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-sm btn-ghost w-full flex items-center gap-1">
            <Plus size={10} /> Add RSS Feed
          </button>
        )}
      </div>
    </TerminalCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NewsPage() {
  const [sourceFilter,    setSourceFilter]    = useState('all')
  const [selected,        setSelected]        = useState<any>(null)
  const [symbolFilter,    setSymbolFilter]    = useState('')
  const [symbolInput,     setSymbolInput]     = useState('')
  const [activeTab,       setActiveTab]       = useState<'feed' | 'earnings' | 'calendar'>('feed')
  const [keywords,        setKeywords]        = useState<string[]>([])
  const [customSourceIds, setCustomSourceIds] = useState<string[]>([])
  const [inlineImpacts,   setInlineImpacts]   = useState<Record<string | number, any>>({})
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null)
  const analyzeRef = useRef(false)

  const { data: sourcesData } = useSWR('/api/news/sources', fetcher)
  const customSources: any[] = sourcesData?.custom ?? []
  const SOURCES = [
    ...BUILTIN_SOURCES,
    ...customSources.filter((s: any) => s.enabled).map((s: any) => ({ id: `custom_${s.id}`, name: s.name })),
  ]

  const url = sourceFilter === 'all'
    ? '/api/news/feed?limit=60'
    : `/api/news/feed?limit=60&source=${sourceFilter}`

  const { data, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 120000 })
  const allNews: any[] = data?.data ?? []

  // Client-side symbol filter
  const news = symbolFilter
    ? allNews.filter(item =>
        `${item.title} ${item.summary ?? ''}`.toUpperCase().includes(symbolFilter.toUpperCase())
      )
    : allNews

  // Earnings data for badge decoration
  const { data: earnData } = useSWR('/api/news/earnings-calendar', fetcher)
  const earningsMap: Record<string, any> = {}
  for (const e of earnData?.data ?? []) {
    earningsMap[e.symbol] = e
  }

  const applySymbolFilter = () => {
    setSymbolFilter(symbolInput.trim().toUpperCase())
  }

  // ── Sentiment Icon ────────────────────────────────────────────────────────
  const SentIcon = ({ s }: { s: string }) =>
    s === 'positive' ? <TrendingUp size={11} /> :
    s === 'negative' ? <TrendingDown size={11} /> : <Minus size={11} />

  // ── Bulk Analyze All ─────────────────────────────────────────────────────
  const analyzeAll = async () => {
    if (analyzeRef.current) return
    analyzeRef.current = true
    const items = news.filter(item => item.id != null)
    setAnalyzeProgress({ done: 0, total: items.length })

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      try {
        const res = await fetch(`/api/news/impact?id=${item.id}`)
        if (res.ok) {
          const d = await res.json()
          setInlineImpacts(prev => ({ ...prev, [item.id]: d.data ?? d }))
        }
      } catch {/* skip */}
      setAnalyzeProgress({ done: i + 1, total: items.length })
      if (i < items.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    analyzeRef.current = false
  }

  // ── Article Card ─────────────────────────────────────────────────────────
  const renderArticle = (item: any) => {
    const keywordHit = articleMatchesKeyword(item.title, item.summary ?? '', keywords)
    const impact = inlineImpacts[item.id]
    const affectedSymbols = impact?.affectedStocks ?? item.affectedStocks ?? []

    // Check earnings upcoming badge
    const titleUpper = item.title.toUpperCase()
    const earningsBadge = Object.values(earningsMap).find(
      (e: any) => e.upcoming && titleUpper.includes(e.symbol)
    ) as any

    // Highlight terms: symbol filter + keywords
    const highlightTerms: string[] = []
    if (symbolFilter) highlightTerms.push(symbolFilter)
    if (keywordHit) highlightTerms.push(keywordHit)

    return (
      <div key={item.id ?? item.url}
        className="p-3 cursor-pointer transition-all"
        style={{
          background: selected?.id === item.id ? 'rgba(255,183,0,0.05)' : undefined,
          border: keywordHit ? '1px solid rgba(255,183,0,0.4)' : undefined,
          borderRadius: keywordHit ? 4 : undefined,
          margin: keywordHit ? '2px 4px' : undefined,
        }}
        onClick={() => setSelected(item)}>
        <div className="flex items-start gap-2">
          {/* Sentiment badge */}
          <span className={`badge badge-${item.sentiment === 'positive' ? 'green' : item.sentiment === 'negative' ? 'red' : 'dim'} flex-shrink-0 mt-0.5`}>
            <SentIcon s={item.sentiment} />
            {item.sentiment ?? 'neutral'}
          </span>
          <div className="flex-1 min-w-0">
            {/* Title with highlights */}
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium hover:underline block"
              style={{ color: 'var(--text)', textDecoration: 'none' }}
              onClick={e => e.stopPropagation()}>
              {highlightTerms.length > 0
                ? highlightText(item.title, highlightTerms)
                : item.title
              }
            </a>
            {item.summary && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-dim)' }}>
                {item.summary}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{item.source}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{timeAgo(item.published_at)}</span>
              {/* Keyword alert badge */}
              {keywordHit && (
                <span className="badge badge-amber flex items-center gap-1" style={{ fontSize: '9px' }}>
                  <Bell size={8} /> {keywordHit}
                </span>
              )}
              {/* Earnings soon badge */}
              {earningsBadge && (
                <span className="badge badge-amber" style={{ fontSize: '9px' }}>
                  📅 {earningsBadge.symbol} Results Soon
                </span>
              )}
              {/* Affected stocks */}
              {affectedSymbols.slice(0, 3).map((s: any) => (
                <span key={s.symbol} className="badge badge-dim" style={{ fontSize: '9px' }}>{s.symbol}</span>
              ))}
            </div>
            {/* Inline impact results */}
            {impact && (
              <div className="mt-2 p-2 rounded text-xs space-y-1" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                <div className="font-bold" style={{ color: 'var(--amber)', fontSize: '10px' }}>Impact Analysis</div>
                {affectedSymbols.slice(0, 3).map((s: any) => (
                  <div key={s.symbol} className="flex items-center justify-between">
                    <span style={{ color: 'var(--cyan)' }}>{s.symbol}</span>
                    <span style={{ color: s.direction === 'up' ? 'var(--green)' : s.direction === 'down' ? 'var(--red)' : 'var(--text-dim)', fontSize: '10px' }}>
                      {s.direction === 'up' ? '↑' : s.direction === 'down' ? '↓' : '→'} {s.impactPct?.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {affectedSymbols.length === 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>No major stock impact detected</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Topbar title="News Monitor" />
      <div className="page-content space-y-4">

        {/* Source Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          {SOURCES.map(s => (
            <button key={s.id}
              onClick={() => setSourceFilter(s.id)}
              className={`btn btn-sm ${sourceFilter === s.id ? 'btn-amber' : 'btn-ghost'}`}>
              {s.name}
            </button>
          ))}
          <button onClick={() => mutate()} className="btn btn-sm btn-ghost ml-auto">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Symbol Filter Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter by Symbol:</span>
          <input
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySymbolFilter()}
            placeholder="e.g. RELIANCE"
            className="input-terminal text-xs"
            style={{ padding: '3px 8px', fontSize: '11px', width: 140 }}
          />
          <button onClick={applySymbolFilter} className="btn btn-sm btn-amber">Apply</button>
          {symbolFilter && (
            <button onClick={() => { setSymbolFilter(''); setSymbolInput('') }} className="btn btn-sm btn-ghost flex items-center gap-1">
              <X size={10} /> Show All
            </button>
          )}
          {symbolFilter && (
            <span className="text-xs badge badge-amber">
              Showing {news.length} articles for "{symbolFilter}"
            </span>
          )}

          {/* Analyze All button */}
          <div className="ml-auto flex items-center gap-2">
            {analyzeProgress && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <Zap size={10} style={{ display: 'inline', marginRight: 3 }} />
                {analyzeProgress.done}/{analyzeProgress.total} analyzed
              </span>
            )}
            <button
              onClick={analyzeAll}
              disabled={analyzeRef.current || isLoading || news.length === 0}
              className="btn btn-sm btn-ghost flex items-center gap-1">
              <Zap size={10} /> Analyze All
            </button>
          </div>
        </div>

        {/* Tab selector for feed vs earnings */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('feed')}
            className={`btn btn-sm ${activeTab === 'feed' ? 'btn-amber' : 'btn-ghost'}`}>
            <Newspaper size={10} /> News Feed
          </button>
          <button onClick={() => setActiveTab('earnings')}
            className={`btn btn-sm ${activeTab === 'earnings' ? 'btn-amber' : 'btn-ghost'}`}>
            <Calendar size={10} /> Earnings Calendar
          </button>
          <button onClick={() => setActiveTab('calendar')}
            className={`btn btn-sm ${activeTab === 'calendar' ? 'btn-amber' : 'btn-ghost'}`}>
            <Calendar size={10} /> Economic Calendar
          </button>
        </div>

        {activeTab === 'calendar' ? (
          <EconomicCalendarPanel />
        ) : activeTab === 'earnings' ? (
          <EarningsCalendarPanel earningsMap={earningsMap} />
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* News Feed */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <TerminalCard title={`News (${news.length})`} icon={<Newspaper size={12} />} accent="amber" noPadding>
                {isLoading && (
                  <div className="flex items-center justify-center py-16 gap-3">
                    <Spinner /> <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fetching news...</span>
                  </div>
                )}
                <div className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                  {news.map(renderArticle)}
                  {news.length === 0 && !isLoading && (
                    <div className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      No news available. Try refreshing or clearing the filter.
                    </div>
                  )}
                </div>
              </TerminalCard>

              {/* Sentiment Trend Chart */}
              <TerminalCard title="Sentiment Trend (7 Days)" icon={<BarChart2 size={12} />} accent="amber">
                <SentimentChart news={allNews} />
              </TerminalCard>
            </div>

            {/* Right Panel: Detail + Keyword Alerts */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              {/* Impact Analysis Detail */}
              {selected ? (
                <TerminalCard title="Impact Analysis" icon={<TrendingUp size={12} />} accent="amber">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--text)' }}>{selected.title}</h3>
                      <div className="flex gap-2">
                        <span className={`badge badge-${selected.sentiment === 'positive' ? 'green' : selected.sentiment === 'negative' ? 'red' : 'dim'}`}>
                          {selected.sentiment}
                        </span>
                        <span className="badge badge-dim">{selected.source}</span>
                      </div>
                    </div>

                    {selected.summary && (
                      <p className="text-xs" style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
                        {selected.summary}
                      </p>
                    )}

                    {selected.affectedStocks?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold mb-2" style={{ color: 'var(--amber)' }}>Affected Stocks</div>
                        <div className="space-y-2">
                          {selected.affectedStocks.map((s: any) => (
                            <div key={s.symbol} className="flex items-center justify-between p-2 rounded"
                              style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                              <div>
                                <Link href={`/monitor?symbol=${s.symbol}`}
                                  className="text-xs font-bold hover:underline"
                                  style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
                                  {s.symbol}
                                </Link>
                                <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                  Probability: {s.probability}%
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold" style={{
                                  color: s.direction === 'up' ? 'var(--green)' : s.direction === 'down' ? 'var(--red)' : 'var(--text-dim)'
                                }}>
                                  {s.direction === 'up' ? '↑' : s.direction === 'down' ? '↓' : '→'} {s.impactPct?.toFixed(1)}%
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                  est. impact
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <a href={selected.url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-amber w-full" style={{ textDecoration: 'none', display: 'flex' }}>
                      <ExternalLink size={12} /> Read Full Article
                    </a>
                  </div>
                </TerminalCard>
              ) : (
                <TerminalCard title="Impact Analysis" icon={<TrendingUp size={12} />} accent="amber">
                  <div className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    Click a news item to see impact analysis
                  </div>
                </TerminalCard>
              )}

              {/* Keyword Alerts */}
              <KeywordAlertsPanel onKeywordsChange={setKeywords} />

              {/* RSS Feed Manager */}
              <RssFeedsPanel onSourcesChange={setCustomSourceIds} />
            </div>
          </div>
        )}

      </div>
    </>
  )
}
