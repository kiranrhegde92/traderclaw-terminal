import { NextRequest, NextResponse } from 'next/server'
import { getAccount, getPositions } from '@/lib/db/queries/paper-trades'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const account   = getAccount(accountId)
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const positions = getPositions(accountId)
  const db = getDb()

  // Compute unrealized P&L from open positions using live prices
  let unrealizedPnl = 0
  for (const pos of positions) {
    const ltp    = await getLTP(pos.symbol) ?? pos.currentPrice ?? pos.averagePrice
    unrealizedPnl += (ltp - pos.averagePrice) * pos.quantity
  }

  // Realized P&L: sum of realized_pnl from all paper_positions (including closed ones)
  const realizedRow = db.prepare(
    `SELECT SUM(COALESCE(realized_pnl, 0)) as realized FROM paper_positions WHERE account_id = ?`
  ).get(accountId) as { realized: number | null }
  const realizedPnl = realizedRow?.realized ?? 0

  // SQLite returns snake_case — handle both
  const raw: any       = account
  const currentBalance = raw.current_balance  ?? raw.currentBalance  ?? 0
  const initialBalance = raw.initial_balance  ?? raw.initialBalance  ?? 0

  const usedMargin  = positions.reduce((s, p) => s + Math.abs(p.quantity) * p.averagePrice * 0.2, 0)
  const totalPnl    = realizedPnl + unrealizedPnl

  return NextResponse.json({
    data: {
      ...account,
      currentBalance,
      initialBalance,
      unrealizedPnl,
      realizedPnl,
      totalPnl,
      usedMargin,
      availableMargin: currentBalance - usedMargin,
    }
  })
}

export async function DELETE(req: NextRequest) {
  const accountId = parseInt(new URL(req.url).searchParams.get('accountId') ?? '1')
  const db = getDb()
  // Restore balance to initial_balance
  db.prepare('UPDATE paper_accounts SET current_balance = initial_balance WHERE id = ?').run(accountId)
  return NextResponse.json({ success: true })
}
