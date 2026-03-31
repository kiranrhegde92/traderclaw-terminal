import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

let _purgedSeedData = false

function ensureTable() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_health_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL UNIQUE,
      score      INTEGER NOT NULL,
      label      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // One-time: remove any bulk-seeded fake rows (inserted in same second)
  if (!_purgedSeedData) {
    _purgedSeedData = true
    const dupes = db.prepare(`
      SELECT created_at, COUNT(*) as cnt
      FROM market_health_history
      GROUP BY created_at
      HAVING cnt >= 10
    `).all() as { created_at: string; cnt: number }[]
    if (dupes.length > 0) {
      const seedTs = dupes[0].created_at
      db.prepare(`DELETE FROM market_health_history WHERE created_at = ?`).run(seedTs)
    }
  }

  return db
}

export async function GET() {
  try {
    const db = ensureTable()
    const rows = db
      .prepare(`SELECT date, score, label FROM market_health_history ORDER BY date ASC LIMIT 30`)
      .all()
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { score, label } = body as { score: number; label: string }

    if (typeof score !== 'number' || score < 0 || score > 100) {
      return NextResponse.json({ error: 'Invalid score (0-100 required)' }, { status: 400 })
    }

    const db = ensureTable()
    const today = new Date().toISOString().slice(0, 10)
    const lbl   = label ?? (score >= 65 ? 'Bullish' : score >= 40 ? 'Neutral' : 'Bearish')

    db.prepare(
      `INSERT INTO market_health_history (date, score, label)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET score = excluded.score, label = excluded.label`
    ).run(today, Math.round(score), lbl)

    return NextResponse.json({ ok: true, date: today, score: Math.round(score), label: lbl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
