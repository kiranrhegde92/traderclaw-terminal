import { NextResponse } from 'next/server'
import { cache, TTL } from '@/lib/nse/cache'

interface GlobalMarket {
  symbol:    string
  name:      string
  price:     number
  change:    number
  changePct: number
  currency?: string
}

const GLOBAL_TICKERS = [
  { yf: 'ES=F',    name: 'S&P Fut',   currency: 'USD' },
  { yf: 'NQ=F',    name: 'Nasdaq Fut',currency: 'USD' },
  { yf: 'YM=F',    name: 'Dow Fut',   currency: 'USD' },
  { yf: '^HSI',    name: 'Hang Seng', currency: 'HKD' },
  { yf: '^N225',   name: 'Nikkei',    currency: 'JPY' },
  { yf: 'GC=F',    name: 'Gold',      currency: 'USD' },
  { yf: 'CL=F',    name: 'Crude Oil', currency: 'USD' },
  { yf: 'USDINR=X',name: 'USD/INR',   currency: 'INR' },
  { yf: 'DX-Y.NYB',name: 'DXY',       currency: 'USD' },
]

async function fetchTicker(yf: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yf)}?interval=1m&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json.chart?.result?.[0]?.meta
    if (!meta) return null
    const price      = meta.regularMarketPrice ?? 0
    const prevClose  = meta.chartPreviousClose ?? meta.previousClose ?? price
    const change     = price - prevClose
    const changePct  = prevClose !== 0 ? (change / prevClose) * 100 : 0
    return { price, change, changePct }
  } catch {
    return null
  }
}

export async function GET() {
  const cacheKey = 'global-markets'
  const cached = cache.get<GlobalMarket[]>(cacheKey)
  if (cached) return NextResponse.json({ data: cached })

  const settled = await Promise.allSettled(
    GLOBAL_TICKERS.map(async t => {
      const q = await fetchTicker(t.yf)
      if (!q) return null
      return { symbol: t.yf, name: t.name, currency: t.currency, ...q } as GlobalMarket
    })
  )

  const data = settled
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<GlobalMarket | null>).value!)

  cache.set(cacheKey, data, 300) // 5 min cache
  return NextResponse.json({ data })
}
