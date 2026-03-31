/**
 * Angel One market data — implements BrokerDataSource interface
 * Session + token caching, quote API, symbol lookup
 * All functions fail gracefully and return null/[] when not connected
 */
import { commonHeaders } from './client'
import type { IndexData } from '@/types/market'
import type { BrokerDataSource } from '@/lib/brokers/types'

const BASE = 'https://apiconnect.angelbroking.com'
const SESSION_TTL_MS = 6 * 60 * 60 * 1000  // 6 hours

/* ── Session cache ─────────────────────────────────────────────────── */

interface Session { jwtToken: string; apiKey: string; loadedAt: number }
let _session: Session | null = null

function loadSession(): Session | null {
  if (_session && Date.now() - _session.loadedAt < SESSION_TTL_MS) return _session
  try {
    const { getDb } = require('@/lib/db') as typeof import('@/lib/db')
    const db  = getDb()
    const jwt = (db.prepare("SELECT value FROM app_config WHERE key='session_jwt'").get() as any)?.value
    const key = (db.prepare("SELECT value FROM app_config WHERE key='session_apikey'").get() as any)?.value
    if (!jwt || !key) { _session = null; return null }
    _session = { jwtToken: jwt, apiKey: key, loadedAt: Date.now() }
    return _session
  } catch { return null }
}

/** Invalidate session cache — call after login/logout */
export function invalidateSession() { _session = null }

/* ── Token cache ───────────────────────────────────────────────────── */

// Pre-seeded with confident index tokens (NSE exchange)
const TOKEN_CACHE = new Map<string, string>([
  ['NSE:NIFTY 50',   '26000'],
  ['NSE:NIFTY BANK', '26009'],
  ['NSE:INDIA VIX',  '26017'],
])

// Reverse map token → display name for index responses
const TOKEN_NAMES: Record<string, string> = {
  '26000': 'NIFTY 50',
  '26009': 'NIFTY BANK',
  '26017': 'INDIA VIX',
}

async function resolveToken(
  symbol: string,
  exchange: string,
  session: Session
): Promise<string | null> {
  const cacheKey = `${exchange}:${symbol}`
  if (TOKEN_CACHE.has(cacheKey)) return TOKEN_CACHE.get(cacheKey)!

  try {
    const res = await fetch(
      `${BASE}/rest/secure/angelbroking/order/v1/searchScrip?exchange=${exchange}&searchscrip=${encodeURIComponent(symbol)}`,
      { headers: commonHeaders(session.apiKey, session.jwtToken), signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    // Prefer exact match, otherwise first result
    const items: any[] = json.data ?? []
    const match = items.find((d: any) => d.tradingSymbol === symbol) ?? items[0]
    if (!match?.symbolToken) return null
    TOKEN_CACHE.set(cacheKey, match.symbolToken)
    return match.symbolToken
  } catch { return null }
}

/* ── Quote API ─────────────────────────────────────────────────────── */

interface QuoteResult {
  tradingSymbol: string
  symbolToken:   string
  exchange:      string
  ltp:           number
  open:          number
  high:          number
  low:           number
  close:         number   // previous close in FULL mode
  netChange:     number
  percentChange: number
  tradeVolume:   number
}

/** Fetch FULL quote for a list of tokens on a single exchange */
async function getQuote(
  session: Session,
  exchange: string,
  tokens: string[]
): Promise<QuoteResult[]> {
  const res = await fetch(`${BASE}/rest/secure/angelbroking/market/v1/quote/`, {
    method:  'POST',
    headers: commonHeaders(session.apiKey, session.jwtToken),
    body:    JSON.stringify({ mode: 'FULL', exchangeTokens: { [exchange]: tokens } }),
    signal:  AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Angel One quote HTTP ${res.status}`)
  const json = await res.json()
  if (!json?.status) throw new Error(json?.message ?? 'Quote API error')
  return json.data?.fetched ?? []
}

/* ── Public API ────────────────────────────────────────────────────── */

/** Fetch key indices (NIFTY 50, NIFTY BANK, INDIA VIX) from Angel One */
export async function getIndicesFromAngelOne(): Promise<IndexData[]> {
  const session = loadSession()
  if (!session) return []

  try {
    const tokens = ['26000', '26009', '26017']
    const fetched = await getQuote(session, 'NSE', tokens)
    return fetched.map((q): IndexData => ({
      symbol:    TOKEN_NAMES[q.symbolToken] ?? q.tradingSymbol,
      name:      TOKEN_NAMES[q.symbolToken] ?? q.tradingSymbol,
      ltp:       +(q.ltp       ?? 0),
      change:    +(q.netChange  ?? 0),
      changePct: +(q.percentChange ?? 0),
      high:      +(q.high      ?? 0),
      low:       +(q.low       ?? 0),
      open:      +(q.open      ?? 0),
      prevClose: +(q.close     ?? 0),
      pe: 0, pb: 0,
    }))
  } catch (err) {
    console.warn('[AngelOne] getIndicesFromAngelOne failed:', (err as Error).message)
    return []
  }
}

/** Get LTP for any NSE symbol from Angel One */
export async function getLTPFromAngelOne(symbol: string): Promise<number | null> {
  const session = loadSession()
  if (!session) return null

  try {
    const exchange = 'NSE'
    const token    = await resolveToken(symbol, exchange, session)
    if (!token) return null
    const [q]     = await getQuote(session, exchange, [token])
    return q?.ltp ?? null
  } catch { return null }
}

/** Get OHLCV historical candles from Angel One */
export async function getHistoricalFromAngelOne(
  symbol:   string,
  interval: string,   // '1m','5m','15m','60m','1d','1wk'
  period?:  string    // e.g. '60d','1y' — used to calculate fromdate
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>> {
  const session = loadSession()
  if (!session) return []

  try {
    const exchange = 'NSE'
    const token    = await resolveToken(symbol, exchange, session)
    if (!token) return []

    const INTERVAL_MAP: Record<string, string> = {
      '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE',
      '60m': 'ONE_HOUR',  '1d': 'ONE_DAY',     '1wk': 'ONE_WEEK',
    }
    const DAYS_MAP: Record<string, number> = {
      '1m': 30, '5m': 90, '15m': 90, '60m': 365, '1d': 730, '1wk': 1825,
    }
    const aoInterval = INTERVAL_MAP[interval] ?? 'ONE_DAY'
    const days       = DAYS_MAP[interval] ?? 365

    const toDate   = new Date()
    const fromDate = new Date(toDate)
    fromDate.setDate(fromDate.getDate() - days)

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 09:00`

    const res = await fetch(`${BASE}/rest/secure/angelbroking/historical/v1/getCandleData`, {
      method:  'POST',
      headers: commonHeaders(session.apiKey, session.jwtToken),
      body:    JSON.stringify({
        exchange, symboltoken: token, interval: aoInterval,
        fromdate: fmt(fromDate), todate: fmt(toDate),
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const json = await res.json()
    if (!json?.data?.length) return []

    return json.data.map((d: any[]) => ({
      time:   Math.floor(new Date(d[0]).getTime() / 1000),
      open:   d[1], high: d[2], low: d[3], close: d[4], volume: d[5] ?? 0,
    }))
  } catch { return [] }
}

/* ── Broker factory ────────────────────────────────────────────────── */

/**
 * Returns an Angel One BrokerDataSource if a session exists in the DB,
 * or null if not connected. Called by the broker registry.
 */
export function createAngelOneBroker(): BrokerDataSource | null {
  const session = loadSession()
  if (!session) return null
  return {
    name:          'Angel One',
    getIndices:    getIndicesFromAngelOne,
    getLTP:        getLTPFromAngelOne,
    getHistorical: getHistoricalFromAngelOne,
  }
}
