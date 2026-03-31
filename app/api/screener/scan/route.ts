import { NextRequest, NextResponse } from 'next/server'
import { getHistorical } from '@/lib/data/yfinance-proxy'
import { getIndicatorSummary } from '@/lib/analysis/indicators'
import { detectPatterns } from '@/lib/analysis/patterns'
import { NIFTY50_SYMBOLS, NIFTY100_SYMBOLS, FO_SYMBOLS } from '@/lib/utils/constants'

interface FilterCriteria {
  universe?:       'nifty50' | 'nifty100' | 'fo' | 'custom'
  symbols?:        string[]
  interval?:       string
  // Price
  priceMin?:       number
  priceMax?:       number
  // RSI
  rsiMin?:         number
  rsiMax?:         number
  // MACD
  macdBullish?:    boolean
  macdBearish?:    boolean
  // Moving Averages
  aboveEMA20?:     boolean
  aboveEMA50?:     boolean
  aboveEMA200?:    boolean
  goldenCross?:    boolean   // EMA50 > EMA200
  deathCross?:     boolean   // EMA50 < EMA200
  // VWAP / BB
  aboveVWAP?:      boolean
  bbSqueeze?:      boolean
  bbBreakout?:     boolean   // close > upper band
  // Volume
  volumeSpike?:    boolean   // volume > 2x 20d avg
  // ADX (trend strength)
  adxMin?:         number
  // Stochastic
  stochOversold?:  boolean   // K < 20
  stochOverbought?: boolean  // K > 80
  // 52-week levels
  near52wHigh?:    boolean   // within 5% of 52w high
  near52wLow?:     boolean   // within 5% of 52w low
  // Patterns
  patterns?:       string[]
}

export async function POST(req: NextRequest) {
  try {
    const body: FilterCriteria = await req.json()

    // Resolve universe
    let symbols: string[]
    if (body.symbols?.length) {
      symbols = body.symbols
    } else {
      switch (body.universe) {
        case 'nifty100': symbols = NIFTY100_SYMBOLS; break
        case 'fo':       symbols = FO_SYMBOLS;       break
        default:         symbols = NIFTY50_SYMBOLS;  break
      }
    }

    const interval = body.interval ?? '1d'
    const results: any[] = []

    // Process in batches of 5 to avoid rate-limiting
    const batchSize = 5
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const settled = await Promise.allSettled(
        batch.map(async sym => {
          const candles = await getHistorical(sym, interval)
          if (candles.length < 30) return null

          const indicators = await getIndicatorSummary(candles)
          if (!indicators) return null

          const last    = candles[candles.length - 1]
          const prev    = candles[candles.length - 2]
          const close   = last.close
          const change  = close - prev.close
          const changePct = (change / prev.close) * 100

          // ── Price filter ──
          if (body.priceMin !== undefined && close < body.priceMin) return null
          if (body.priceMax !== undefined && close > body.priceMax) return null

          // ── RSI ──
          if (body.rsiMin !== undefined && indicators.rsi < body.rsiMin) return null
          if (body.rsiMax !== undefined && indicators.rsi > body.rsiMax) return null

          // ── MACD ──
          if (body.macdBullish && !indicators.macdBullish) return null
          if (body.macdBearish && !indicators.macdBearish) return null

          // ── EMAs ──
          if (body.aboveEMA20  === true  && !(close > indicators.ema20))  return null
          if (body.aboveEMA20  === false && !(close < indicators.ema20))  return null
          if (body.aboveEMA50  === true  && !(close > indicators.ema50))  return null
          if (body.aboveEMA50  === false && !(close < indicators.ema50))  return null
          if (body.aboveEMA200 === true  && !(close > indicators.ema200)) return null
          if (body.aboveEMA200 === false && !(close < indicators.ema200)) return null

          // Golden / Death cross
          if (body.goldenCross && !(indicators.ema50 > indicators.ema200)) return null
          if (body.deathCross  && !(indicators.ema50 < indicators.ema200)) return null

          // ── VWAP / BB ──
          if (body.aboveVWAP && !indicators.aboveVWAP) return null
          if (body.bbSqueeze && !indicators.bbSqueeze) return null
          if (body.bbBreakout && !(close > indicators.bbUpper)) return null

          // ── Volume spike ──
          if (body.volumeSpike) {
            const avgVol = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20
            if (last.volume < avgVol * 2) return null
          }

          // ── ADX ──
          if (body.adxMin !== undefined && (indicators.adx ?? 0) < body.adxMin) return null

          // ── Stochastic ──
          if (body.stochOversold  && (indicators.stochK ?? 50) >= 20) return null
          if (body.stochOverbought && (indicators.stochK ?? 50) <= 80) return null

          // ── 52-week levels ──
          const high52 = Math.max(...candles.slice(-252).map(c => c.high))
          const low52  = Math.min(...candles.slice(-252).map(c => c.low))
          if (body.near52wHigh && close < high52 * 0.95) return null
          if (body.near52wLow  && close > low52  * 1.05) return null

          // ── Patterns ──
          let patterns: any[] = []
          if (body.patterns?.length) {
            patterns = await detectPatterns(candles, 3)
            const patternNames = patterns.map(p => p.name.toLowerCase())
            if (!body.patterns.every(p => patternNames.includes(p.toLowerCase()))) return null
          } else {
            patterns = await detectPatterns(candles, 2)
          }

          // ── Volume stats ──
          const avgVol20 = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20
          const volRatio = avgVol20 > 0 ? last.volume / avgVol20 : 1

          return {
            symbol:    sym,
            ltp:       close,
            change,
            changePct,
            volume:    last.volume,
            volRatio,
            high52w:   high52,
            low52w:    low52,
            pct52wH:   ((close - high52) / high52) * 100,
            pct52wL:   ((close - low52)  / low52)  * 100,
            rsi:       indicators.rsi,
            macd:      indicators.macd,
            macdHist:  indicators.macdHist,
            ema20:     indicators.ema20,
            ema50:     indicators.ema50,
            ema200:    indicators.ema200,
            adx:       indicators.adx,
            stochK:    indicators.stochK,
            stochD:    indicators.stochD,
            atr:       indicators.atr,
            bbUpper:   indicators.bbUpper,
            bbLower:   indicators.bbLower,
            vwap:      indicators.vwap,
            patterns:  patterns.map(p => ({ name: p.name, label: p.label, type: p.type })),
            signals: {
              macdBullish:    indicators.macdBullish,
              macdBearish:    indicators.macdBearish,
              rsiOversold:    indicators.rsiOversold,
              rsiOverbought:  indicators.rsiOverbought,
              trendUp:        indicators.trendUp,
              aboveVWAP:      indicators.aboveVWAP,
              bbSqueeze:      indicators.bbSqueeze,
              goldenCross:    (indicators.ema50 ?? 0) > (indicators.ema200 ?? 0),
              nearHighs:      close >= high52 * 0.95,
              nearLows:       close <= low52  * 1.05,
              volumeSpike:    volRatio >= 2,
              strongTrend:    (indicators.adx ?? 0) > 25,
            },
          }
        })
      )
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }
    }

    return NextResponse.json({ data: results, total: symbols.length })
  } catch (err: any) {
    console.error('[Screener] scan error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
