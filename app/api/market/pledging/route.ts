import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'

const TTL_30MIN = 30 * 60 * 1000
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'Referer': 'https://www.nseindia.com',
}

export interface PledgingRecord {
  symbol: string
  company: string
  promoterName: string
  totalShares: number
  pledgedShares: number
  pledgedPct: number
  date: string
}

export async function GET() {
  const cached = cache.get<{ records: PledgingRecord[]; lastUpdated: string }>('pledging')
  if (cached) return NextResponse.json(cached)

  try {
    const res = await fetch('https://www.nseindia.com/api/corporates-promoter-holding?index=equities', {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error('NSE error')
    const json  = await res.json()
    const raw: any[] = Array.isArray(json) ? json : (json.data ?? [])

    const records: PledgingRecord[] = raw.slice(0, 200).map((d: any) => {
      const total   = +(d.totalNoOfShares ?? d.totalShares ?? 0)
      const pledged = +(d.noOfSharesPledged ?? d.pledgedShares ?? 0)
      return {
        symbol:        (d.symbol ?? '').toUpperCase(),
        company:       d.companyName ?? d.company ?? d.symbol ?? '',
        promoterName:  d.promoterName ?? d.name ?? '',
        totalShares:   total,
        pledgedShares: pledged,
        pledgedPct:    total > 0 ? +(pledged / total * 100).toFixed(2) : 0,
        date:          d.date ?? d.recordDate ?? new Date().toISOString().slice(0, 10),
      }
    }).sort((a, b) => b.pledgedPct - a.pledgedPct)

    const result = { records, lastUpdated: new Date().toISOString() }
    cache.set('pledging', result, TTL_30MIN)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' }
    })
  } catch {
    return NextResponse.json({ records: [], lastUpdated: new Date().toISOString() })
  }
}
