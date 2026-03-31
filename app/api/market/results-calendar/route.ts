import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getDb } from '@/lib/db'

const TTL_1HR = 60 * 60 * 1000
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'Referer': 'https://www.nseindia.com',
}

export interface ResultEvent {
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

function initTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS results_calendar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    company     TEXT NOT NULL DEFAULT '',
    date        TEXT NOT NULL,
    period      TEXT,
    estimate    REAL,
    actual      REAL,
    surprise    REAL,
    surprise_pct REAL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(symbol, date, period)
  )`)
}

async function fetchNSEEvents(): Promise<ResultEvent[]> {
  const results: ResultEvent[] = []

  // Try event calendar
  try {
    const res = await fetch('https://www.nseindia.com/api/event-calendar', {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const json = await res.json()
      const arr: any[] = Array.isArray(json) ? json : (json.data ?? [])
      for (const e of arr) {
        const purpose = (e.purpose ?? e.event ?? '').toLowerCase()
        if (!purpose.includes('result') && !purpose.includes('earning') && !purpose.includes('financial')) continue
        results.push({
          symbol:  (e.symbol ?? '').toUpperCase(),
          company: e.companyName ?? e.company ?? e.symbol ?? '',
          date:    e.date ?? e.eventDate ?? '',
          time:    e.time ?? '',
          period:  e.purpose ?? e.event ?? '',
        })
      }
    }
  } catch { /* ignore */ }

  // Try financial results comparisons if event-calendar was empty
  if (results.length === 0) {
    try {
      const res = await fetch(
        'https://www.nseindia.com/api/corporates-financial-results-comparisons?index=equities&period=Quarterly',
        { headers: NSE_HEADERS, signal: AbortSignal.timeout(8000) }
      )
      if (res.ok) {
        const json = await res.json()
        const arr: any[] = Array.isArray(json) ? json : (json.data ?? [])
        for (const e of arr) {
          results.push({
            symbol:  (e.symbol ?? '').toUpperCase(),
            company: e.companyName ?? e.company ?? '',
            date:    e.toDate ?? e.date ?? '',
            period:  e.period ?? 'Quarterly',
          })
        }
      }
    } catch { /* ignore */ }
  }

  return results
}

function persistResults(events: ResultEvent[]) {
  try {
    const db = getDb()
    initTable()
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO results_calendar (symbol, company, date, period, estimate, actual, surprise, surprise_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const e of events) {
      if (!e.symbol || !e.date) continue
      stmt.run(e.symbol, e.company, e.date, e.period ?? null, e.estimate ?? null, e.actual ?? null, e.surprise ?? null, e.surprisePct ?? null)
    }
  } catch { /* non-fatal */ }
}

function loadStoredResults(): ResultEvent[] {
  try {
    const db = getDb()
    initTable()
    const rows = db.prepare(`
      SELECT symbol, company, date, period, estimate, actual, surprise, surprise_pct
      FROM results_calendar
      ORDER BY date DESC
      LIMIT 200
    `).all() as any[]
    return rows.map(r => ({
      symbol:      r.symbol,
      company:     r.company,
      date:        r.date,
      period:      r.period ?? undefined,
      estimate:    r.estimate ?? undefined,
      actual:      r.actual   ?? undefined,
      surprise:    r.surprise ?? undefined,
      surprisePct: r.surprise_pct ?? undefined,
    }))
  } catch {
    return []
  }
}

export async function GET() {
  const cached = cache.get<{ events: ResultEvent[]; lastUpdated: string }>('results-calendar')
  if (cached) return NextResponse.json(cached)

  const live = await fetchNSEEvents()

  if (live.length > 0) {
    persistResults(live)
  }

  // Merge with stored (live takes precedence for upcoming, stored has history)
  const stored = loadStoredResults()
  const today  = new Date().toISOString().slice(0, 10)

  // Upcoming: from live; past: supplement from stored
  const liveSymbolDates = new Set(live.map(e => `${e.symbol}::${e.date}`))
  const pastFromStore   = stored.filter(e => e.date < today && !liveSymbolDates.has(`${e.symbol}::${e.date}`))

  const events: ResultEvent[] = [...live, ...pastFromStore]
    .sort((a, b) => b.date.localeCompare(a.date))

  const result = { events, lastUpdated: new Date().toISOString() }
  cache.set('results-calendar', result, TTL_1HR)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
  })
}
