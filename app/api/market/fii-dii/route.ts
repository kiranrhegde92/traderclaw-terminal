import { NextRequest, NextResponse } from 'next/server'
import { getFIIDII } from '@/lib/nse/client'

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10) || 7))
    const all  = await getFIIDII()
    // getFIIDII returns up to ~10 records from NSE; slice to requested period
    const data = all.slice(0, days)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
