import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const since  = req.nextUrl.searchParams.get('since') ?? ''  // ISO timestamp
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '200')
  const level  = req.nextUrl.searchParams.get('level')       // optional filter

  const db = getDb()

  let rows: any[]
  if (since) {
    rows = level
      ? db.prepare(`SELECT * FROM console_logs WHERE created_at > ? AND level = ? ORDER BY id DESC LIMIT ?`).all(since, level, limit)
      : db.prepare(`SELECT * FROM console_logs WHERE created_at > ? ORDER BY id DESC LIMIT ?`).all(since, limit)
  } else {
    rows = level
      ? db.prepare(`SELECT * FROM console_logs WHERE level = ? ORDER BY id DESC LIMIT ?`).all(level, limit)
      : db.prepare(`SELECT * FROM console_logs ORDER BY id DESC LIMIT ?`).all(limit)
  }

  // Return in ascending order (oldest first)
  return NextResponse.json({ data: rows.reverse() })
}

export async function DELETE() {
  const db = getDb()
  db.prepare('DELETE FROM console_logs').run()
  return NextResponse.json({ success: true })
}
