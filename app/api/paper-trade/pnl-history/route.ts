import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const db = getDb()

  const rows = db.prepare(`
    SELECT
      DATE(executed_at) as date,
      SUM(COALESCE(pnl, 0)) as daily_pnl
    FROM paper_trades
    WHERE account_id = ? AND pnl IS NOT NULL
    GROUP BY DATE(executed_at)
    ORDER BY date ASC
  `).all(accountId) as Array<{ date: string; daily_pnl: number }>

  let cumulative = 0
  const data = rows.map(row => {
    cumulative += row.daily_pnl
    return {
      date: row.date,
      dailyPnl: row.daily_pnl,
      cumulativePnl: cumulative,
    }
  })

  return NextResponse.json({ data })
}
