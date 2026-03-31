import { NextRequest, NextResponse } from 'next/server'
import { getPositions } from '@/lib/db/queries/paper-trades'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const positions = getPositions(accountId)

  const db = getDb()

  // Enrich with current prices and persist LTP back to DB for open positions
  const enriched = await Promise.all(positions.map(async pos => {
    const ltp    = await getLTP(pos.symbol) ?? pos.currentPrice ?? pos.averagePrice
    const unreal = (ltp - pos.averagePrice) * pos.quantity
    const pnlPct  = pos.averagePrice ? (unreal / (pos.averagePrice * Math.abs(pos.quantity))) * 100 : 0

    // Update current_price in DB for open positions (qty != 0)
    if (pos.quantity !== 0) {
      db.prepare(
        `UPDATE paper_positions SET current_price=?, updated_at=datetime('now') WHERE id=?`
      ).run(ltp, pos.id)
    }

    return { ...pos, currentPrice: ltp, unrealizedPnl: unreal, pnlPct }
  }))

  return NextResponse.json({ data: enriched })
}

export async function DELETE(req: NextRequest) {
  const accountId = parseInt(new URL(req.url).searchParams.get('accountId') ?? '1')
  getDb().prepare('UPDATE paper_positions SET quantity = 0, updated_at = datetime(\'now\') WHERE account_id = ?').run(accountId)
  return NextResponse.json({ success: true })
}
