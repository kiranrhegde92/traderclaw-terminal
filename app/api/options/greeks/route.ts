import { NextRequest, NextResponse } from 'next/server'
import { computeGreeks, daysToExpiry } from '@/lib/options/greeks'

export async function POST(req: NextRequest) {
  try {
    const { legs, spot } = await req.json()
    if (!legs || !spot) return NextResponse.json({ error: 'legs and spot required' }, { status: 400 })

    const result = legs.map((leg: any) => {
      const g = computeGreeks(spot, leg.strike, leg.expiry, leg.optionType, leg.ltp ?? leg.premium, 0.065)
      const mult = leg.action === 'BUY' ? 1 : -1
      return {
        ...leg,
        iv:    g.iv,
        delta: g.delta * mult * leg.lots * (leg.lotSize ?? 1),
        gamma: g.gamma * mult * leg.lots * (leg.lotSize ?? 1),
        theta: g.theta * mult * leg.lots * (leg.lotSize ?? 1),
        vega:  g.vega  * mult * leg.lots * (leg.lotSize ?? 1),
      }
    })

    // Net Greeks
    const net = result.reduce(
      (s: any, l: any) => ({ delta: s.delta+l.delta, gamma: s.gamma+l.gamma, theta: s.theta+l.theta, vega: s.vega+l.vega }),
      { delta: 0, gamma: 0, theta: 0, vega: 0 }
    )

    return NextResponse.json({ data: { legs: result, net } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
