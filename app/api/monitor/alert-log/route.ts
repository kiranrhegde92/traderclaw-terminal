import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM alert_log ORDER BY triggered_at DESC LIMIT 200')
    .all()
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const { symbol, alertType, triggerPrice, message } = await req.json()
  if (!symbol || !alertType) {
    return NextResponse.json({ error: 'symbol and alertType required' }, { status: 400 })
  }
  const db = getDb()
  const result = db
    .prepare(
      'INSERT INTO alert_log (symbol, alert_type, trigger_price, message) VALUES (?, ?, ?, ?)'
    )
    .run(symbol, alertType, triggerPrice ?? null, message ?? null)
  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}

export async function DELETE(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id) {
    db.prepare('DELETE FROM alert_log WHERE id = ?').run(parseInt(id))
  } else {
    db.prepare('DELETE FROM alert_log').run()
  }
  return NextResponse.json({ success: true })
}
