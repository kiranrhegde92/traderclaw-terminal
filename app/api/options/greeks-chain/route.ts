import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getOptionChain } from '@/lib/nse/client'
import { computeGreeks } from '@/lib/options/greeks'

const TTL_GREEKS = 5 * 60 * 1000  // 5 minutes
const RISK_FREE_RATE = 0.065       // RBI repo 6.5%

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'NIFTY').toUpperCase()
  const expiry =  req.nextUrl.searchParams.get('expiry') ?? ''

  const cacheKey = `greeks-chain:${symbol}:${expiry}`
  const cached   = cache.get<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const raw = await getOptionChain(symbol)
    if (!raw?.records) {
      return NextResponse.json({ error: 'Could not fetch option chain' }, { status: 503 })
    }

    const spot      = raw.records.underlyingValue ?? 0
    const expiries: string[] = raw.records.expiryDates ?? []
    const targetExp = expiry || expiries[0] || ''
    const allRows   = raw.records.data ?? []
    const rows      = targetExp
      ? allRows.filter((r: any) => r.expiryDates === targetExp)
      : allRows

    if (!rows.length) {
      return NextResponse.json({ error: 'No data for requested expiry' }, { status: 404 })
    }

    // Find ATM strike
    let minDist = Infinity
    let atmStrike = 0
    for (const row of rows) {
      const dist = Math.abs(row.strikePrice - spot)
      if (dist < minDist) { minDist = dist; atmStrike = row.strikePrice }
    }

    const strikesWithGreeks = rows.map((row: any) => {
      const ce = row.CE ?? {}
      const pe = row.PE ?? {}

      // CE Greeks
      let ceGreeks = null
      if (ce.lastPrice > 0 && spot > 0 && targetExp) {
        try {
          ceGreeks = computeGreeks(spot, row.strikePrice, targetExp, 'CE', ce.lastPrice, RISK_FREE_RATE)
        } catch { /* ignore */ }
      }

      // PE Greeks
      let peGreeks = null
      if (pe.lastPrice > 0 && spot > 0 && targetExp) {
        try {
          peGreeks = computeGreeks(spot, row.strikePrice, targetExp, 'PE', pe.lastPrice, RISK_FREE_RATE)
        } catch { /* ignore */ }
      }

      // Use NSE IV if computed IV is 0 (market closed, stale prices)
      const ceIV = (ceGreeks?.iv && ceGreeks.iv > 0)
        ? ceGreeks.iv * 100
        : (ce.impliedVolatility > 0 ? ce.impliedVolatility : null)
      const peIV = (peGreeks?.iv && peGreeks.iv > 0)
        ? peGreeks.iv * 100
        : (pe.impliedVolatility > 0 ? pe.impliedVolatility : null)

      return {
        strikePrice: row.strikePrice,
        isATM:       row.strikePrice === atmStrike,
        // CE
        ceLTP:   ce.lastPrice  ?? 0,
        ceOI:    ce.openInterest ?? 0,
        ceVol:   ce.totalTradedVolume ?? 0,
        ceDelta: ceGreeks?.delta ?? null,
        ceGamma: ceGreeks?.gamma ?? null,
        ceTheta: ceGreeks?.theta ?? null,
        ceVega:  ceGreeks?.vega  ?? null,
        ceIV,
        // PE
        peLTP:   pe.lastPrice  ?? 0,
        peOI:    pe.openInterest ?? 0,
        peVol:   pe.totalTradedVolume ?? 0,
        peDelta: peGreeks?.delta ?? null,
        peGamma: peGreeks?.gamma ?? null,
        peTheta: peGreeks?.theta ?? null,
        peVega:  peGreeks?.vega  ?? null,
        peIV,
      }
    })

    // Sort ascending
    strikesWithGreeks.sort((a: any, b: any) => a.strikePrice - b.strikePrice)

    const payload = {
      symbol,
      expiry:    targetExp,
      expiries,
      spot,
      atmStrike,
      strikes:   strikesWithGreeks,
    }

    cache.set(cacheKey, payload, TTL_GREEKS)
    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
