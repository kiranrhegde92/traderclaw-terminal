import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'

const TTL_5MIN = 5 * 60 * 1000
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'Referer': 'https://www.nseindia.com',
}

interface GlobalIndex {
  symbol: string
  name: string
  ltp: number
  change: number
  changePct: number
  premium: number | null
  premiumPct: number | null
  source: string
  timestamp: string
}

async function fetchYFQuote(ticker: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json.chart?.result?.[0]?.meta
    if (!meta) return null
    const price     = +(meta.regularMarketPrice ?? 0)
    const prevClose = +(meta.chartPreviousClose ?? meta.previousClose ?? price)
    const change    = price - prevClose
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0
    return { price, change, changePct }
  } catch {
    return null
  }
}

async function fetchNiftySpot(): Promise<number | null> {
  try {
    const res = await fetch('https://www.nseindia.com/api/allIndices', {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const nifty = json.data?.find((d: any) => d.index === 'NIFTY 50')
    return nifty?.last ?? null
  } catch {
    return null
  }
}

export async function GET() {
  const cached = cache.get<GlobalIndex[]>('gift-nifty')
  if (cached) return NextResponse.json({ data: cached, cached: true })

  const ts = new Date().toISOString()

  // Fetch NIFTY spot for premium calculation
  const niftySpot = await fetchNiftySpot()

  // Tickers: GIFT Nifty (SGX), Dow Futures, Nasdaq Futures, Nikkei Futures
  const tickers: Array<{ key: string; symbol: string; name: string; yf: string; isNiftyProxy?: boolean }> = [
    { key: 'gift',    symbol: 'GIFT NIFTY',     name: 'GIFT Nifty Futures',    yf: '^NSEI',     isNiftyProxy: true },
    { key: 'dow',     symbol: 'DOW FUTURES',    name: 'Dow Jones Futures',     yf: 'YM=F'  },
    { key: 'nasdaq',  symbol: 'NASDAQ FUTURES', name: 'Nasdaq 100 Futures',    yf: 'NQ=F'  },
    { key: 'nikkei',  symbol: 'NIKKEI FUTURES', name: 'Nikkei 225 Futures',    yf: 'NK=F'  },
    { key: 'sgx',     symbol: 'SGX NIFTY',      name: 'SGX Nifty (IFSG)',      yf: '^NSEI', isNiftyProxy: true },
  ]

  const results: GlobalIndex[] = await Promise.all(
    tickers.map(async (t) => {
      const q = await fetchYFQuote(t.yf)
      const ltp       = q?.price     ?? 0
      const change    = q?.change    ?? 0
      const changePct = q?.changePct ?? 0

      let premium: number | null = null
      let premiumPct: number | null = null
      if (t.isNiftyProxy && niftySpot && ltp > 0) {
        premium    = +(ltp - niftySpot).toFixed(2)
        premiumPct = +((premium / niftySpot) * 100).toFixed(2)
      }

      return {
        symbol:     t.symbol,
        name:       t.name,
        ltp,
        change:     +change.toFixed(2),
        changePct:  +changePct.toFixed(2),
        premium,
        premiumPct,
        source:     q ? 'Yahoo Finance' : 'N/A',
        timestamp:  ts,
      }
    })
  )

  cache.set('gift-nifty', results, TTL_5MIN)

  return NextResponse.json({ data: results, cached: false }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' }
  })
}
