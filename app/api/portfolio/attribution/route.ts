import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getLTP } from '@/lib/data/yfinance-proxy'

const SECTOR_MAP: Record<string, string> = {
  TCS:'IT', INFY:'IT', WIPRO:'IT', HCLTECH:'IT', TECHM:'IT', LTIM:'IT', MPHASIS:'IT', COFORGE:'IT', PERSISTENT:'IT', LTTS:'IT',
  HDFCBANK:'Banking', ICICIBANK:'Banking', KOTAKBANK:'Banking', SBIN:'Banking', AXISBANK:'Banking', BANDHANBNK:'Banking', IDFCFIRSTB:'Banking', FEDERALBNK:'Banking', INDUSINDBK:'Banking', AUBANK:'Banking',
  BAJFINANCE:'Finance', BAJAJFINSV:'Finance', CHOLAFIN:'Finance', MUTHOOTFIN:'Finance', SBICARD:'Finance', PFC:'Finance', RECLTD:'Finance', HDFCAMC:'Finance', ICICIGI:'Finance', HDFCLIFE:'Finance',
  SUNPHARMA:'Pharma', DRREDDY:'Pharma', CIPLA:'Pharma', DIVISLAB:'Pharma', APOLLOHOSP:'Pharma', TORNTPHARM:'Pharma', LUPIN:'Pharma', BIOCON:'Pharma', AUROPHARMA:'Pharma', ALKEM:'Pharma',
  MARUTI:'Auto', TATAMOTORS:'Auto', M_M:'Auto', HEROMOTOCO:'Auto', BAJAJ_AUTO:'Auto', EICHERMOT:'Auto', ASHOKLEY:'Auto', TVSMOTOR:'Auto', BHARATFORG:'Auto', MOTHERSON:'Auto',
  RELIANCE:'Energy', ONGC:'Energy', NTPC:'Energy', POWERGRID:'Energy', BPCL:'Energy', IOC:'Energy', GAIL:'Energy', TATAPOWER:'Energy', ADANIGREEN:'Energy', ADANIPOWER:'Energy',
  TATASTEEL:'Metals', JSWSTEEL:'Metals', HINDALCO:'Metals', VEDL:'Metals', COALINDIA:'Metals', NMDC:'Metals', SAIL:'Metals', JINDALSTEL:'Metals',
  HINDUNILVR:'FMCG', ITC:'FMCG', NESTLEIND:'FMCG', BRITANNIA:'FMCG', DABUR:'FMCG', GODREJCP:'FMCG', MARICO:'FMCG', COLPAL:'FMCG', EMAMILTD:'FMCG', VBL:'FMCG',
  ULTRACEMCO:'Cement', GRASIM:'Cement', AMBUJACEM:'Cement', ACC:'Cement', SHREECEM:'Cement',
  LT:'Infra', ADANIENT:'Infra', DLF:'Realty', GODREJPROP:'Realty', OBEROIRLTY:'Realty', PRESTIGE:'Realty',
  BHARTIARTL:'Telecom', IDEA:'Telecom',
  TITAN:'Consumer', TRENT:'Consumer', DMART:'Consumer', NYKAA:'Consumer', ZOMATO:'Consumer', JUBLFOOD:'Consumer',
  PIDILITIND:'Chemicals', ASIANPAINT:'Chemicals', BERGERPAINTS:'Chemicals', NAVINFLUOR:'Chemicals', DEEPAKNTR:'Chemicals',
}

function getSector(sym: string): string {
  const clean = sym.replace(/-EQ$/i, '').replace(/[&]/g, '_').toUpperCase()
  return SECTOR_MAP[clean] ?? 'Others'
}

export async function GET() {
  try {
    const db = getDb()
    const positions = db.prepare(
      `SELECT symbol, quantity, average_price, current_price, option_type, segment
       FROM paper_positions WHERE account_id = 1 AND quantity != 0`
    ).all() as any[]

    if (positions.length === 0) {
      return NextResponse.json({
        totalPnl: 0, byStock: [], bySector: [],
        byDirection: { long: 0, short: 0 },
      })
    }

    // Fetch current prices for equity positions
    const pricePromises = positions.map(async (pos) => {
      const ltp = await getLTP(pos.symbol).catch(() => null)
      return { symbol: pos.symbol, ltp }
    })
    const prices = await Promise.all(pricePromises)
    const priceMap: Record<string, number> = {}
    for (const p of prices) {
      if (p.ltp !== null) priceMap[p.symbol] = p.ltp
    }

    const byStock: any[] = []
    const bySector: Record<string, number> = {}
    let longPnl = 0
    let shortPnl = 0

    for (const pos of positions) {
      const currentPrice = priceMap[pos.symbol] ?? pos.current_price ?? pos.average_price
      const pnl = (currentPrice - pos.average_price) * pos.quantity
      const isLong = pos.quantity > 0
      const sector = getSector(pos.symbol)

      byStock.push({
        symbol: pos.symbol,
        quantity: pos.quantity,
        avgPrice: pos.average_price,
        currentPrice,
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPct: parseFloat(((currentPrice - pos.average_price) / pos.average_price * 100).toFixed(2)),
        sector,
        direction: isLong ? 'LONG' : 'SHORT',
      })

      bySector[sector] = (bySector[sector] ?? 0) + pnl
      if (isLong) longPnl += pnl
      else shortPnl += pnl
    }

    byStock.sort((a, b) => b.pnl - a.pnl)

    const bySectorArr = Object.entries(bySector).map(([sector, pnl]) => ({
      sector,
      pnl: parseFloat((pnl as number).toFixed(2)),
    })).sort((a, b) => b.pnl - a.pnl)

    const totalPnl = byStock.reduce((s, x) => s + x.pnl, 0)

    return NextResponse.json({
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      byStock,
      bySector: bySectorArr,
      byDirection: {
        long: parseFloat(longPnl.toFixed(2)),
        short: parseFloat(shortPnl.toFixed(2)),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
