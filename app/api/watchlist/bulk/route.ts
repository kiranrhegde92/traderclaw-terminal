import { NextRequest, NextResponse } from 'next/server'
import { addSymbol } from '@/lib/db/queries/watchlists'

export async function POST(req: NextRequest) {
  const { symbols, watchlistId = 1, exchange = 'NSE' } = await req.json()
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return NextResponse.json({ error: 'symbols array required' }, { status: 400 })
  }
  const added: string[] = []
  const skipped: string[] = []
  for (const symbol of symbols) {
    try {
      const result = addSymbol(watchlistId, String(symbol).toUpperCase(), exchange)
      if (result.changes > 0) added.push(symbol)
      else skipped.push(symbol)
    } catch {
      skipped.push(symbol)
    }
  }
  return NextResponse.json({ success: true, added, skipped })
}
