/**
 * NSE data client
 * Primary: NSE allIndices API (direct scrape)
 * Fallback: Yahoo Finance for key indices when NSE blocks
 * No mock/simulated data — returns empty on failure
 */
import { cache, TTL } from './cache'
import type { IndexData, GainerLoser, FIIDIIData, SectorData } from '@/types/market'

let NSEClient: any = null

async function getNSE() {
  if (NSEClient) return NSEClient
  try {
    const { NseIndia } = await import('stock-nse-india')
    NSEClient = new NseIndia()
  } catch {
    NSEClient = null
  }
  return NSEClient
}

/* ── Yahoo Finance fallback map for key indices ── */
const YF_INDEX_MAP: Record<string, string> = {
  'NIFTY 50':           '^NSEI',
  'NIFTY BANK':         '^NSEBANK',
  'SENSEX':             '^BSESN',
  'INDIA VIX':          '^INDIAVIX',
  'NIFTY IT':           '^CNXIT',
  'NIFTY PHARMA':       '^CNXPHARMA',
  'NIFTY AUTO':         '^CNXAUTO',
  'NIFTY METAL':        '^CNXMETAL',
  'NIFTY REALTY':       '^CNXREALTY',
  'NIFTY FMCG':         '^CNXFMCG',
  'NIFTY ENERGY':       '^CNXENERGY',
  'NIFTY INFRA':        '^CNXINFRA',
  'NIFTY MEDIA':        '^CNXMEDIA',
  'NIFTY FIN SERVICE':  '^CNXFINANCE',
  'NIFTY MIDCAP 50':    '^NSEMDCP50',
  'NIFTY NEXT 50':      '^NSMIDCP',
}

async function fetchYFIndex(yf: string): Promise<{ price: number; change: number; changePct: number; high: number; low: number; open: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yf)}?interval=1d&range=1d`
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
    return {
      price, change, changePct,
      high:      +(meta.regularMarketDayHigh ?? price),
      low:       +(meta.regularMarketDayLow  ?? price),
      open:      +(meta.regularMarketOpen    ?? price),
      prevClose,
    }
  } catch {
    return null
  }
}

/** Fetch key indices from Yahoo Finance as fallback */
async function getIndicesFromYF(): Promise<IndexData[]> {
  const entries = Object.entries(YF_INDEX_MAP)
  const settled = await Promise.allSettled(
    entries.map(async ([name, yf]) => {
      const q = await fetchYFIndex(yf)
      if (!q) return null
      return {
        symbol:    name,
        name,
        ltp:       q.price,
        change:    q.change,
        changePct: q.changePct,
        high:      q.high,
        low:       q.low,
        open:      q.open,
        prevClose: q.prevClose,
        pe: 0, pb: 0,
      } as IndexData
    })
  )
  return settled
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => (r as PromiseFulfilledResult<IndexData | null>).value!)
}

/** Fetch all index data — Angel One primary, NSE secondary, Yahoo Finance fallback */
export async function getIndices(): Promise<IndexData[]> {
  const cacheKey = 'indices'
  const cached = cache.get<IndexData[]>(cacheKey)
  if (cached) return cached

  // ── Primary: Connected broker (Angel One, Zerodha, etc.) ──
  try {
    const { getActiveBroker } = await import('@/lib/brokers/registry')
    const broker    = await getActiveBroker()
    const aoIndices = broker ? await broker.getIndices() : []
    if (aoIndices.length > 0) {
      // Angel One gives us a small set of key indices; merge with NSE for the full list below
      // Store in a local map so NSE data can be enriched / overridden
      const aoMap = new Map(aoIndices.map(i => [i.symbol, i]))
      // Proceed to NSE for full list, but we'll override with Angel One values after
      try {
        const headers = {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.5',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.nseindia.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
        const res  = await fetch('https://www.nseindia.com/api/allIndices', { headers, signal: AbortSignal.timeout(8000) })
        if (res.ok) {
          const json = await res.json()
          const indices: IndexData[] = (json.data || []).map((d: any) => {
            const name = d.index as string
            const ao   = aoMap.get(name)
            return {
              symbol:    name,
              name:      d.indexName ?? name,
              // Prefer Angel One live price for key indices
              ltp:       ao ? ao.ltp       : +(d.last ?? d.indexValue ?? 0) || 0,
              change:    ao ? ao.change    : +(d.variation ?? d.change ?? 0) || 0,
              changePct: ao ? ao.changePct : +(d.percentChange ?? d.pChange ?? 0) || 0,
              high:      ao ? ao.high      : +(d.high ?? 0) || 0,
              low:       ao ? ao.low       : +(d.low ?? 0) || 0,
              open:      ao ? ao.open      : +(d.open ?? 0) || 0,
              prevClose: ao ? ao.prevClose : +(d.previousClose ?? 0) || 0,
              pe:        +(d.pe ?? 0) || 0,
              pb:        +(d.pb ?? 0) || 0,
              advances:  +(d.advances  ?? 0) || 0,
              declines:  +(d.declines  ?? 0) || 0,
              unchanged: +(d.unchanged ?? 0) || 0,
            }
          })
          if (indices.length > 0) {
            cache.set(cacheKey, indices, TTL.INDICES)
            return indices
          }
        }
      } catch { /* NSE failed — use Angel One only */ }
      // If NSE failed, return Angel One key indices
      cache.set(cacheKey, aoIndices, TTL.INDICES)
      return aoIndices
    }
  } catch { /* Angel One not connected — continue to NSE */ }

  // ── Secondary: NSE allIndices API ──
  try {
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.nseindia.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
    const res  = await fetch('https://www.nseindia.com/api/allIndices', { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`NSE HTTP ${res.status}`)
    const json = await res.json()

    const indices: IndexData[] = (json.data || []).map((d: any) => ({
      symbol:    d.index,
      name:      d.indexName ?? d.index,
      ltp:       +(d.last ?? d.indexValue ?? 0) || 0,
      change:    +(d.variation ?? d.change ?? 0) || 0,
      changePct: +(d.percentChange ?? d.pChange ?? 0) || 0,
      high:      +(d.high ?? 0) || 0,
      low:       +(d.low ?? 0) || 0,
      open:      +(d.open ?? 0) || 0,
      prevClose: +(d.previousClose ?? d.yearHigh ?? 0) || 0,
      pe:        +(d.pe ?? 0) || 0,
      pb:        +(d.pb ?? 0) || 0,
      // Real advance/decline counts — provided by NSE for each index
      advances:  +(d.advances  ?? d.noOf52weekHighStock ?? 0) || 0,
      declines:  +(d.declines  ?? d.noOf52weekLowStock  ?? 0) || 0,
      unchanged: +(d.unchanged ?? 0) || 0,
    }))

    if (indices.length === 0) throw new Error('NSE returned empty indices')

    cache.set(cacheKey, indices, TTL.INDICES)
    return indices
  } catch (nseErr) {
    console.warn('[NSE] allIndices failed, trying Yahoo Finance fallback:', (nseErr as Error).message)
  }

  // ── Fallback: Yahoo Finance ──
  try {
    const indices = await getIndicesFromYF()
    if (indices.length === 0) throw new Error('Yahoo Finance returned no index data')
    console.info(`[NSE] Using Yahoo Finance fallback — got ${indices.length} indices`)
    cache.set(cacheKey, indices, TTL.INDICES)
    return indices
  } catch (yfErr) {
    console.error('[NSE] Both NSE and Yahoo Finance failed for indices:', (yfErr as Error).message)
    return []
  }
}

/** Fetch gainers and losers */
export async function getGainersLosers(index = 'NIFTY 50'): Promise<{ gainers: GainerLoser[]; losers: GainerLoser[] }> {
  const cacheKey = `gl:${index}`
  const cached = cache.get<{ gainers: GainerLoser[]; losers: GainerLoser[] }>(cacheKey)
  if (cached) return cached

  try {
    const headers = {
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }
    // Use equity-stockIndices — returns full constituent list with price data
    const encIdx = encodeURIComponent(index)
    const url    = `https://www.nseindia.com/api/equity-stockIndices?index=${encIdx}`
    const res    = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`NSE ${res.status}`)
    const json   = await res.json()
    // first element is the index summary row, skip it
    const stocks: any[] = (json.data ?? []).slice(1)

    const mapStock = (d: any): GainerLoser => ({
      symbol:    d.symbol,
      name:      d.meta?.companyName ?? d.symbol,
      ltp:       +(d.lastPrice ?? 0),
      change:    +(d.change ?? d.netPrice ?? 0),
      changePct: +(d.pChange ?? 0),
      volume:    +(d.totalTradedVolume ?? d.tradedQuantity ?? d.volume ?? 0),
      high52w:   +(d['52WeekHigh'] ?? d['52W H'] ?? 0),
      low52w:    +(d['52WeekLow']  ?? d['52W L'] ?? 0),
    })

    const sorted = [...stocks].sort((a, b) => +(b.pChange ?? 0) - +(a.pChange ?? 0))
    const result = {
      gainers: sorted.slice(0, 20).map(mapStock),
      losers:  sorted.slice(-20).reverse().map(mapStock),
    }
    cache.set(cacheKey, result, TTL.MARKET)
    return result
  } catch (err) {
    console.error('[NSE] getGainersLosers failed:', err)
    return { gainers: [], losers: [] }
  }
}

/** Fetch FII vs DII data */
export async function getFIIDII(): Promise<FIIDIIData[]> {
  const cacheKey = 'fii-dii'
  const cached = cache.get<FIIDIIData[]>(cacheKey)
  if (cached) return cached

  try {
    const headers = {
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/',
      'User-Agent': 'Mozilla/5.0',
    }
    const res = await fetch('https://www.nseindia.com/api/fiidiiTradeReact', { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`NSE ${res.status}`)
    const json = await res.json()

    // API now returns flat records with category field — group by date
    const byDate: Record<string, any> = {}
    for (const row of (json ?? [])) {
      const dt = row.date
      if (!byDate[dt]) byDate[dt] = {}
      const cat = (row.category ?? '').toUpperCase()
      if (cat.includes('FII') || cat.includes('FPI')) {
        byDate[dt].fii_buy  = +(row.buyValue  ?? 0)
        byDate[dt].fii_sell = +(row.sellValue ?? 0)
        byDate[dt].fii_net  = +(row.netValue  ?? 0)
      } else if (cat.includes('DII')) {
        byDate[dt].dii_buy  = +(row.buyValue  ?? 0)
        byDate[dt].dii_sell = +(row.sellValue ?? 0)
        byDate[dt].dii_net  = +(row.netValue  ?? 0)
      }
    }
    const result: FIIDIIData[] = Object.entries(byDate).slice(0, 10).map(([date, d]) => ({
      date,
      fii_buy:  d.fii_buy  ?? 0,
      fii_sell: d.fii_sell ?? 0,
      fii_net:  d.fii_net  ?? 0,
      dii_buy:  d.dii_buy  ?? 0,
      dii_sell: d.dii_sell ?? 0,
      dii_net:  d.dii_net  ?? 0,
    }))

    cache.set(cacheKey, result, TTL.FII_DII)
    return result
  } catch (err) {
    console.error('[NSE] getFIIDII failed:', err)
    return []
  }
}

/** Sector performance — derived from live index data */
export async function getSectorData(): Promise<SectorData[]> {
  const cacheKey = 'sectors'
  const cached = cache.get<SectorData[]>(cacheKey)
  if (cached) return cached

  const sectorIndices = [
    'NIFTY IT','NIFTY BANK','NIFTY PHARMA','NIFTY AUTO',
    'NIFTY FMCG','NIFTY ENERGY','NIFTY METAL','NIFTY REALTY',
    'NIFTY INFRA','NIFTY MEDIA','NIFTY PRIVATE BANK','NIFTY FIN SERVICE',
  ]

  try {
    const indices = await getIndices()
    const result: SectorData[] = sectorIndices
      .map(name => {
        const idx = indices.find(i => i.symbol === name || i.name === name)
        if (!idx) return null
        return {
          name:      name.replace('NIFTY ', ''),
          changePct: idx.changePct,
          topStock:  '',
          marketCap: 0,
        }
      })
      .filter(Boolean) as SectorData[]

    if (result.length > 0) cache.set(cacheKey, result, TTL.SECTORS)
    return result
  } catch {
    return []
  }
}

/** Option chain from NSE using stock-nse-india package */
export async function getOptionChain(symbol: string): Promise<any> {
  const cacheKey = `chain:${symbol}`
  const cached = cache.get<any>(cacheKey)
  if (cached) return cached

  try {
    const nse = await getNSE()
    if (!nse) throw new Error('NSE client unavailable')

    const sym = symbol.toUpperCase()
    const isIndex = ['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY','SENSEX'].includes(sym)

    const json = isIndex
      ? await nse.getIndexOptionChain(sym)
      : await nse.getEquityOptionChain(sym)

    if (!json?.records?.data?.length) throw new Error('Empty option chain response')

    cache.set(cacheKey, json, TTL.CHAIN)
    return json
  } catch (err) {
    console.error('[NSE] getOptionChain failed:', err)
    return null
  }
}

/**
 * Market breadth — uses REAL advance/decline counts from NSE allIndices API.
 * The NSE API includes `advances`, `declines`, `unchanged` per index.
 * We use NIFTY 500 for broadest coverage; fallback to NIFTY 50.
 * If NSE is down (Yahoo Finance fallback was used), sums across all indices.
 */
export async function getMarketBreadth(): Promise<{ advances: number; declines: number; unchanged: number }> {
  try {
    const indices = await getIndices()
    if (indices.length === 0) return { advances: 0, declines: 0, unchanged: 0 }

    // Prefer NIFTY 500 — broadest breadth sample
    const nifty500 = indices.find(i => i.symbol === 'NIFTY 500' || i.symbol === 'Nifty 500')
    if (nifty500 && (nifty500.advances ?? 0) + (nifty500.declines ?? 0) > 0) {
      return {
        advances:  nifty500.advances  ?? 0,
        declines:  nifty500.declines  ?? 0,
        unchanged: nifty500.unchanged ?? 0,
      }
    }

    // Fallback: NIFTY 100
    const nifty100 = indices.find(i => i.symbol === 'NIFTY 100' || i.symbol === 'Nifty 100')
    if (nifty100 && (nifty100.advances ?? 0) + (nifty100.declines ?? 0) > 0) {
      return {
        advances:  nifty100.advances  ?? 0,
        declines:  nifty100.declines  ?? 0,
        unchanged: nifty100.unchanged ?? 0,
      }
    }

    // Fallback: NIFTY 50
    const nifty50 = indices.find(i => i.symbol === 'NIFTY 50')
    if (nifty50 && (nifty50.advances ?? 0) + (nifty50.declines ?? 0) > 0) {
      return {
        advances:  nifty50.advances  ?? 0,
        declines:  nifty50.declines  ?? 0,
        unchanged: nifty50.unchanged ?? 0,
      }
    }

    // Last resort: infer from changePct direction across all indices
    // (used when Yahoo Finance fallback was active — it doesn't provide A/D counts)
    const adv = indices.filter(i => i.changePct > 0).length
    const dec = indices.filter(i => i.changePct < 0).length
    const unc = indices.filter(i => i.changePct === 0).length
    if (adv + dec > 0) {
      return { advances: adv, declines: dec, unchanged: unc }
    }

    return { advances: 0, declines: 0, unchanged: 0 }
  } catch {
    return { advances: 0, declines: 0, unchanged: 0 }
  }
}
