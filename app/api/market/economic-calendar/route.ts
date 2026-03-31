import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getDb } from '@/lib/db'

const TTL_1HR = 60 * 60 * 1000

export type EventType = 'fo_expiry' | 'rbi_mpc' | 'budget' | 'rebalancing' | 'fed' | 'us_cpi' | 'us_ppi' | 'custom'

export interface EconomicEvent {
  id?: number
  date: string
  title: string
  description?: string
  type: EventType
  country: 'IN' | 'US' | 'GLOBAL'
  importance: 'high' | 'medium' | 'low'
  daysAway?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function lastThursdayOfMonth(year: number, month: number): string {
  // month: 1-based
  const d = new Date(year, month, 0) // last day of month
  const dow = d.getDay() // 0=Sun … 6=Sat
  const offset = (dow >= 4) ? dow - 4 : dow + 3
  d.setDate(d.getDate() - offset)
  return d.toISOString().slice(0, 10)
}

function generateFOExpiries(fromYear: number, toYear: number): EconomicEvent[] {
  const events: EconomicEvent[] = []
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      events.push({
        date:        lastThursdayOfMonth(y, m),
        title:       `F&O Monthly Expiry – ${new Date(y, m - 1).toLocaleString('en-IN', { month: 'short' })} ${y}`,
        description: 'NSE & BSE Futures & Options monthly expiry',
        type:        'fo_expiry',
        country:     'IN',
        importance:  'high',
      })
    }
  }
  return events
}

// RBI MPC dates (announced schedule for 2025-2026)
const RBI_MPC_DATES: Array<{ start: string; end: string }> = [
  { start: '2025-02-05', end: '2025-02-07' },
  { start: '2025-04-07', end: '2025-04-09' },
  { start: '2025-06-04', end: '2025-06-06' },
  { start: '2025-08-05', end: '2025-08-07' },
  { start: '2025-09-29', end: '2025-10-01' },
  { start: '2025-12-03', end: '2025-12-05' },
  { start: '2026-02-04', end: '2026-02-06' },
  { start: '2026-04-01', end: '2026-04-03' },
  { start: '2026-06-03', end: '2026-06-05' },
  { start: '2026-08-04', end: '2026-08-06' },
]

function generateRBIMPC(): EconomicEvent[] {
  return RBI_MPC_DATES.map(({ start, end }) => ({
    date:        end,
    title:       `RBI MPC Decision – ${new Date(end + 'T00:00:00').toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`,
    description: `Monetary Policy Committee meeting ${start} to ${end}. Rate decision announced on last day.`,
    type:        'rbi_mpc' as EventType,
    country:     'IN' as const,
    importance:  'high' as const,
  }))
}

// US Fed FOMC meeting dates 2025-2026
const FED_DATES: string[] = [
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
  '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
]

function generateFED(): EconomicEvent[] {
  return FED_DATES.map(date => ({
    date,
    title:       `US Fed FOMC Decision – ${new Date(date + 'T00:00:00').toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
    description: 'Federal Open Market Committee rate decision',
    type:        'fed' as EventType,
    country:     'US' as const,
    importance:  'high' as const,
  }))
}

// Major index rebalancing (approximate)
const REBALANCING_DATES: Array<{ date: string; title: string }> = [
  { date: '2025-03-28', title: 'Nifty 50 Semi-Annual Rebalancing (Mar 2025)' },
  { date: '2025-06-27', title: 'Nifty 50 Semi-Annual Rebalancing (Jun 2025)' },
  { date: '2025-09-26', title: 'Nifty 50 Semi-Annual Rebalancing (Sep 2025)' },
  { date: '2025-12-26', title: 'Nifty 50 Semi-Annual Rebalancing (Dec 2025)' },
  { date: '2026-03-27', title: 'Nifty 50 Semi-Annual Rebalancing (Mar 2026)' },
  { date: '2026-06-26', title: 'Nifty 50 Semi-Annual Rebalancing (Jun 2026)' },
  { date: '2026-09-25', title: 'Nifty 50 Semi-Annual Rebalancing (Sep 2026)' },
  { date: '2026-12-25', title: 'Nifty 50 Semi-Annual Rebalancing (Dec 2026)' },
]

function generateRebalancing(): EconomicEvent[] {
  return REBALANCING_DATES.map(r => ({
    date:       r.date,
    title:      r.title,
    description: 'Effective date of index reconstitution',
    type:       'rebalancing' as EventType,
    country:    'IN' as const,
    importance: 'medium' as const,
  }))
}

// Budget dates
const BUDGET_DATES: EconomicEvent[] = [
  {
    date: '2025-02-01',
    title: 'Union Budget 2025-26',
    description: 'Annual Union Budget presentation in Parliament',
    type: 'budget', country: 'IN', importance: 'high',
  },
  {
    date: '2026-02-01',
    title: 'Union Budget 2026-27',
    description: 'Annual Union Budget presentation in Parliament',
    type: 'budget', country: 'IN', importance: 'high',
  },
]

// ── DB ────────────────────────────────────────────────────────────────────

function initTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS economic_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    type        TEXT NOT NULL DEFAULT 'custom',
    country     TEXT NOT NULL DEFAULT 'IN',
    importance  TEXT NOT NULL DEFAULT 'medium',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

function loadCustomEvents(): EconomicEvent[] {
  try {
    initTable()
    const db = getDb()
    const rows = db.prepare('SELECT * FROM economic_events ORDER BY date').all() as any[]
    return rows.map(r => ({
      id:          r.id,
      date:        r.date,
      title:       r.title,
      description: r.description ?? undefined,
      type:        r.type as EventType,
      country:     r.country,
      importance:  r.importance,
    }))
  } catch {
    return []
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '90', 10)

  const cacheKey = `economic-calendar-${days}`
  const cached = cache.get<EconomicEvent[]>(cacheKey)
  if (cached) return NextResponse.json({ events: cached })

  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const endDate = new Date(today); endDate.setDate(endDate.getDate() + days)
  const todayStr  = today.toISOString().slice(0, 10)
  const endStr    = endDate.toISOString().slice(0, 10)

  const currentYear = today.getFullYear()
  const endYear     = endDate.getFullYear()

  const all: EconomicEvent[] = [
    ...generateFOExpiries(currentYear, endYear + 1),
    ...generateRBIMPC(),
    ...generateFED(),
    ...generateRebalancing(),
    ...BUDGET_DATES,
    ...loadCustomEvents(),
  ]

  // Filter to window
  const events = all
    .filter(e => e.date >= todayStr && e.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({
      ...e,
      daysAway: Math.round((new Date(e.date + 'T00:00:00').getTime() - today.getTime()) / 86400000),
    }))

  cache.set(cacheKey, events, TTL_1HR)
  return NextResponse.json({ events }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
  })
}

export async function POST(req: Request) {
  try {
    initTable()
    const db   = getDb()
    const body = await req.json()
    const { date, title, description, type = 'custom', country = 'IN', importance = 'medium' } = body

    if (!date || !title) {
      return NextResponse.json({ error: 'date and title are required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO economic_events (date, title, description, type, country, importance)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date, title, description ?? null, type, country, importance)

    // Bust cache
    for (const k of ['90', '30', '180']) {
      cache.del(`economic-calendar-${k}`)
    }

    return NextResponse.json({ id: result.lastInsertRowid, date, title, type, country, importance })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
