import { getConnectionStatus } from '@/lib/openalgo/ws-feed'
import { isOpenAlgoUp } from '@/lib/openalgo/client'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const wsStatus  = getConnectionStatus()
  const restUp    = await isOpenAlgoUp()
  return NextResponse.json({
    ws:   wsStatus,
    rest: restUp ? 'up' : 'down',
    url:  process.env.OPENALGO_URL ?? 'http://127.0.0.1:5000',
  })
}
