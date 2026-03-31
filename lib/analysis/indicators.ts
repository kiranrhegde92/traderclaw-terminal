/**
 * Technical indicator wrappers using the 'technicalindicators' library
 */
import type { OHLCV } from '@/types/market'

function closes(candles: OHLCV[]) { return candles.map(c => c.close) }
function highs(candles: OHLCV[])  { return candles.map(c => c.high)  }
function lows(candles: OHLCV[])   { return candles.map(c => c.low)   }
function volumes(candles: OHLCV[]){ return candles.map(c => c.volume) }

/** RSI (14-period by default) – returns array of same length as input (leading NaN) */
export async function computeRSI(candles: OHLCV[], period = 14): Promise<number[]> {
  const { RSI } = await import('technicalindicators')
  const values = RSI.calculate({ values: closes(candles), period })
  const padding = Array(candles.length - values.length).fill(NaN)
  return [...padding, ...values]
}

/** MACD */
export async function computeMACD(candles: OHLCV[], fast = 12, slow = 26, signal = 9) {
  const { MACD } = await import('technicalindicators')
  const values = MACD.calculate({
    values: closes(candles),
    fastPeriod: fast, slowPeriod: slow, signalPeriod: signal,
    SimpleMAOscillator: false, SimpleMASignal: false,
  })
  const padding = Array(candles.length - values.length).fill({ MACD: NaN, signal: NaN, histogram: NaN })
  return [...padding, ...values]
}

/** Bollinger Bands */
export async function computeBB(candles: OHLCV[], period = 20, stdDev = 2) {
  const { BollingerBands } = await import('technicalindicators')
  const values = BollingerBands.calculate({ values: closes(candles), period, stdDev })
  const padding = Array(candles.length - values.length).fill({ upper: NaN, middle: NaN, lower: NaN, pb: NaN })
  return [...padding, ...values]
}

/** EMA */
export async function computeEMA(candles: OHLCV[], period = 20): Promise<number[]> {
  const { EMA } = await import('technicalindicators')
  const values = EMA.calculate({ values: closes(candles), period })
  const padding = Array(candles.length - values.length).fill(NaN)
  return [...padding, ...values]
}

/** SMA */
export async function computeSMA(candles: OHLCV[], period = 20): Promise<number[]> {
  const { SMA } = await import('technicalindicators')
  const values = SMA.calculate({ values: closes(candles), period })
  const padding = Array(candles.length - values.length).fill(NaN)
  return [...padding, ...values]
}

/** ADX (trend strength) */
export async function computeADX(candles: OHLCV[], period = 14) {
  const { ADX } = await import('technicalindicators')
  const values = ADX.calculate({
    high: highs(candles), low: lows(candles), close: closes(candles), period
  })
  const padding = Array(candles.length - values.length).fill({ adx: NaN, mdi: NaN, pdi: NaN })
  return [...padding, ...values]
}

/** ATR */
export async function computeATR(candles: OHLCV[], period = 14): Promise<number[]> {
  const { ATR } = await import('technicalindicators')
  const values = ATR.calculate({ high: highs(candles), low: lows(candles), close: closes(candles), period })
  const padding = Array(candles.length - values.length).fill(NaN)
  return [...padding, ...values]
}

/** Stochastic */
export async function computeStoch(candles: OHLCV[], period = 14, signalPeriod = 3) {
  const { Stochastic } = await import('technicalindicators')
  const values = Stochastic.calculate({
    high: highs(candles), low: lows(candles), close: closes(candles),
    period, signalPeriod
  })
  const padding = Array(candles.length - values.length).fill({ k: NaN, d: NaN })
  return [...padding, ...values]
}

/** VWAP (session-based, resets per candle array) */
export function computeVWAP(candles: OHLCV[]): number[] {
  let cumVol = 0, cumTypVol = 0
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3
    cumVol    += c.volume
    cumTypVol += typical * c.volume
    return cumVol === 0 ? c.close : cumTypVol / cumVol
  })
}

/** Support & Resistance via simple pivot points */
export function computePivots(candles: OHLCV[]): {
  pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number
} {
  if (candles.length === 0) return { pp:0,r1:0,r2:0,r3:0,s1:0,s2:0,s3:0 }
  const prev = candles[candles.length - 1]
  const pp = (prev.high + prev.low + prev.close) / 3
  return {
    pp,
    r1: 2*pp - prev.low,
    r2: pp + (prev.high - prev.low),
    r3: prev.high + 2*(pp - prev.low),
    s1: 2*pp - prev.high,
    s2: pp - (prev.high - prev.low),
    s3: prev.low - 2*(prev.high - pp),
  }
}

/** Quick indicator summary for screener (returns last values only) */
export async function getIndicatorSummary(candles: OHLCV[]) {
  if (candles.length < 26) return null

  const [rsiArr, macdArr, bbArr, ema20Arr, ema50Arr, ema200Arr, adxArr, stochArr, atrArr] = await Promise.all([
    computeRSI(candles),
    computeMACD(candles),
    computeBB(candles),
    computeEMA(candles, 20),
    computeEMA(candles, 50),
    candles.length >= 200 ? computeEMA(candles, 200) : Promise.resolve(Array(candles.length).fill(NaN)),
    computeADX(candles),
    computeStoch(candles),
    computeATR(candles),
  ])

  const last   = candles.length - 1
  const rsi    = rsiArr[last]
  const macd   = macdArr[last]
  const bb     = bbArr[last]
  const ema20  = ema20Arr[last]
  const ema50  = ema50Arr[last]
  const ema200 = ema200Arr[last]
  const adx    = adxArr[last]
  const stoch  = stochArr[last]
  const atr    = atrArr[last]
  const close  = candles[last].close
  const vwap   = computeVWAP(candles)[last]

  return {
    rsi,
    macd:        macd?.MACD,
    macdSignal:  macd?.signal,
    macdHist:    macd?.histogram,
    bbUpper:     bb?.upper,
    bbMiddle:    bb?.middle,
    bbLower:     bb?.lower,
    bbSqueeze:   bb ? (bb.upper - bb.lower) / bb.middle < 0.05 : false,
    ema20,
    ema50,
    ema200,
    adx:         adx?.adx,
    stochK:      stoch?.k,
    stochD:      stoch?.d,
    atr,
    trendUp:     ema20 > ema50,
    aboveVWAP:   close > vwap,
    vwap,
    rsiOversold:   rsi < 30,
    rsiOverbought: rsi > 70,
    macdBullish:   macd?.histogram > 0 && macd?.MACD > macd?.signal,
    macdBearish:   macd?.histogram < 0 && macd?.MACD < macd?.signal,
  }
}
