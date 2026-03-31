/**
 * Zerodha Kite Connect market data — implements BrokerDataSource interface
 * Session loaded from DB (zerodha_access_token, zerodha_api_key)
 * All functions fail gracefully and return null/[] when not connected
 */
import { kiteHeaders } from './client'
import type { IndexData } from '@/types/market'
import type { BrokerDataSource } from '@/lib/brokers/types'

const KITE_API = 'https://api.kite.trade'
const SESSION_TTL_MS = 6 * 60 * 60 * 1000  // 6 hours

/* ── Session cache ─────────────────────────────────────────────────── */

interface Session { accessToken: string; apiKey: string; loadedAt: number }
let _session: Session | null = null

function loadSession(): Session | null {
  if (_session && Date.now() - _session.loadedAt < SESSION_TTL_MS) return _session
  try {
    const { getDb } = require('@/lib/db') as typeof import('@/lib/db')
    const db    = getDb()
    const token = (db.prepare("SELECT value FROM app_config WHERE key='zerodha_access_token'").get() as any)?.value
    const key   = (db.prepare("SELECT value FROM app_config WHERE key='zerodha_api_key'").get() as any)?.value
    if (!token || !key) { _session = null; return null }
    _session = { accessToken: token, apiKey: key, loadedAt: Date.now() }
    return _session
  } catch { return null }
}

/** Invalidate session cache — call after login/logout */
export function invalidateZerodhaSession() { _session = null }

/* ── Instrument tokens for indices ─────────────────────────────────── */
// Kite Connect instrument tokens (NSE exchange)
const INDEX_TOKENS: Record<string, { token: number; name: string }> = {
  'NSE:NIFTY 50':   { token: 256265,  name: 'NIFTY 50' },
  'NSE:NIFTY BANK': { token: 260105,  name: 'NIFTY BANK' },
  'NSE:INDIA VIX':  { token: 264969,  name: 'INDIA VIX' },
}

/* ── Instrument token cache (symbol → token) ───────────────────────── */
const TOKEN_CACHE = new Map<string, number>()

async function resolveInstrumentToken(
  symbol: string,
  session: Session,
): Promise<number | null> {
  const key = `NSE:${symbol}`
  if (TOKEN_CACHE.has(key)) return TOKEN_CACHE.get(key)!
  try {
    // Kite quote API returns data keyed by "NSE:SYMBOL"
    // We can probe the quote endpoint directly; if it returns data the token is valid
    const res = await fetch(
      `${KITE_API}/quote?i=${encodeURIComponent(key)}`,
      { headers: kiteHeaders(session.apiKey, session.accessToken), signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const item = json?.data?.[key]
    if (!item?.instrument_token) return null
    TOKEN_CACHE.set(key, item.instrument_token)
    return item.instrument_token
  } catch { return null }
}

/* ── Public API ────────────────────────────────────────────────────── */

/** Fetch key indices (NIFTY 50, NIFTY BANK, INDIA VIX) from Zerodha Kite */
export async function getIndicesFromZerodha(): Promise<IndexData[]> {
  const session = loadSession()
  if (!session) return []

  try {
    const symbols = Object.keys(INDEX_TOKENS)
    const query   = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
    const res     = await fetch(`${KITE_API}/quote?${query}`, {
      headers: kiteHeaders(session.apiKey, session.accessToken),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    if (json?.status !== 'success') return []

    return symbols
      .map((key): IndexData | null => {
        const q    = json.data?.[key]
        if (!q) return null
        const meta = INDEX_TOKENS[key]
        const prev = q.ohlc?.close ?? 0
        const ltp  = q.last_price  ?? 0
        return {
          symbol:    meta.name,
          name:      meta.name,
          ltp:       +ltp,
          change:    +(ltp - prev).toFixed(2),
          changePct: prev ? +((ltp - prev) / prev * 100).toFixed(2) : 0,
          high:      +(q.ohlc?.high   ?? 0),
          low:       +(q.ohlc?.low    ?? 0),
          open:      +(q.ohlc?.open   ?? 0),
          prevClose: +prev,
          pe: 0, pb: 0,
        }
      })
      .filter(Boolean) as IndexData[]
  } catch (err) {
    console.warn('[Zerodha] getIndicesFromZerodha failed:', (err as Error).message)
    return []
  }
}

/** Get LTP for any NSE symbol from Zerodha */
export async function getLTPFromZerodha(symbol: string): Promise<number | null> {
  const session = loadSession()
  if (!session) return null

  try {
    const key = `NSE:${symbol}`
    const res = await fetch(
      `${KITE_API}/quote/ltp?i=${encodeURIComponent(key)}`,
      { headers: kiteHeaders(session.apiKey, session.accessToken), signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json?.data?.[key]?.last_price ?? null
  } catch { return null }
}

/** Get OHLCV historical candles from Zerodha Kite */
export async function getHistoricalFromZerodha(
  symbol:   string,
  interval: string,   // '1m','5m','15m','60m','1d','1wk'
  period?:  string,
): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>> {
  const session = loadSession()
  if (!session) return []

  try {
    const instrumentToken = await resolveInstrumentToken(symbol, session)
    if (!instrumentToken) return []

    const INTERVAL_MAP: Record<string, string> = {
      '1m': 'minute', '5m': '5minute', '15m': '15minute',
      '60m': '60minute', '1d': 'day', '1wk': 'week',
    }
    const DAYS_MAP: Record<string, number> = {
      '1m': 30, '5m': 90, '15m': 90, '60m': 365, '1d': 730, '1wk': 1825,
    }
    const kiteInterval = INTERVAL_MAP[interval] ?? 'day'
    const days         = DAYS_MAP[interval] ?? 365

    const toDate   = new Date()
    const fromDate = new Date(toDate)
    fromDate.setDate(fromDate.getDate() - days)

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 09:15:00`

    const url = `${KITE_API}/instruments/historical/${instrumentToken}/${kiteInterval}`
      + `?from=${encodeURIComponent(fmt(fromDate))}&to=${encodeURIComponent(fmt(toDate))}&continuous=0`

    const res = await fetch(url, {
      headers: kiteHeaders(session.apiKey, session.accessToken),
      signal:  AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const json = await res.json()
    if (!json?.data?.candles?.length) return []

    // Kite candle format: [timestamp, open, high, low, close, volume, oi]
    return json.data.candles.map((c: any[]) => ({
      time:   Math.floor(new Date(c[0]).getTime() / 1000),
      open:   c[1], high: c[2], low: c[3], close: c[4], volume: c[5] ?? 0,
    }))
  } catch { return [] }
}

/* ── Broker factory ────────────────────────────────────────────────── */

/**
 * Returns a Zerodha BrokerDataSource if a session exists in the DB,
 * or null if not connected. Called by the broker registry.
 */
export function createZerodhaBroker(): BrokerDataSource | null {
  const session = loadSession()
  if (!session) return null
  return {
    name:          'Zerodha',
    getIndices:    getIndicesFromZerodha,
    getLTP:        getLTPFromZerodha,
    getHistorical: getHistoricalFromZerodha,
  }
}
