import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Ensure the A/D history table exists
function ensureTable() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS ad_history (
      date      TEXT NOT NULL PRIMARY KEY,
      advances  INTEGER NOT NULL,
      declines  INTEGER NOT NULL,
      unchanged INTEGER NOT NULL DEFAULT 0,
      ratio     REAL NOT NULL
    )
  `)
  return db
}

/** Fetch today's real A/D from NSE allIndices (NIFTY 50 row) */
async function fetchTodayAD(): Promise<{ advances: number; declines: number; unchanged: number; ratio: number } | null> {
  try {
    const res = await fetch('https://www.nseindia.com/api/allIndices', {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.nseindia.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    // Find NIFTY 50 row which has real breadth data
    const nifty = (json.data ?? []).find((d: any) =>
      d.index === 'NIFTY 50' || d.indexSymbol === 'NIFTY 50'
    )
    if (!nifty) return null
    const advances  = +(nifty.advances  ?? 0)
    const declines  = +(nifty.declines  ?? 0)
    const unchanged = +(nifty.unchanged ?? 0)
    if (advances === 0 && declines === 0) return null
    const total = advances + declines + unchanged
    return { advances, declines, unchanged, ratio: parseFloat((advances / total).toFixed(4)) }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const db   = ensureTable()
    const today = new Date().toISOString().slice(0, 10)

    // Fetch real today's A/D and upsert into DB
    const todayAD = await fetchTodayAD()
    if (todayAD) {
      db.prepare(`
        INSERT INTO ad_history (date, advances, declines, unchanged, ratio)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          advances  = excluded.advances,
          declines  = excluded.declines,
          unchanged = excluded.unchanged,
          ratio     = excluded.ratio
      `).run(today, todayAD.advances, todayAD.declines, todayAD.unchanged, todayAD.ratio)
    }

    // Return last 10 trading days from accumulated real data
    const rows = db.prepare(`
      SELECT date, advances, declines, unchanged, ratio
      FROM ad_history
      ORDER BY date DESC
      LIMIT 10
    `).all() as { date: string; advances: number; declines: number; unchanged: number; ratio: number }[]

    return NextResponse.json({ data: rows.reverse() })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
