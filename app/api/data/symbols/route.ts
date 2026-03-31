import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { NIFTY50_SYMBOLS } from '@/lib/utils/constants'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').toUpperCase().trim()
  if (!q) return NextResponse.json({ data: [] })

  try {
    const db   = getDb()
    const rows = db.prepare(`
      SELECT DISTINCT symbol, name, exchange, token, lot_size
      FROM instrument_master
      WHERE (symbol LIKE ? OR name LIKE ?)
        AND exchange IN ('NSE','BSE')
        AND instrument_type IN ('EQ','INDEX',NULL,'')
      ORDER BY symbol
      LIMIT 20
    `).all(`${q}%`, `%${q}%`) as any[]

    if (rows.length > 0) {
      return NextResponse.json({ data: rows })
    }

    // Fallback: filter from Nifty50 hardcoded list
    const filtered = NIFTY50_SYMBOLS
      .filter(s => s.startsWith(q))
      .slice(0, 20)
      .map(s => ({ symbol: s, name: s, exchange: 'NSE', token: null, lotSize: 1 }))

    return NextResponse.json({ data: filtered })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
