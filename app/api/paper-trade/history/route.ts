import { NextRequest, NextResponse } from 'next/server'
import { getTradeHistory } from '@/lib/db/queries/paper-trades'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const limit     = parseInt(req.nextUrl.searchParams.get('limit') ?? '100')
  const data      = getTradeHistory(accountId, limit)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const accountId = parseInt(new URL(req.url).searchParams.get('accountId') ?? '1')
  getDb().prepare('DELETE FROM paper_trades WHERE account_id = ?').run(accountId)
  return NextResponse.json({ success: true })
}
