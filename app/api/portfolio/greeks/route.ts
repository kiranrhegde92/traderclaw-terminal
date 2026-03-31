import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { blackScholes, daysToExpiry } from '@/lib/options/blackscholes'

/** Parse option symbol like NIFTY2541523000CE → { underlying, strike, expiry, type } */
function parseOptionSymbol(symbol: string): { underlying: string; strike: number; expiry: string; type: 'CE' | 'PE' } | null {
  // Formats: NIFTY25APR23000CE, BANKNIFTY2541523000PE, SYMBOL25APR12345CE
  const m = symbol.match(/^([A-Z]+?)(\d{2})([A-Z]{3}|\d{2})(\d{2})(\d+)(CE|PE)$/i)
  if (!m) return null
  const [, underlying, yy, monthOrMon, dd, strikeStr, optType] = m
  const strike = parseFloat(strikeStr)

  const MONTHS: Record<string, number> = {
    JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12
  }
  let month: number
  let day: number
  if (isNaN(Number(monthOrMon))) {
    // APR style
    month = MONTHS[monthOrMon.toUpperCase()] ?? 1
    day = parseInt(dd)
  } else {
    // numeric month
    month = parseInt(monthOrMon)
    day = parseInt(dd)
  }

  const year = 2000 + parseInt(yy)
  const expiry = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  return { underlying, strike, expiry, type: optType.toUpperCase() as 'CE' | 'PE' }
}

export async function GET() {
  try {
    const db = getDb()
    const positions = db.prepare(
      `SELECT id, symbol, quantity, average_price, current_price, option_type, strike_price, expiry_date
       FROM paper_positions
       WHERE account_id = 1 AND quantity != 0
         AND (UPPER(symbol) LIKE '%CE' OR UPPER(symbol) LIKE '%PE' OR option_type IS NOT NULL)`
    ).all() as any[]

    if (positions.length === 0) {
      return NextResponse.json({
        netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0, positions: [],
      })
    }

    const result = []
    let netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0

    for (const pos of positions) {
      const parsed = parseOptionSymbol(pos.symbol)
      const optType: 'CE' | 'PE' = (pos.option_type?.toUpperCase() ?? parsed?.type ?? 'CE') as 'CE' | 'PE'
      const strike = pos.strike_price ?? parsed?.strike ?? 0
      const expiry = pos.expiry_date ?? parsed?.expiry ?? ''
      const underlying = parsed?.underlying ?? pos.symbol.replace(/(CE|PE)\d*$/i, '')

      // Fetch current prices
      const [spotPrice, ltpPrice] = await Promise.all([
        getLTP(underlying).catch(() => null),
        getLTP(pos.symbol).catch(() => null),
      ])
      const spot = spotPrice ?? pos.current_price ?? pos.average_price
      const ltp  = ltpPrice ?? pos.current_price ?? pos.average_price

      const T = expiry ? daysToExpiry(expiry) : 30 / 365
      const iv = 0.20 // default 20% IV if can't compute

      const bs = blackScholes({
        spotPrice: spot,
        strikePrice: strike || spot,
        timeToExpiry: T,
        riskFreeRate: 0.065,
        volatility: iv,
        optionType: optType,
      })

      const qty = pos.quantity
      netDelta += bs.delta * qty
      netGamma += bs.gamma * qty
      netTheta += bs.theta * qty
      netVega  += bs.vega  * qty

      result.push({
        symbol:      pos.symbol,
        quantity:    qty,
        avgPrice:    pos.average_price,
        ltp,
        underlying,
        strike,
        expiry,
        optionType:  optType,
        delta:       parseFloat((bs.delta * qty).toFixed(4)),
        gamma:       parseFloat((bs.gamma * qty).toFixed(6)),
        theta:       parseFloat((bs.theta * qty).toFixed(4)),
        vega:        parseFloat((bs.vega  * qty).toFixed(4)),
        price:       bs.price,
      })
    }

    return NextResponse.json({
      netDelta:  parseFloat(netDelta.toFixed(4)),
      netGamma:  parseFloat(netGamma.toFixed(6)),
      netTheta:  parseFloat(netTheta.toFixed(4)),
      netVega:   parseFloat(netVega.toFixed(4)),
      positions: result,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
