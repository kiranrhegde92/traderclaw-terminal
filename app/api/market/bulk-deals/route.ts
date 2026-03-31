import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'

const TTL_10MIN = 10 * 60 * 1000
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'Referer': 'https://www.nseindia.com',
}

interface Deal {
  symbol: string
  clientName: string
  dealType: 'bulk' | 'block'
  buyOrSell: 'BUY' | 'SELL'
  qty: number
  price: number
  value: number       // in crores
  exchange: string
  date: string
}

function parseNSEBulkDeals(raw: any[]): Deal[] {
  return (raw ?? []).map((d: any) => {
    const qty   = +(d.quantityTraded ?? d.quantity ?? 0)
    const price = +(d.tradePrice ?? d.price ?? 0)
    return {
      symbol:     (d.symbol ?? d.scripName ?? '').toUpperCase(),
      clientName: d.clientName ?? d.name ?? '',
      dealType:   'bulk',
      buyOrSell:  (d.buySell ?? d.buyOrSell ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      qty,
      price,
      value:      +(qty * price / 1e7).toFixed(2),  // to crores
      exchange:   d.exchange ?? 'NSE',
      date:       d.dealDate ?? d.date ?? new Date().toISOString().slice(0, 10),
    }
  })
}

function parseNSEBlockDeals(raw: any[]): Deal[] {
  return (raw ?? []).map((d: any) => {
    const qty   = +(d.quantityTraded ?? d.quantity ?? 0)
    const price = +(d.tradePrice ?? d.price ?? 0)
    return {
      symbol:     (d.symbol ?? d.scripName ?? '').toUpperCase(),
      clientName: d.clientName ?? d.name ?? '',
      dealType:   'block',
      buyOrSell:  (d.buySell ?? d.buyOrSell ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      qty,
      price,
      value:      +(qty * price / 1e7).toFixed(2),
      exchange:   d.exchange ?? 'NSE',
      date:       d.dealDate ?? d.date ?? new Date().toISOString().slice(0, 10),
    }
  })
}

async function fetchDeals(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    // NSE wraps in { data: [...] } or returns array directly
    return Array.isArray(json) ? json : (json.data ?? json.bulkDeals ?? json.blockDeals ?? [])
  } catch {
    return []
  }
}

export async function GET() {
  const cached = cache.get<{ deals: Deal[]; lastUpdated: string }>('bulk-block-deals')
  if (cached) return NextResponse.json(cached)

  const [bulkRaw, blockRaw] = await Promise.all([
    fetchDeals('https://www.nseindia.com/api/bulk-deals'),
    fetchDeals('https://www.nseindia.com/api/block-deals'),
  ])

  const bulk  = parseNSEBulkDeals(bulkRaw)
  const block = parseNSEBlockDeals(blockRaw)

  // Sort by value desc
  const deals = [...bulk, ...block].sort((a, b) => b.value - a.value)

  const result = { deals, lastUpdated: new Date().toISOString() }
  cache.set('bulk-block-deals', result, TTL_10MIN)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120' }
  })
}
