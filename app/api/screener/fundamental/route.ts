import { NextRequest, NextResponse } from 'next/server'
import { NIFTY100_SYMBOLS } from '@/lib/utils/constants'
import { getFundamental, isFinnhubConfigured } from '@/lib/data/finnhub-client'

/** Stock fundamental data from Yahoo Finance */
interface FundamentalStock {
  symbol: string
  company: string
  price: number
  changePct: number
  pe?: number
  pb?: number
  roe?: number
  roce?: number
  debtToEquity?: number
  marketCap?: number
  dividendYield?: number
  eps?: number
  epsGrowth?: number
}

/** In-memory cache with 1-hour TTL */
const cache: Record<string, { data: FundamentalStock[]; timestamp: number }> = {}
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Fallback mock fundamental data (used when Finnhub is down)
 * Seeded random for consistency
 */
function generateMockFundamental(symbol: string, price: number): FundamentalStock {
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1)
  const random = (min: number, max: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453
    return min + ((x - Math.floor(x)) * (max - min))
  }

  return {
    symbol,
    company: symbol,
    price,
    changePct: random(-5, 5),
    pe: random(8, 35),
    pb: random(0.5, 4),
    roe: random(5, 40),
    roce: random(5, 40),
    debtToEquity: random(0, 2.5),
    marketCap: random(1000, 50000) * 100, // In Cr
    dividendYield: random(0, 5),
    eps: random(1, 50),
    epsGrowth: random(-20, 50),
  }
}

/**
 * GET /api/screener/fundamental
 * Query params:
 * - pe_min, pe_max: PE ratio filter
 * - pb_min, pb_max: PB ratio filter
 * - roe_min, roe_max: ROE% filter
 * - roce_min, roce_max: ROCE% filter
 * - debt_min, debt_max: Debt/Equity filter
 * - mcap_min, mcap_max: Market Cap in Cr
 * - div_min, div_max: Dividend Yield%
 * - eps_growth_min, eps_growth_max: EPS Growth YoY%
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  // Parse filters
  const filters = {
    pe_min: parseFloat(searchParams.get('pe_min') ?? '0') || 0,
    pe_max: parseFloat(searchParams.get('pe_max') ?? '100') || 100,
    pb_min: parseFloat(searchParams.get('pb_min') ?? '0') || 0,
    pb_max: parseFloat(searchParams.get('pb_max') ?? '10') || 10,
    roe_min: parseFloat(searchParams.get('roe_min') ?? '0') || 0,
    roe_max: parseFloat(searchParams.get('roe_max') ?? '50') || 50,
    roce_min: parseFloat(searchParams.get('roce_min') ?? '0') || 0,
    roce_max: parseFloat(searchParams.get('roce_max') ?? '50') || 50,
    debt_min: parseFloat(searchParams.get('debt_min') ?? '0') || 0,
    debt_max: parseFloat(searchParams.get('debt_max') ?? '3') || 3,
    mcap_min: parseFloat(searchParams.get('mcap_min') ?? '0') || 0,
    mcap_max: parseFloat(searchParams.get('mcap_max') ?? '100000') || 100000,
    div_min: parseFloat(searchParams.get('div_min') ?? '0') || 0,
    div_max: parseFloat(searchParams.get('div_max') ?? '10') || 10,
    eps_growth_min: parseFloat(searchParams.get('eps_growth_min') ?? '-50') || -50,
    eps_growth_max: parseFloat(searchParams.get('eps_growth_max') ?? '50') || 50,
  }

  try {
    // Check cache
    const cacheKey = JSON.stringify(filters)
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      const finnhubAvailable = await isFinnhubConfigured()
      return NextResponse.json({
        stocks: cache[cacheKey].data,
        cached: true,
        timestamp: cache[cacheKey].timestamp,
        finnhubAvailable,
      })
    }

    const results: FundamentalStock[] = []
    const finnhubAvailable = await isFinnhubConfigured()

    // Fetch current prices for all symbols
    const pricePromises = NIFTY100_SYMBOLS.slice(0, 100).map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) return null
        const json = await res.json()
        const meta = json.chart?.result?.[0]?.meta
        if (!meta) return null

        const price = +(meta.regularMarketPrice ?? 0)
        const prevClose = +(meta.chartPreviousClose ?? meta.previousClose ?? price)
        const changePct = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0

        return { symbol, price, changePct, company: meta.longName || symbol }
      } catch {
        return null
      }
    })

    const priceData = await Promise.allSettled(pricePromises)

    // Fetch fundamentals from Finnhub (or use fallback mock data)
    for (const settlement of priceData) {
      if (settlement.status === 'fulfilled' && settlement.value) {
        const { symbol, price, changePct, company } = settlement.value

        let fundamental: FundamentalStock

        if (finnhubAvailable) {
          // Fetch real fundamentals from Finnhub
          const realFundamental = await getFundamental(symbol)

          if (realFundamental) {
            fundamental = {
              ...realFundamental,
              price,
              changePct,
              company: realFundamental.company || company,
            } as FundamentalStock
          } else {
            // Fallback to mock if Finnhub fails for this stock
            fundamental = generateMockFundamental(symbol, price)
            fundamental.company = company
          }
        } else {
          // Fallback to mock if Finnhub is not configured
          fundamental = generateMockFundamental(symbol, price)
          fundamental.company = company
        }

        // Apply filters (only include if all filters pass)
        if (
          (!fundamental.pe || (fundamental.pe >= filters.pe_min && fundamental.pe <= filters.pe_max)) &&
          (!fundamental.pb || (fundamental.pb >= filters.pb_min && fundamental.pb <= filters.pb_max)) &&
          (!fundamental.roe || (fundamental.roe >= filters.roe_min && fundamental.roe <= filters.roe_max)) &&
          (!fundamental.roce || (fundamental.roce >= filters.roce_min && fundamental.roce <= filters.roce_max)) &&
          (!fundamental.debtToEquity || (fundamental.debtToEquity >= filters.debt_min && fundamental.debtToEquity <= filters.debt_max)) &&
          (!fundamental.marketCap || (fundamental.marketCap >= filters.mcap_min && fundamental.marketCap <= filters.mcap_max)) &&
          (!fundamental.dividendYield || (fundamental.dividendYield >= filters.div_min && fundamental.dividendYield <= filters.div_max)) &&
          (!fundamental.epsGrowth || (fundamental.epsGrowth >= filters.eps_growth_min && fundamental.epsGrowth <= filters.eps_growth_max))
        ) {
          results.push(fundamental)
        }
      }
    }

    // Cache results
    cache[cacheKey] = { data: results, timestamp: Date.now() }

    return NextResponse.json({
      stocks: results,
      cached: false,
      timestamp: Date.now(),
      finnhubAvailable,
    })
  } catch (err: any) {
    console.error('Fundamental screener error:', err)
    return NextResponse.json({ stocks: [], error: err.message }, { status: 200 })
  }
}
