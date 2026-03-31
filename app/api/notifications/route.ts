import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// Ensure table exists
function ensureTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS notification_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

export async function GET() {
  try {
    ensureTable()
    const rows = getDb().prepare('SELECT key, value FROM notification_settings').all() as { key: string; value: string }[]
    const settings: Record<string, any> = {}
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = row.value }
    }
    return NextResponse.json({ settings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureTable()
    const body = await req.json()
    const db = getDb()
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO notification_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))`
    )
    for (const [key, value] of Object.entries(body)) {
      stmt.run(key, JSON.stringify(value))
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
