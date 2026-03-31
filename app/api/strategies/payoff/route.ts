import { NextRequest, NextResponse } from 'next/server'
import { computePayoff, findBreakevens, strategyStats } from '@/lib/options/payoff'

export async function POST(req: NextRequest) {
  try {
    const { legs, spotRef } = await req.json()
    if (!legs || !spotRef) return NextResponse.json({ error: 'legs and spotRef required' }, { status: 400 })

    const stats = strategyStats(legs, spotRef)
    return NextResponse.json({ data: stats })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
