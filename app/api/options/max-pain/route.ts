import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getOptionChain } from '@/lib/nse/client'

const TTL_MAX_PAIN = 5 * 60 * 1000  // 5 minutes

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'NIFTY').toUpperCase()
  const expiry =  req.nextUrl.searchParams.get('expiry') ?? ''

  const cacheKey = `max-pain:${symbol}:${expiry}`
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

    // Build strike list
    interface StrikeRow {
      strike: number
      callOI: number
      putOI:  number
      totalLoss?: number
    }
    const strikes: StrikeRow[] = rows.map((row: any) => ({
      strike: row.strikePrice,
      callOI: row.CE?.openInterest ?? 0,
      putOI:  row.PE?.openInterest ?? 0,
    }))

    // Max Pain algorithm:
    // For each candidate expiry price K, total writer loss =
    //   sum over all CE strikes S: max(0, K - S) * CE_OI   (ITM calls)
    // + sum over all PE strikes S: max(0, S - K) * PE_OI   (ITM puts)
    // The strike with the MINIMUM total writer loss is max pain.
    let minTotalLoss = Infinity
    let maxPainStrike = strikes[0]?.strike ?? spot

    for (const candidate of strikes) {
      const K = candidate.strike
      let totalLoss = 0
      for (const row of strikes) {
        const S = row.strike
        totalLoss += Math.max(0, K - S) * row.callOI  // CE writers' loss
        totalLoss += Math.max(0, S - K) * row.putOI   // PE writers' loss
      }
      candidate.totalLoss = totalLoss
      if (totalLoss < minTotalLoss) {
        minTotalLoss  = totalLoss
        maxPainStrike = K
      }
    }

    const deviation    = spot - maxPainStrike
    const deviationPct = maxPainStrike !== 0 ? (deviation / maxPainStrike) * 100 : 0

    const payload = {
      symbol,
      expiry:       targetExp,
      expiries,
      maxPain:      maxPainStrike,
      currentSpot:  spot,
      deviation:    parseFloat(deviation.toFixed(2)),
      deviationPct: parseFloat(deviationPct.toFixed(2)),
      strikes,
    }

    cache.set(cacheKey, payload, TTL_MAX_PAIN)
    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
