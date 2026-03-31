'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import { CalendarDays, Clock, Plus, RefreshCw, X, ChevronLeft, ChevronRight, Globe } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type EventType = 'fo_expiry' | 'rbi_mpc' | 'budget' | 'rebalancing' | 'fed' | 'us_cpi' | 'us_ppi' | 'custom'

interface EconomicEvent {
  id?: number
  date: string
  title: string
  description?: string
  type: EventType
  country: string
  importance: 'high' | 'medium' | 'low'
  daysAway?: number
}

const TYPE_STYLE: Record<EventType, { color: string; bg: string; label: string }> = {
  fo_expiry:   { color: 'var(--amber)',   bg: 'rgba(251,191,36,0.12)',  label: 'F&O Expiry'   },
  rbi_mpc:     { color: 'var(--cyan)',    bg: 'rgba(34,211,238,0.12)',  label: 'RBI MPC'      },
  budget:      { color: 'var(--green)',   bg: 'rgba(34,197,94,0.12)',   label: 'Budget'       },
  rebalancing: { color: 'var(--text)',    bg: 'rgba(255,255,255,0.08)', label: 'Rebalancing'  },
  fed:         { color: '#a78bfa',        bg: 'rgba(139,92,246,0.12)',  label: 'US Fed'       },
  us_cpi:      { color: '#a78bfa',        bg: 'rgba(139,92,246,0.12)',  label: 'US CPI'       },
  us_ppi:      { color: '#a78bfa',        bg: 'rgba(139,92,246,0.12)',  label: 'US PPI'       },
  custom:      { color: 'var(--green)',   bg: 'rgba(34,197,94,0.12)',   label: 'Custom'       },
}

function EventBadge({ type }: { type: EventType }) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.custom
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
      background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  )
}

function ImportanceDot({ level }: { level: 'high' | 'medium' | 'low' }) {
  const c = level === 'high' ? 'var(--red)' : level === 'medium' ? 'var(--amber)' : 'var(--text-dim)'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
}

function getMonthDays(year: number, month: number) {
  const first  = new Date(year, month, 1)
  const days: Array<{ date: string; day: number; inMonth: boolean }> = []

  // Fill from Monday before first day
  const startDow = (first.getDay() + 6) % 7  // 0=Mon
  for (let i = startDow; i > 0; i--) {
    const d = new Date(year, month, 1 - i)
    days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false })
  }

  // Fill month days
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d).toISOString().slice(0, 10), day: d, inMonth: true })
  }

  // Pad to 6 weeks
  while (days.length % 7 !== 0 || days.length < 35) {
    const last = days[days.length - 1]
    const next = new Date(last.date + 'T00:00:00')
    next.setDate(next.getDate() + 1)
    days.push({ date: next.toISOString().slice(0, 10), day: next.getDate(), inMonth: false })
    if (days.length >= 42) break
  }

  return days
}

interface AddEventForm {
  date: string; title: string; description: string; type: EventType; country: string; importance: 'high'|'medium'|'low'
}

const DEFAULT_FORM: AddEventForm = { date: '', title: '', description: '', type: 'custom', country: 'IN', importance: 'medium' }

export default function CalendarPage() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const [viewMode, setViewMode]   = useState<'month' | 'week' | 'list'>('month')
  const [curYear,  setCurYear]    = useState(today.getFullYear())
  const [curMonth, setCurMonth]   = useState(today.getMonth())
  const [showAdd,  setShowAdd]    = useState(false)
  const [form,     setForm]       = useState<AddEventForm>(DEFAULT_FORM)
  const [saving,   setSaving]     = useState(false)
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')

  const { data, isLoading, mutate } = useSWR('/api/market/economic-calendar?days=180', fetcher, {
    refreshInterval: 60 * 60 * 1000,
  })

  const events: EconomicEvent[] = data?.events ?? []

  // Next event
  const nextEvent = events.find(e => (e.daysAway ?? 0) >= 0)

  // Filter by type
  const visibleEvents = useMemo(() =>
    filterType === 'all' ? events : events.filter(e => e.type === filterType),
    [events, filterType]
  )

  // Group by date for list view
  const listGrouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>()
    for (const e of visibleEvents) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [visibleEvents])

  // Calendar cell events
  const eventsByDate = useMemo(() => {
    const m = new Map<string, EconomicEvent[]>()
    for (const e of visibleEvents) {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    return m
  }, [visibleEvents])

  const monthDays = useMemo(() => getMonthDays(curYear, curMonth), [curYear, curMonth])

  function prevMonth() {
    if (curMonth === 0) { setCurYear(y => y - 1); setCurMonth(11) }
    else setCurMonth(m => m - 1)
  }
  function nextMonth() {
    if (curMonth === 11) { setCurYear(y => y + 1); setCurMonth(0) }
    else setCurMonth(m => m + 1)
  }

  async function saveEvent() {
    if (!form.date || !form.title) return
    setSaving(true)
    try {
      await fetch('/api/market/economic-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      mutate()
      setShowAdd(false)
      setForm(DEFAULT_FORM)
    } finally {
      setSaving(false)
    }
  }

  const monthName = new Date(curYear, curMonth).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={20} style={{ color: 'var(--cyan)' }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Economic Calendar</h1>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                F&O Expiry · RBI MPC · Fed · Budget · Custom events
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => mutate()} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
              <RefreshCw size={12} />
            </button>
            <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--cyan)', border: 'none', borderRadius: 6, color: '#000', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              <Plus size={13} /> Add Event
            </button>
          </div>
        </div>

        {/* Next event banner */}
        {nextEvent && (
          <div style={{
            background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Clock size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Next event</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{nextEvent.title}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>
                {nextEvent.daysAway === 0 ? 'Today' : `${nextEvent.daysAway}d`}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{nextEvent.date}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['month', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: '6px 14px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: viewMode === v ? 'var(--cyan)' : 'transparent',
                color: viewMode === v ? '#000' : 'var(--text-muted)',
                fontWeight: viewMode === v ? 700 : 400, textTransform: 'capitalize',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {v === 'list' ? 'List' : 'Month'}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'fo_expiry', 'rbi_mpc', 'budget', 'fed', 'custom'] as const).map(t => {
              const s = t === 'all' ? { color: 'var(--text)', bg: 'rgba(255,255,255,0.08)', label: 'All' } : TYPE_STYLE[t as EventType]
              return (
                <button key={t} onClick={() => setFilterType(t)} style={{
                  padding: '4px 10px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                  background: filterType === t ? (s?.bg ?? 'rgba(255,255,255,0.08)') : 'var(--surface)',
                  color: filterType === t ? (s?.color ?? 'var(--text)') : 'var(--text-muted)',
                  border: `1px solid ${filterType === t ? (s?.color ?? 'var(--border)') : 'var(--border)'}`,
                  fontWeight: filterType === t ? 700 : 400, fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {s?.label ?? t}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading calendar…</div>
        ) : viewMode === 'month' ? (
          /* ─── Month View ─── */
          <div>
            {/* Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', padding: '5px 8px', cursor: 'pointer' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 700, minWidth: 160, textAlign: 'center' }}>{monthName}</span>
              <button onClick={nextMonth} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', padding: '5px 8px', cursor: 'pointer' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 1 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '6px 0', fontWeight: 600, letterSpacing: '0.05em' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {monthDays.map(({ date, day, inMonth }) => {
                const cellEvents = eventsByDate.get(date) ?? []
                const isToday    = date === todayStr
                return (
                  <div key={date} style={{
                    minHeight: 80, background: inMonth ? 'var(--surface)' : 'rgba(255,255,255,0.02)',
                    border: isToday ? '1px solid var(--cyan)' : '1px solid var(--border)',
                    borderRadius: 6, padding: '6px',
                    opacity: inMonth ? 1 : 0.4,
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: isToday ? 700 : 400,
                      color: isToday ? 'var(--cyan)' : inMonth ? 'var(--text)' : 'var(--text-dim)',
                      marginBottom: 4,
                    }}>
                      {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {cellEvents.slice(0, 3).map((e, i) => {
                        const s = TYPE_STYLE[e.type] ?? TYPE_STYLE.custom
                        return (
                          <div key={i} title={e.title} style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 3,
                            background: s.bg, color: s.color,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            cursor: 'default',
                          }}>
                            {e.title}
                          </div>
                        )
                      })}
                      {cellEvents.length > 3 && (
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', paddingLeft: 2 }}>
                          +{cellEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ─── List View ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listGrouped.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No events found</div>
            ) : listGrouped.map(([date, dayEvents]) => {
              const d = new Date(date + 'T00:00:00')
              const daysAway = dayEvents[0].daysAway ?? 0
              const label = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : null

              return (
                <TerminalCard key={date} noPadding>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {label && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--cyan)', color: '#000' }}>
                        {label}
                      </span>
                    )}
                    {daysAway > 1 && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>in {daysAway}d</span>
                    )}
                  </div>
                  {dayEvents.map((e, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px',
                      borderBottom: i < dayEvents.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <ImportanceDot level={e.importance} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{e.title}</span>
                          <EventBadge type={e.type} />
                          {e.country !== 'IN' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                              <Globe size={9} />{e.country}
                            </span>
                          )}
                        </div>
                        {e.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{e.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </TerminalCard>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Add Custom Event</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Date *', key: 'date' as const, type: 'date' },
                { label: 'Title *', key: 'title' as const, type: 'text' },
                { label: 'Description', key: 'description' as const, type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 12px', background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Importance</label>
                  <select value={form.importance} onChange={e => setForm(p => ({ ...p, importance: e.target.value as any }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}>
                    {['high', 'medium', 'low'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Country</label>
                  <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}>
                    {['IN', 'US', 'GLOBAL'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={saveEvent}
                disabled={saving || !form.date || !form.title}
                style={{
                  padding: '10px', background: form.date && form.title ? 'var(--cyan)' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: form.date && form.title ? '#000' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 700, cursor: form.date && form.title ? 'pointer' : 'not-allowed',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {saving ? 'Saving…' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
