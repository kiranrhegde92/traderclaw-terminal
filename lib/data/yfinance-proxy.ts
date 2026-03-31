/**
 * yfinance-compatible historical data via Yahoo Finance v8 API
 * No npm package needed — direct HTTP calls
 */
import type { OHLCV } from '@/types/market'
import { cache, TTL } from '../nse/cache'

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

const INTERVAL_MAP: Record<string, string> = {
  'ONE_MINUTE':     '1m',
  'FIVE_MINUTE':    '5m',
  'FIFTEEN_MINUTE': '15m',
  'ONE_HOUR':       '60m',
  'ONE_DAY':        '1d',
  'ONE_WEEK':       '1wk',
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '60m': '60m',
  '1d':  '1d',
  '1wk': '1wk',
}

const RANGE_FOR_INTERVAL: Record<string, string> = {
  '1m':  '7d',
  '5m':  '60d',
  '15m': '60d',
  '60m': '1y',
  '1d':  '5y',
  '1wk': '10y',
}

/** Convert NSE symbol to Yahoo Finance ticker */
export function toYFTicker(symbol: string): string {
  // Index symbols
  const indexMap: Record<string, string> = {
    'NIFTY 50':        '^NSEI',
    'NIFTY':           '^NSEI',
    'NIFTY50':         '^NSEI',
    'NIFTY BANK':      '^NSEBANK',
    'BANKNIFTY':       '^NSEBANK',
    'SENSEX':          '^BSESN',
    'INDIA VIX':       '^INDIAVIX',
    'NIFTY FIN SERVICE':'^CNXFIN',
    'FINNIFTY':        '^CNXFIN',
  }
  if (indexMap[symbol.toUpperCase()]) return indexMap[symbol.toUpperCase()]
  // NSE equity — append .NS
  return `${symbol.toUpperCase()}.NS`
}

/** Fetch OHLCV candles — Angel One primary, Yahoo Finance fallback */
export async function getHistorical(
  symbol: string,
  interval = '1d',
  period  = ''
): Promise<OHLCV[]> {
  const yfInterval = INTERVAL_MAP[interval] ?? '1d'
  const yfRange    = period || RANGE_FOR_INTERVAL[yfInterval] || '1y'
  const ticker     = toYFTicker(symbol)
  const cacheKey   = `hist:${ticker}:${yfInterval}:${yfRange}`

  const cached = cache.get<OHLCV[]>(cacheKey)
  if (cached) return cached

  // ── Primary: Connected broker ──
  try {
    const { getActiveBroker } = await import('@/lib/brokers/registry')
    const broker  = await getActiveBroker()
    const candles = broker ? await broker.getHistorical(symbol, interval, yfRange) : []
    if (candles.length > 0) {
      cache.set(cacheKey, candles, TTL.HISTORY)
      return candles
    }
  } catch { /* fall through to Yahoo Finance */ }

  // ── Fallback: Yahoo Finance ──
  const url = `${YF_BASE}/${encodeURIComponent(ticker)}?interval=${yfInterval}&range=${yfRange}&includePrePost=false`
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  }

  try {
    const res  = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`)
    const json = await res.json()

    const result  = json.chart?.result?.[0]
    if (!result) throw new Error('No chart data')

    const timestamps = result.timestamp as number[]
    const q = result.indicators?.quote?.[0]
    if (!timestamps || !q) throw new Error('No quote data')

    const candles: OHLCV[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (!q.close[i] || !q.open[i]) continue  // skip null bars
      candles.push({
        time:   timestamps[i],
        open:   q.open[i],
        high:   q.high[i],
        low:    q.low[i],
        close:  q.close[i],
        volume: q.volume?.[i] ?? 0,
      })
    }

    cache.set(cacheKey, candles, TTL.HISTORY)
    return candles
  } catch (err) {
    console.error(`[YFinance] getHistorical ${ticker} failed:`, err)
    return []
  }
}

/** Get latest price — Angel One primary, Yahoo Finance fallback */
export async function getLTP(symbol: string): Promise<number | null> {
  // ── Primary: Connected broker ──
  try {
    const { getActiveBroker } = await import('@/lib/brokers/registry')
    const broker = await getActiveBroker()
    const price  = broker ? await broker.getLTP(symbol) : null
    if (price !== null) return price
  } catch { /* fall through */ }

  // ── Fallback: Yahoo Finance ──
  const ticker = toYFTicker(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`
  const headers = { 'User-Agent': 'Mozilla/5.0' }
  try {
    const res  = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json.chart?.result?.[0]?.meta
    return meta?.regularMarketPrice ?? meta?.previousClose ?? null
  } catch {
    return null
  }
}
