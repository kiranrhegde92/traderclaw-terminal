import { NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yfinance-proxy'

const INDICES = [
  { symbol: 'NIFTY 50',         yf: '^NSEI'  },
  { symbol: 'NIFTY BANK',       yf: '^NSEBANK' },
  { symbol: 'SENSEX',           yf: '^BSESN'  },
  { symbol: 'NIFTY FIN SERVICE',yf: 'NIFTYFIN.NS' },
  { symbol: 'INDIA VIX',        yf: '^INDIAVIX' },
]

export async function GET() {
  try {
    const results = await Promise.allSettled(
      INDICES.map(async ({ symbol, yf }) => {
        // Fetch ~7 trading days of daily data; take last 5 closes
        const candles = await getHistorical(yf, '1d', '7d').catch(() => [])
        const closes  = candles.slice(-5).map((c: any) => c.close ?? c.Close ?? 0)
        return { symbol, closes }
      })
    )

    const data: Record<string, number[]> = {}
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.closes.length >= 2) {
        data[r.value.symbol] = r.value.closes
      }
    }

    return NextResponse.json({ data }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
