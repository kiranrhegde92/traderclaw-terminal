import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'

const TTL_5MIN = 5 * 60 * 1000

const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.nseindia.com/',
  'X-Requested-With': 'XMLHttpRequest',
}

async function fetchNSEDelivery(): Promise<any[] | null> {
  try {
    // NSE "most active by delivery volume" endpoint
    const res = await fetch(
      'https://www.nseindia.com/api/live-analysis-most-active-securities?index=deliveryVolume',
      { headers: NSE_HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    // Returns { data: [...] }
    return json.data ?? null
  } catch {
    return null
  }
}

async function fetchNSEMostActive(): Promise<any[] | null> {
  try {
    // Alternative: equity most active by value, which includes delivery %
    const res = await fetch(
      'https://www.nseindia.com/api/live-analysis-most-active-securities?index=traded_value',
      { headers: NSE_HEADERS, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

function parseRecord(d: any) {
  const delivPct = parseFloat(d.deliveryToTradedQuantity ?? d.pctDelivery ?? 0)
  const volume   = parseInt(d.totalTradedVolume ?? d.quantityTraded ?? 0)
  const delivVol = parseInt(d.deliveryQuantity ?? 0)
  const prevDelivPct = parseFloat(d.prevDeliveryToTradedQuantity ?? 0)
  const spike    = prevDelivPct > 0 ? delivPct - prevDelivPct : 0

  return {
    symbol:      d.symbol ?? d.Symbol ?? '',
    ltp:         parseFloat(d.lastPrice ?? d.closePrice ?? 0),
    changePct:   parseFloat(d.pChange ?? d.change ?? 0),
    volume,
    delivVol,
    delivPct:    +delivPct.toFixed(2),
    prevDelivPct: +prevDelivPct.toFixed(2),
    spike:       +spike.toFixed(2),
    series:      d.series ?? 'EQ',
  }
}

export async function GET() {
  const cacheKey = 'market:delivery-spikes'
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return NextResponse.json({ data: cached, cached: true })

  // Try delivery-specific endpoint first, fallback to most active
  let raw = await fetchNSEDelivery()
  if (!raw?.length) raw = await fetchNSEMostActive()

  if (!raw?.length) {
    return NextResponse.json({ data: [], error: 'NSE data unavailable' }, { status: 200 })
  }

  const parsed = raw
    .map(parseRecord)
    .filter(d => d.symbol && d.delivPct > 0 && d.series === 'EQ')
    // Sort by delivery % descending
    .sort((a, b) => b.delivPct - a.delivPct)

  cache.set(cacheKey, parsed, TTL_5MIN)

  return NextResponse.json({ data: parsed, cached: false }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' }
  })
}
