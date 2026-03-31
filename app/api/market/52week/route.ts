import { NextResponse } from 'next/server'
import { cache, TTL } from '@/lib/nse/cache'

const NIFTY50_SYMBOLS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','KOTAKBANK','HINDUNILVR',
  'SBIN','BHARTIARTL','ITC','LT','AXISBANK','MARUTI','TATASTEEL','WIPRO',
  'TATAMOTORS','SUNPHARMA','POWERGRID','NTPC','HCLTECH','M&M','BAJFINANCE',
  'NESTLEIND','ASIANPAINT','ULTRACEMCO','TITAN','ONGC','TECHM','COALINDIA',
  'JSWSTEEL','DRREDDY','BPCL','GRASIM','ADANIENT','ADANIPORTS','BAJAJFINSV',
  'CIPLA','DIVISLAB','EICHERMOT','APOLLOHOSP','SHREECEM','INDUSINDBK',
  'HINDALCO','HEROMOTOCO','SBILIFE','BAJAJ-AUTO','TATACONSUM','HDFCLIFE',
  'UPL','BEL',
]

async function fetchYF52W(symbol: string) {
  const ticker = symbol === 'M&M' ? 'M%26M.NS' : `${symbol}.NS`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      symbol,
      ltp:     +(meta.regularMarketPrice ?? 0),
      high52w: +(meta.fiftyTwoWeekHigh   ?? 0),
      low52w:  +(meta.fiftyTwoWeekLow    ?? 0),
    }
  } catch {
    return null
  }
}

function pctFromHigh(ltp: number, high52w: number) {
  return ((ltp - high52w) / high52w) * 100
}

function pctFromLow(ltp: number, low52w: number) {
  return ((ltp - low52w) / low52w) * 100
}

export async function GET() {
  try {
    const cacheKey = 'market:52week'
    const cached = cache.get<{ nearHigh: any[]; nearLow: any[] }>(cacheKey)
    if (cached) return NextResponse.json({ data: cached })

    // Fetch all 50 symbols concurrently from Yahoo Finance
    const results = await Promise.allSettled(NIFTY50_SYMBOLS.map(fetchYF52W))
    const stocks = results
      .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchYF52W>>>> =>
        r.status === 'fulfilled' && r.value !== null && r.value.ltp > 0 && r.value.high52w > 0
      )
      .map(r => r.value)

    const nearHigh: any[] = []
    const nearLow:  any[] = []

    for (const s of stocks) {
      const distHigh = pctFromHigh(s.ltp, s.high52w)
      const distLow  = pctFromLow(s.ltp, s.low52w)

      if (distHigh >= -5) {
        nearHigh.push({ symbol: s.symbol, ltp: s.ltp, high52w: s.high52w, distPct: parseFloat(distHigh.toFixed(2)) })
      }
      if (distLow <= 5) {
        nearLow.push({ symbol: s.symbol, ltp: s.ltp, low52w: s.low52w, distPct: parseFloat(distLow.toFixed(2)) })
      }
    }

    nearHigh.sort((a, b) => b.distPct - a.distPct)
    nearLow.sort((a, b) => a.distPct - b.distPct)

    const data = { nearHigh, nearLow }
    cache.set(cacheKey, data, TTL.HISTORY) // cache 5 min
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
