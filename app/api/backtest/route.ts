import { NextResponse } from 'next/server'

// ── Yahoo Finance historical data ─────────────────────────────────────────────

async function fetchHistory(symbol: string, range: string): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const ticker = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? symbol : `${symbol}.NS`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`
  const res  = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`YF error ${res.status} for ${symbol}`)
  const json  = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error('No data')

  const { timestamp, indicators } = result
  const quote = indicators?.quote?.[0]
  if (!timestamp || !quote) throw new Error('Empty response')

  const bars = []
  for (let i = 0; i < timestamp.length; i++) {
    const close  = quote.close[i]
    const open   = quote.open[i]
    const high   = quote.high[i]
    const low    = quote.low[i]
    const volume = quote.volume[i]
    if (close == null || open == null) continue
    bars.push({
      date:   new Date(timestamp[i] * 1000).toISOString().slice(0, 10),
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume: volume ?? 0,
    })
  }
  return bars
}

// ── Indicator math ─────────────────────────────────────────────────────────────

function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = new Array(prices.length).fill(NaN)
  let prev = NaN
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) continue
    if (isNaN(prev)) {
      prev = prices.slice(0, period).reduce((s, v) => s + v, 0) / period
      out[period - 1] = prev
      continue
    }
    prev = prices[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function sma(prices: number[], period: number): number[] {
  return prices.map((_, i) => {
    if (i < period - 1) return NaN
    return prices.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period
  })
}

function rsi(prices: number[], period = 14): number[] {
  const out: number[] = new Array(prices.length).fill(NaN)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1]
    if (d >= 0) avgGain += d; else avgLoss -= d
  }
  avgGain /= period; avgLoss /= period
  out[period] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10))
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1]
    const gain = d > 0 ? d : 0
    const loss = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10))
  }
  return out
}

function macd(prices: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast   = ema(prices, fast)
  const emaSlow   = ema(prices, slow)
  const macdLine  = prices.map((_, i) => isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i])
  const validMacd = macdLine.filter(v => !isNaN(v))
  const sigLine   = ema(validMacd, signal)
  let si = 0
  const signalOut: number[] = new Array(prices.length).fill(NaN)
  for (let i = 0; i < prices.length; i++) {
    if (!isNaN(macdLine[i])) { signalOut[i] = sigLine[si] ?? NaN; si++ }
  }
  return { macd: macdLine, signal: signalOut }
}

function bollingerBands(prices: number[], period = 20, std = 2) {
  const mid = sma(prices, period)
  return prices.map((_, i) => {
    if (isNaN(mid[i])) return { upper: NaN, mid: NaN, lower: NaN }
    const slice = prices.slice(i - period + 1, i + 1)
    const mean  = mid[i]
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const stdDev = Math.sqrt(variance) * std
    return { upper: +(mid[i] + stdDev).toFixed(2), mid: +mid[i].toFixed(2), lower: +(mid[i] - stdDev).toFixed(2) }
  })
}

// ── Strategy signals ──────────────────────────────────────────────────────────

type SignalBar = { date: string; signal: 'BUY' | 'SELL' | null; close: number; reason: string }

function runEMACrossover(bars: { date: string; close: number }[], fast: number, slow: number): SignalBar[] {
  const closes  = bars.map(b => b.close)
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const out: SignalBar[] = []
  for (let i = 1; i < bars.length; i++) {
    let signal: 'BUY' | 'SELL' | null = null
    let reason = ''
    const crossedAbove = emaFast[i - 1] <= emaSlow[i - 1] && emaFast[i] > emaSlow[i]
    const crossedBelow = emaFast[i - 1] >= emaSlow[i - 1] && emaFast[i] < emaSlow[i]
    if (crossedAbove) { signal = 'BUY';  reason = `EMA${fast} crossed above EMA${slow}` }
    if (crossedBelow) { signal = 'SELL'; reason = `EMA${fast} crossed below EMA${slow}` }
    out.push({ date: bars[i].date, signal, close: bars[i].close, reason })
  }
  return out
}

function runRSIStrategy(bars: { date: string; close: number }[], oversold: number, overbought: number): SignalBar[] {
  const closes = bars.map(b => b.close)
  const rsiVals = rsi(closes)
  const out: SignalBar[] = []
  for (let i = 1; i < bars.length; i++) {
    let signal: 'BUY' | 'SELL' | null = null
    let reason = ''
    if (!isNaN(rsiVals[i - 1]) && !isNaN(rsiVals[i])) {
      if (rsiVals[i - 1] < oversold && rsiVals[i] >= oversold) { signal = 'BUY';  reason = `RSI crossed above ${oversold} (oversold recovery)` }
      if (rsiVals[i - 1] > overbought && rsiVals[i] <= overbought) { signal = 'SELL'; reason = `RSI crossed below ${overbought} (overbought exit)` }
    }
    out.push({ date: bars[i].date, signal, close: bars[i].close, reason })
  }
  return out
}

function runMACDStrategy(bars: { date: string; close: number }[]): SignalBar[] {
  const closes = bars.map(b => b.close)
  const { macd: macdLine, signal: sigLine } = macd(closes)
  const out: SignalBar[] = []
  for (let i = 1; i < bars.length; i++) {
    let signal: 'BUY' | 'SELL' | null = null
    let reason = ''
    if (!isNaN(macdLine[i - 1]) && !isNaN(sigLine[i - 1]) && !isNaN(macdLine[i]) && !isNaN(sigLine[i])) {
      if (macdLine[i - 1] < sigLine[i - 1] && macdLine[i] > sigLine[i]) { signal = 'BUY';  reason = 'MACD crossed above signal' }
      if (macdLine[i - 1] > sigLine[i - 1] && macdLine[i] < sigLine[i]) { signal = 'SELL'; reason = 'MACD crossed below signal' }
    }
    out.push({ date: bars[i].date, signal, close: bars[i].close, reason })
  }
  return out
}

function runBBStrategy(bars: { date: string; close: number }[]): SignalBar[] {
  const closes = bars.map(b => b.close)
  const bands  = bollingerBands(closes)
  const out: SignalBar[] = []
  for (let i = 1; i < bars.length; i++) {
    let signal: 'BUY' | 'SELL' | null = null
    let reason = ''
    const prev = bands[i - 1]; const curr = bands[i]
    if (!isNaN(prev.lower) && !isNaN(curr.lower)) {
      if (closes[i - 1] < prev.lower && closes[i] >= curr.lower) { signal = 'BUY';  reason = 'Price bounced above lower Bollinger Band' }
      if (closes[i - 1] > prev.upper && closes[i] <= curr.upper) { signal = 'SELL'; reason = 'Price rejected at upper Bollinger Band' }
    }
    out.push({ date: bars[i].date, signal, close: bars[i].close, reason })
  }
  return out
}

// ── Trade simulation ─────────────────────────────────────────────────────────

interface Trade {
  entry: string; exit: string; entryPrice: number; exitPrice: number
  pnl: number; pnlPct: number; holding: number; signal: string
}

function simulateTrades(signals: SignalBar[], initialCapital: number, brokerage: number): {
  trades: Trade[]; equity: { date: string; value: number }[]
} {
  const trades: Trade[] = []
  const equity: { date: string; value: number }[] = []
  let capital  = initialCapital
  let position: { entryDate: string; entryPrice: number; qty: number; reason: string } | null = null

  for (const bar of signals) {
    if (bar.signal === 'BUY' && !position) {
      const qty = Math.floor(capital / bar.close)
      if (qty > 0) {
        position = { entryDate: bar.date, entryPrice: bar.close, qty, reason: bar.reason }
      }
    } else if (bar.signal === 'SELL' && position) {
      const exitPrice = bar.close
      const gross     = (exitPrice - position.entryPrice) * position.qty
      const cost      = (position.entryPrice * position.qty + exitPrice * position.qty) * brokerage / 100
      const net       = gross - cost
      capital += net
      const days = Math.round((new Date(bar.date).getTime() - new Date(position.entryDate).getTime()) / 86400000)
      trades.push({
        entry:      position.entryDate,
        exit:       bar.date,
        entryPrice: position.entryPrice,
        exitPrice,
        pnl:        +net.toFixed(2),
        pnlPct:     +((net / (position.entryPrice * position.qty)) * 100).toFixed(2),
        holding:    days,
        signal:     position.reason,
      })
      position = null
    }
    // Track equity curve
    const currentValue = position
      ? capital + (bar.close - position.entryPrice) * position.qty
      : capital
    equity.push({ date: bar.date, value: +currentValue.toFixed(2) })
  }

  return { trades, equity }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      symbol          = 'NIFTY50',
      strategy        = 'ema_cross',
      range           = '2y',
      initialCapital  = 100000,
      brokerage       = 0.02,
      // EMA params
      emaFast         = 20,
      emaSlow         = 50,
      // RSI params
      rsiOversold     = 30,
      rsiOverbought   = 70,
    } = body

    const bars   = await fetchHistory(symbol, range)
    if (!bars.length) return NextResponse.json({ error: 'No historical data found' }, { status: 400 })

    let signals: SignalBar[]
    switch (strategy) {
      case 'ema_cross': signals = runEMACrossover(bars, emaFast, emaSlow); break
      case 'rsi':       signals = runRSIStrategy(bars, rsiOversold, rsiOverbought); break
      case 'macd':      signals = runMACDStrategy(bars); break
      case 'bb':        signals = runBBStrategy(bars); break
      default: return NextResponse.json({ error: `Unknown strategy: ${strategy}` }, { status: 400 })
    }

    const { trades, equity } = simulateTrades(signals, initialCapital, brokerage)

    // ── Performance metrics ─────────────────────────────────────────────────
    const finalCapital    = equity[equity.length - 1]?.value ?? initialCapital
    const totalReturn     = ((finalCapital - initialCapital) / initialCapital) * 100
    const winners         = trades.filter(t => t.pnl > 0)
    const losers          = trades.filter(t => t.pnl < 0)
    const winRate         = trades.length > 0 ? (winners.length / trades.length) * 100 : 0
    const avgWin          = winners.length > 0 ? winners.reduce((s, t) => s + t.pnlPct, 0) / winners.length : 0
    const avgLoss         = losers.length > 0 ? losers.reduce((s, t) => s + t.pnlPct, 0) / losers.length : 0
    const profitFactor    = losers.length > 0
      ? Math.abs(winners.reduce((s, t) => s + t.pnl, 0) / losers.reduce((s, t) => s + t.pnl, 0))
      : Infinity

    // Max drawdown
    let peak = initialCapital, maxDD = 0
    for (const e of equity) {
      if (e.value > peak) peak = e.value
      const dd = (peak - e.value) / peak * 100
      if (dd > maxDD) maxDD = dd
    }

    // Buy & hold return
    const buyHoldReturn = bars.length >= 2
      ? ((bars[bars.length - 1].close - bars[0].close) / bars[0].close) * 100
      : 0

    return NextResponse.json({
      symbol, strategy, range,
      bars: bars.length, from: bars[0]?.date, to: bars[bars.length - 1]?.date,
      initialCapital, finalCapital: +finalCapital.toFixed(2),
      metrics: {
        totalReturn:   +totalReturn.toFixed(2),
        buyHoldReturn: +buyHoldReturn.toFixed(2),
        alpha:         +(totalReturn - buyHoldReturn).toFixed(2),
        trades:        trades.length,
        winRate:       +winRate.toFixed(1),
        avgWin:        +avgWin.toFixed(2),
        avgLoss:       +avgLoss.toFixed(2),
        profitFactor:  +Math.min(profitFactor, 99).toFixed(2),
        maxDrawdown:   +maxDD.toFixed(2),
      },
      trades,
      equity,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
