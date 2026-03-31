/**
 * Finnhub API client for real fundamental data
 * Provides PE, ROE, ROCE, Debt/Equity, Dividend Yield, EPS Growth, etc.
 * Free tier: 60 API calls/minute
 *
 * API key stored encrypted in database (app_config table)
 */

import { cache, TTL } from '@/lib/nse/cache'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

// Cache for API key to avoid repeated DB reads
let cachedApiKey: string | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 1 minute

/**
 * Get API key from database (with in-memory cache)
 */
async function getApiKey(): Promise<string> {
  const now = Date.now()

  // Return cached key if still valid
  if (cachedApiKey !== null && now - cacheTimestamp < CACHE_DURATION) {
    return cachedApiKey
  }

  try {
    const db = getDb()
    const config = db
      .prepare(`SELECT value FROM app_config WHERE key = 'finnhub_api_key' LIMIT 1`)
      .get() as any

    if (!config?.value) {
      cachedApiKey = ''
      cacheTimestamp = now
      return ''
    }

    // Decrypt the stored key
    const decrypted = decrypt(config.value)
    cachedApiKey = decrypted
    cacheTimestamp = now
    return decrypted
  } catch (err) {
    console.error('Error retrieving Finnhub API key from database:', err)
    cachedApiKey = ''
    cacheTimestamp = now
    return ''
  }
}

/**
 * Clear cached API key (called when configuration changes)
 */
export function clearApiKeyCache() {
  cachedApiKey = null
  cacheTimestamp = 0
}

// Rate limiter: tracks requests per minute
const rateLimiter = {
  requests: [] as number[],
  limit: 60, // 60 req/min for free tier
  window: 60000, // 1 minute in ms

  isAllowed(): boolean {
    const now = Date.now()
    // Remove old requests outside the window
    this.requests = this.requests.filter(t => now - t < this.window)

    if (this.requests.length < this.limit) {
      this.requests.push(now)
      return true
    }
    return false
  },

  async waitIfNeeded(): Promise<void> {
    while (!this.isAllowed()) {
      const oldestRequest = this.requests[0]
      const waitTime = this.window - (Date.now() - oldestRequest) + 10
      await new Promise(r => setTimeout(r, Math.min(waitTime, 100)))
    }
  }
}

export interface FundamentalData {
  symbol: string
  company: string
  pe?: number
  pb?: number
  roe?: number
  roce?: number
  debtToEquity?: number
  marketCap?: number // in crores
  dividendYield?: number
  eps?: number
  epsGrowth?: number // in %
}

/**
 * Fetch company profile from Finnhub
 * Includes PE, PB, market cap
 */
async function fetchCompanyProfile(symbol: string): Promise<any> {
  const apiKey = await getApiKey()

  if (!apiKey) {
    return null
  }

  try {
    const url = `${FINNHUB_BASE}/company-basic-financials?symbol=${symbol}&metric=all&token=${apiKey}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`Finnhub rate limited for ${symbol}`)
      }
      return null
    }

    const data = await res.json()
    return data
  } catch (err: any) {
    console.error(`Error fetching Finnhub profile for ${symbol}:`, err.message)
    return null
  }
}

/**
 * Fetch quote (price, change) from Finnhub
 */
async function fetchQuote(symbol: string): Promise<any> {
  const apiKey = await getApiKey()

  if (!apiKey) return null

  try {
    const url = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null
    return await res.json()
  } catch (err: any) {
    console.error(`Error fetching Finnhub quote for ${symbol}:`, err.message)
    return null
  }
}

/**
 * Validate fundamental metrics
 */
function validateFundamentals(data: any): Partial<FundamentalData> {
  const result: Partial<FundamentalData> = {}

  if (data.series) {
    const annual = data.series.annual || {}

    // PE Ratio
    if (annual.PE && Array.isArray(annual.PE) && annual.PE[0]) {
      const pe = annual.PE[0].v
      if (pe && pe > 0 && pe < 500) result.pe = pe
    }

    // PB Ratio
    if (annual.PB && Array.isArray(annual.PB) && annual.PB[0]) {
      const pb = annual.PB[0].v
      if (pb && pb > 0 && pb < 20) result.pb = pb
    }

    // ROE
    if (annual.ROE && Array.isArray(annual.ROE) && annual.ROE[0]) {
      const roe = annual.ROE[0].v * 100 // Convert to percentage
      if (roe && roe >= -100 && roe <= 100) result.roe = roe
    }

    // ROCE
    if (annual.ROCE && Array.isArray(annual.ROCE) && annual.ROCE[0]) {
      const roce = annual.ROCE[0].v * 100 // Convert to percentage
      if (roce && roce >= -100 && roce <= 100) result.roce = roce
    }

    // Debt to Equity
    if (annual['Debt/Equity'] && Array.isArray(annual['Debt/Equity']) && annual['Debt/Equity'][0]) {
      const de = annual['Debt/Equity'][0].v
      if (de !== null && de >= 0) result.debtToEquity = de
    }

    // Market Cap
    if (annual.MarketCap && Array.isArray(annual.MarketCap) && annual.MarketCap[0]) {
      const mc = annual.MarketCap[0].v
      if (mc && mc > 0) {
        // Convert to crores (1 crore = 1e7)
        result.marketCap = mc / 1e7
      }
    }

    // Dividend Yield
    if (annual.dividendYield && Array.isArray(annual.dividendYield) && annual.dividendYield[0]) {
      const dy = annual.dividendYield[0].v * 100 // Convert to percentage
      if (dy !== null && dy >= 0 && dy <= 50) result.dividendYield = dy
    }

    // EPS
    if (annual.EPS && Array.isArray(annual.EPS) && annual.EPS[0]) {
      const eps = annual.EPS[0].v
      if (eps && eps > 0 && eps < 10000) result.eps = eps
    }

    // EPS Growth (estimated)
    if (annual.EPSGrowth && Array.isArray(annual.EPSGrowth) && annual.EPSGrowth[0]) {
      const growth = annual.EPSGrowth[0].v * 100 // Convert to percentage
      if (growth && growth >= -100 && growth <= 200) result.epsGrowth = growth
    }
  }

  return result
}

/**
 * Get fundamentals for a single stock
 * Respects rate limit and caching
 */
export async function getFundamental(symbol: string): Promise<FundamentalData | null> {
  // Remove .NS suffix for Finnhub API
  const cleanSymbol = symbol.replace('.NS', '').replace('.BSE', '')

  // Check cache first
  const cacheKey = `finnhub:${cleanSymbol}`
  const cached = cache.get<FundamentalData>(cacheKey)
  if (cached) return cached

  // Wait if rate limited
  await rateLimiter.waitIfNeeded()

  // Fetch from Finnhub
  const profile = await fetchCompanyProfile(cleanSymbol)
  if (!profile) return null

  // Extract and validate metrics
  const metrics = validateFundamentals(profile)
  if (Object.keys(metrics).length === 0) return null

  // Fetch quote for company name
  const quote = await fetchQuote(cleanSymbol)
  const company = quote?.name || cleanSymbol

  const result: FundamentalData = {
    symbol: cleanSymbol,
    company,
    ...metrics,
  }

  // Cache for 6 hours
  cache.set(cacheKey, result, TTL.FUNDAMENTAL)

  return result
}

/**
 * Get fundamentals for multiple stocks
 * Batches requests to respect rate limit
 */
export async function getFundamentalsBatch(symbols: string[]): Promise<Record<string, FundamentalData>> {
  const results: Record<string, FundamentalData> = {}

  for (const symbol of symbols) {
    const fundamental = await getFundamental(symbol)
    if (fundamental) {
      results[symbol] = fundamental
    }
  }

  return results
}

/**
 * Check if API key is configured (async version)
 */
export async function isFinnhubConfigured(): Promise<boolean> {
  const apiKey = await getApiKey()
  return !!apiKey
}

/**
 * Check if API key is configured (synchronous, uses cache)
 * WARNING: Returns cached value, may not be current
 */
export function isFinnhubConfiguredSync(): boolean {
  return !!cachedApiKey
}

/**
 * Get API status
 */
export async function getStatus(): Promise<{
  configured: boolean
  rateLimitRemaining: number
  rateLimitReset: number
}> {
  return {
    configured: isFinnhubConfigured(),
    rateLimitRemaining: Math.max(0, rateLimiter.limit - rateLimiter.requests.length),
    rateLimitReset: rateLimiter.requests.length > 0
      ? rateLimiter.requests[0] + rateLimiter.window
      : Date.now(),
  }
}
