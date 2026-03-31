import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface Trade {
  id: number
  symbol: string
  transactionType: 'BUY' | 'SELL'
  quantity: number
  price: number
  executedAt: string
}

interface FIFOMatch {
  symbol: string
  buyDate: string
  sellDate: string
  quantity: number
  buyPrice: number
  sellPrice: number
  holdingDays: number
  grossGain: number
  netGain: number
  classification: 'STCG' | 'LTCG'
  stt: number
  charges: number
}

function getFYRange(fy: string): { start: Date; end: Date } {
  // FY 2024-25 → start: 2024-04-01, end: 2025-03-31
  const [startYearStr] = fy.replace('FY ', '').split('-')
  const startYear = parseInt(startYearStr)
  return {
    start: new Date(`${startYear}-04-01`),
    end:   new Date(`${startYear + 1}-03-31T23:59:59`),
  }
}

export async function GET(req: NextRequest) {
  try {
    const fy = req.nextUrl.searchParams.get('fy') ?? 'FY 2024-25'
    const { start, end } = getFYRange(fy)

    const db = getDb()
    const trades = db.prepare(
      `SELECT id, symbol, transaction_type as transactionType,
              quantity, price, executed_at as executedAt
       FROM paper_trades
       WHERE executed_at >= ? AND executed_at <= ?
       ORDER BY symbol, executed_at ASC`
    ).all(start.toISOString(), end.toISOString()) as Trade[]

    // Group by symbol
    const bySymbol: Record<string, Trade[]> = {}
    for (const t of trades) {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
      bySymbol[t.symbol].push(t)
    }

    const stcgTrades: FIFOMatch[] = []
    const ltcgTrades: FIFOMatch[] = []

    for (const [symbol, symTrades] of Object.entries(bySymbol)) {
      // FIFO queue of buy lots
      const buyQueue: { quantity: number; price: number; date: string }[] = []

      for (const trade of symTrades) {
        if (trade.transactionType === 'BUY') {
          buyQueue.push({ quantity: trade.quantity, price: trade.price, date: trade.executedAt })
        } else if (trade.transactionType === 'SELL') {
          let remaining = trade.quantity

          while (remaining > 0 && buyQueue.length > 0) {
            const lot = buyQueue[0]
            const matchQty = Math.min(remaining, lot.quantity)

            const buyDate = new Date(lot.date)
            const sellDate = new Date(trade.executedAt)
            const holdingDays = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24))

            const grossGain = (trade.price - lot.price) * matchQty
            // STT on sell: 0.1% for delivery (CNC)
            const stt = trade.price * matchQty * 0.001
            // Exchange charges ~0.00345% + GST + stamp
            const charges = trade.price * matchQty * 0.0001
            const netGain = grossGain - stt - charges

            const classification: 'STCG' | 'LTCG' = holdingDays < 365 ? 'STCG' : 'LTCG'

            const matched: FIFOMatch = {
              symbol,
              buyDate:  buyDate.toISOString().split('T')[0],
              sellDate: sellDate.toISOString().split('T')[0],
              quantity: matchQty,
              buyPrice: parseFloat(lot.price.toFixed(2)),
              sellPrice: parseFloat(trade.price.toFixed(2)),
              holdingDays,
              grossGain: parseFloat(grossGain.toFixed(2)),
              netGain:   parseFloat(netGain.toFixed(2)),
              classification,
              stt:       parseFloat(stt.toFixed(2)),
              charges:   parseFloat(charges.toFixed(2)),
            }

            if (classification === 'STCG') stcgTrades.push(matched)
            else ltcgTrades.push(matched)

            lot.quantity -= matchQty
            remaining    -= matchQty
            if (lot.quantity === 0) buyQueue.shift()
          }
        }
      }
    }

    const totalSTCG = stcgTrades.reduce((s, t) => s + t.netGain, 0)
    const totalLTCG = ltcgTrades.reduce((s, t) => s + t.netGain, 0)

    // Indian tax: STCG = 20%, LTCG = 12.5% above ₹1.25L exemption
    const stcgTax = totalSTCG > 0 ? totalSTCG * 0.20 : 0
    const ltcgExemption = 125000
    const taxableLTCG = Math.max(0, totalLTCG - ltcgExemption)
    const ltcgTax = taxableLTCG * 0.125
    const estimatedTax = parseFloat((stcgTax + ltcgTax).toFixed(2))

    return NextResponse.json({
      stcgTrades,
      ltcgTrades,
      totalSTCG: parseFloat(totalSTCG.toFixed(2)),
      totalLTCG: parseFloat(totalLTCG.toFixed(2)),
      estimatedTax,
      stcgTax: parseFloat(stcgTax.toFixed(2)),
      ltcgTax: parseFloat(ltcgTax.toFixed(2)),
      taxYear: fy,
      ltcgExemptionUsed: Math.min(totalLTCG > 0 ? ltcgExemption : 0, totalLTCG),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
