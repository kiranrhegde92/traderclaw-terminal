import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getHistorical } from '@/lib/data/yfinance-proxy'
import { cache } from '@/lib/nse/cache'

const CACHE_KEY = 'portfolio:risk:metrics'
const CACHE_TTL = 30 * 60 * 1000 // 30 min

function computeReturns(closes: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
    }
  }
  return returns
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, x) => s + x, 0) / arr.length
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ma = mean(a.slice(0, n))
  const mb = mean(b.slice(0, n))
  return a.slice(0, n).reduce((s, ai, i) => s + (ai - ma) * (b[i] - mb), 0) / (n - 1)
}

function beta(stockReturns: number[], marketReturns: number[]): number {
  const cov = covariance(stockReturns, marketReturns)
  const varM = stdDev(marketReturns) ** 2
  return varM === 0 ? 1 : cov / varM
}

function maxDrawdown5Day(closes: number[]): number {
  let worst = 0
  for (let i = 5; i < closes.length; i++) {
    const ret = (closes[i] - closes[i - 5]) / closes[i - 5]
    if (ret < worst) worst = ret
  }
  return parseFloat((worst * 100).toFixed(2))
}

export async function GET() {
  try {
    // Check cache
    const cached = cache.get<any>(CACHE_KEY)
    if (cached) return NextResponse.json(cached)

    const db = getDb()
    const positions = db.prepare(
      `SELECT symbol, quantity, average_price, current_price
       FROM paper_positions WHERE account_id = 1 AND quantity > 0 AND segment = 'EQ'`
    ).all() as any[]

    if (positions.length === 0) {
      return NextResponse.json({
        beta: 0, var95: 0, var99: 0, maxDrawdown: 0,
        portfolioStdDev: 0, stocks: [],
      })
    }

    // Fetch NIFTY returns
    const niftyCandles = await getHistorical('NIFTY', '1d', '30d')
    const niftyCloses = niftyCandles.map(c => c.close)
    const niftyReturns = computeReturns(niftyCloses)

    const stocksData: any[] = []
    let totalValue = 0
    const stockValues: number[] = []

    for (const pos of positions) {
      const currentPrice = pos.current_price ?? pos.average_price
      const value = currentPrice * pos.quantity
      totalValue += value
      stockValues.push(value)
    }

    const weightedReturnsByDay: number[][] = []
    let portfolioBeta = 0

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      const currentPrice = pos.current_price ?? pos.average_price
      const value = currentPrice * pos.quantity
      const weight = totalValue > 0 ? value / totalValue : 0

      try {
        const candles = await getHistorical(pos.symbol, '1d', '30d')
        const closes = candles.map(c => c.close)
        const returns = computeReturns(closes)
        const stockBeta = beta(returns, niftyReturns)
        const stockStd = stdDev(returns)

        portfolioBeta += stockBeta * weight

        for (let d = 0; d < returns.length; d++) {
          if (!weightedReturnsByDay[d]) weightedReturnsByDay[d] = []
          weightedReturnsByDay[d].push(returns[d] * weight)
        }

        stocksData.push({
          symbol: pos.symbol,
          quantity: pos.quantity,
          avgPrice: pos.average_price,
          currentPrice,
          value: parseFloat(value.toFixed(2)),
          weight: parseFloat((weight * 100).toFixed(2)),
          beta: parseFloat(stockBeta.toFixed(3)),
          stdDev: parseFloat((stockStd * 100).toFixed(2)),
        })
      } catch {
        stocksData.push({
          symbol: pos.symbol,
          quantity: pos.quantity,
          avgPrice: pos.average_price,
          currentPrice,
          value: parseFloat(value.toFixed(2)),
          weight: parseFloat((weight * 100).toFixed(2)),
          beta: 1,
          stdDev: 0,
        })
      }
    }

    // Portfolio daily returns (sum of weighted returns)
    const portfolioReturns = weightedReturnsByDay.map(day => day.reduce((s, x) => s + x, 0))
    const portfolioStd = stdDev(portfolioReturns)

    // Parametric VaR (annualised: use daily std)
    const var95 = totalValue * 1.645 * portfolioStd
    const var99 = totalValue * 2.326 * portfolioStd

    // Max drawdown using NIFTY as proxy (or use portfolio if enough data)
    const mdd = maxDrawdown5Day(niftyCloses)

    // Return distribution (histogram buckets)
    const distribution = computeReturnDistribution(portfolioReturns)

    const result = {
      beta: parseFloat(portfolioBeta.toFixed(3)),
      var95: parseFloat(var95.toFixed(2)),
      var99: parseFloat(var99.toFixed(2)),
      maxDrawdown: mdd,
      portfolioStdDev: parseFloat((portfolioStd * 100).toFixed(3)),
      totalValue: parseFloat(totalValue.toFixed(2)),
      stocks: stocksData,
      distribution,
      cachedAt: new Date().toISOString(),
    }

    cache.set(CACHE_KEY, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function computeReturnDistribution(returns: number[], buckets = 10): { label: string; count: number }[] {
  if (returns.length === 0) return []
  const min = Math.min(...returns)
  const max = Math.max(...returns)
  const range = max - min || 0.01
  const step = range / buckets
  const hist: { label: string; count: number }[] = []
  for (let i = 0; i < buckets; i++) {
    const lo = min + i * step
    const hi = lo + step
    const count = returns.filter(r => r >= lo && r < hi).length
    hist.push({ label: `${(lo * 100).toFixed(1)}%`, count })
  }
  return hist
}
