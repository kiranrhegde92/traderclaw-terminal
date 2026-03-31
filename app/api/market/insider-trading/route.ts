import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'

const TTL_30MIN = 30 * 60 * 1000
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json',
  'Referer': 'https://www.nseindia.com',
}

export interface InsiderTransaction {
  symbol: string
  company: string
  person: string
  category: string
  shares: number
  value: number      // crores
  price: number
  txnType: 'BUY' | 'SELL' | 'PLEDGE' | 'OTHER'
  date: string
  mode: string
}

async function fetchNSE(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: NSE_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : (json.data ?? json.transactions ?? [])
  } catch {
    return []
  }
}

function parseTransaction(d: any): InsiderTransaction {
  const shares   = +(d.noOfShareBought ?? d.noOfShareSold ?? d.secAcq ?? d.secSold ?? d.noShares ?? 0)
  const price    = +(d.buyValue ?? d.sellValue ?? d.valueOfSecAcq ?? d.valueOfSecSold ?? 0)
  const crores   = +(shares * price / 1e7).toFixed(2) || +(price / 1e7).toFixed(2)

  const raw = (d.buyOrSell ?? d.acquSell ?? '').toLowerCase()
  const txnType: InsiderTransaction['txnType'] =
    raw.includes('buy')  || raw.includes('acqui') ? 'BUY'  :
    raw.includes('sell') || raw.includes('disp')  ? 'SELL' :
    raw.includes('pledg')                         ? 'PLEDGE' : 'OTHER'

  return {
    symbol:   (d.symbol ?? d.companyName ?? '').toUpperCase(),
    company:  d.companyName ?? d.company ?? d.symbol ?? '',
    person:   d.personName ?? d.acqName ?? d.name ?? '',
    category: d.category ?? d.typeOfSecurity ?? 'Insider',
    shares,
    value:    crores,
    price,
    txnType,
    date:     d.date ?? d.dateOfAllotment ?? d.broadcasDate ?? new Date().toISOString().slice(0, 10),
    mode:     d.modeOfAcq ?? d.mode ?? '',
  }
}

export async function GET() {
  const cached = cache.get<{ transactions: InsiderTransaction[]; lastUpdated: string }>('insider-trading')
  if (cached) return NextResponse.json(cached)

  const raw = await fetchNSE('https://www.nseindia.com/api/corporates-pit?index=equities&period=oneMonth')
  const transactions = raw.slice(0, 200).map(parseTransaction)
  transactions.sort((a, b) => b.date.localeCompare(a.date))

  const result = { transactions, lastUpdated: new Date().toISOString() }
  cache.set('insider-trading', result, TTL_30MIN)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' }
  })
}
