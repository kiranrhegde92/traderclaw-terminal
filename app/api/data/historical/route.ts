import { NextRequest, NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yfinance-proxy'
import { getHistoricalData } from '@/lib/angelone/client'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const symbol   = sp.get('symbol') ?? ''
  const interval = sp.get('interval') ?? '1d'
  const period   = sp.get('period') ?? ''

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  try {
    // Try Angel One first if connected
    const db     = getDb()
    const jwtRow = db.prepare(`SELECT value FROM app_config WHERE key = 'session_jwt'`).get() as { value: string } | undefined
    const apiKey = process.env.ANGELONE_API_KEY ?? ''

    if (jwtRow?.value && apiKey) {
      // Find token for symbol
      const tokenRow = db.prepare(
        `SELECT token FROM instrument_master WHERE symbol = ? AND exchange = 'NSE' LIMIT 1`
      ).get(symbol.toUpperCase()) as { token: string } | undefined

      if (tokenRow?.token) {
        const now  = new Date()
        const from = new Date(now.getTime() - 365 * 86400_000)
        const data = await getHistoricalData(jwtRow.value, apiKey, {
          exchange:    'NSE',
          symboltoken: tokenRow.token,
          interval,
          fromdate:    from.toISOString().slice(0, 10).replace(/-/g, '-') + ' 00:00',
          todate:      now.toISOString().slice(0, 10).replace(/-/g, '-')  + ' 23:59',
        })
        if (data.length > 0) {
          return NextResponse.json({ data, source: 'angelone' })
        }
      }
    }

    // Fallback to Yahoo Finance
    const data = await getHistorical(symbol, interval, period)
    return NextResponse.json({ data, source: 'yfinance' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
