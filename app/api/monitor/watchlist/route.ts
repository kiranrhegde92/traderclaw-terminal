import { NextRequest, NextResponse } from 'next/server'
import { getWatchlist, addSymbol, removeSymbol } from '@/lib/db/queries/watchlists'

export async function GET(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get('id') ?? '1')
  const data = getWatchlist(id)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { watchlistId = 1, symbol, exchange = 'NSE', token } = await req.json()
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  addSymbol(watchlistId, symbol, exchange, token)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { watchlistId = 1, symbol } = await req.json()
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  removeSymbol(watchlistId, symbol)
  return NextResponse.json({ success: true })
}
