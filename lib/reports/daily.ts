import { getDb } from '@/lib/db'
import { getAccount, getPositions } from '@/lib/db/queries/paper-trades'
import { createOrUpdateReport, type DailyReport } from '@/lib/db/queries/reports'
import { getLTP } from '@/lib/data/yfinance-proxy'

export interface TradeStats {
  symbol: string
  qty:    number
  pnl:    number
  return: number
}

const safe = (n: number) => (isFinite(n) && !isNaN(n) ? n : 0)

// ── Fetch today's broker trades ────────────────────────────────────────────────
async function fetchBrokerTrades(): Promise<{ symbol: string; txnType: string; qty: number; price: number }[]> {
  const db  = getDb()
  const rows = db.prepare(`SELECT key, value FROM app_config WHERE key IN (
    'session_jwt','session_apikey','session_broker',
    'zerodha_access_token','zerodha_api_key'
  )`).all() as { key: string; value: string }[]
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const broker = cfg.session_broker ?? null

  try {
    if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
      const { commonHeaders } = await import('@/lib/angelone/client')
      const res  = await fetch(
        'https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/getTradeBook',
        { headers: commonHeaders(cfg.session_apikey, cfg.session_jwt), signal: AbortSignal.timeout(8000) }
      )
      const json = await res.json()
      return (json?.data ?? []).map((t: any) => ({
        symbol:  t.tradingsymbol,
        txnType: t.transactiontype,
        qty:     Number(t.fillshares ?? t.quantity ?? 0),
        price:   Number(t.fillprice ?? t.averageprice ?? 0),
      }))
    }

    if (broker === 'zerodha' && cfg.zerodha_access_token && cfg.zerodha_api_key) {
      const res = await fetch('https://api.kite.trade/trades', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization':  `token ${cfg.zerodha_api_key}:${cfg.zerodha_access_token}`,
        },
        signal: AbortSignal.timeout(8000),
      })
      const json = await res.json()
      return (json?.data ?? []).map((t: any) => ({
        symbol:  t.tradingsymbol,
        txnType: t.transaction_type,
        qty:     Number(t.quantity ?? 0),
        price:   Number(t.average_price ?? t.price ?? 0),
      }))
    }
  } catch { /* fall through to paper */ }

  return []
}

// ── Fetch broker holdings for unrealized P&L ──────────────────────────────────
async function fetchBrokerHoldings(): Promise<{ totalPnl: number; totalInvested: number } | null> {
  try {
    const { isOpenAlgoUp, getHoldings: getOAHoldings, getPositions: getOAPositions } = await import('@/lib/openalgo/client')
    const oaUp = await isOpenAlgoUp().catch(() => false)
    if (oaUp) {
      const [h, p] = await Promise.all([getOAHoldings().catch(() => null), getOAPositions().catch(() => [])])
      if (Array.isArray(h) && h.length > 0) {
        return calcHoldingsPnl(h, p ?? [])
      }
    }
  } catch { /* try next */ }

  const db  = getDb()
  const rows = db.prepare(`SELECT key, value FROM app_config WHERE key IN (
    'session_jwt','session_apikey','session_broker',
    'zerodha_access_token','zerodha_api_key'
  )`).all() as { key: string; value: string }[]
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const broker = cfg.session_broker ?? null

  try {
    if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
      const { getHoldings, getPositions } = await import('@/lib/angelone/client')
      const [h, p] = await Promise.all([
        getHoldings(cfg.session_jwt, cfg.session_apikey).catch(() => null),
        getPositions(cfg.session_jwt, cfg.session_apikey).catch(() => []),
      ])
      if (Array.isArray(h) && h.length > 0) return calcHoldingsPnl(h, p ?? [])
    }

    if (broker === 'zerodha' && cfg.zerodha_access_token && cfg.zerodha_api_key) {
      const { getHoldings, getPositions } = await import('@/lib/zerodha/client')
      const [h, p] = await Promise.all([
        getHoldings(cfg.zerodha_api_key, cfg.zerodha_access_token).catch(() => []),
        getPositions(cfg.zerodha_api_key, cfg.zerodha_access_token).catch(() => []),
      ])
      if (Array.isArray(h) && h.length > 0) return calcZerodhaHoldingsPnl(h, p ?? [])
    }
  } catch { /* no broker */ }

  return null
}

function calcHoldingsPnl(holdings: any[], positions: any[]) {
  let totalPnl = 0, totalInvested = 0
  for (const h of holdings) {
    const qty = +(h.quantity ?? h.realisedquantity ?? 0)
    const avg = +(h.averageprice ?? h.avgprice ?? 0)
    const pnl = +(h.profitandloss ?? h.pnl ?? 0)
    totalInvested += qty * avg
    totalPnl      += pnl
  }
  for (const p of positions) {
    totalPnl += +(p.unrealised ?? p.pnl ?? 0)
  }
  return { totalPnl: safe(totalPnl), totalInvested: safe(totalInvested) }
}

function calcZerodhaHoldingsPnl(holdings: any[], positions: any[]) {
  let totalPnl = 0, totalInvested = 0
  for (const h of holdings) {
    const qty = +(h.quantity ?? 0)
    const avg = +(h.average_price ?? 0)
    const ltp = +(h.last_price ?? 0)
    totalInvested += qty * avg
    totalPnl      += (ltp - avg) * qty
  }
  for (const p of positions) {
    totalPnl += +(p.unrealised ?? p.pnl ?? 0)
  }
  return { totalPnl: safe(totalPnl), totalInvested: safe(totalInvested) }
}

// ── Calculate P&L from trade list (matched BUY/SELL per symbol) ───────────────
function calcRealizedPnl(trades: { symbol: string; txnType: string; qty: number; price: number }[]) {
  if (trades.length === 0) return { realizedPnl: 0, bySymbol: [] as TradeStats[], totalTrades: 0 }

  const bySymbol: Record<string, { buys: { qty: number; price: number }[]; sells: { qty: number; price: number }[] }> = {}
  for (const t of trades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { buys: [], sells: [] }
    if (t.txnType === 'BUY')  bySymbol[t.symbol].buys.push({ qty: t.qty, price: t.price })
    else                       bySymbol[t.symbol].sells.push({ qty: t.qty, price: t.price })
  }

  let realizedPnl = 0
  const symbolStats: TradeStats[] = []

  for (const [symbol, { buys, sells }] of Object.entries(bySymbol)) {
    // Weighted avg cost of buys
    const totalBuyQty   = buys.reduce((s, b) => s + b.qty, 0)
    const totalBuyValue = buys.reduce((s, b) => s + b.qty * b.price, 0)
    const avgBuy        = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0

    // Realized = sell proceeds - cost of sold qty
    const totalSellQty   = sells.reduce((s, b) => s + b.qty, 0)
    const totalSellValue = sells.reduce((s, b) => s + b.qty * b.price, 0)
    const symbolPnl      = totalSellValue - totalSellQty * avgBuy

    realizedPnl += symbolPnl

    const netQty = totalBuyQty - totalSellQty
    const ret    = avgBuy > 0 ? (symbolPnl / (Math.max(totalSellQty, 1) * avgBuy)) * 100 : 0
    symbolStats.push({ symbol, qty: netQty, pnl: safe(symbolPnl), return: safe(ret) })
  }

  return { realizedPnl: safe(realizedPnl), bySymbol: symbolStats, totalTrades: trades.length }
}

// ── Trade statistics from symbol-level P&L ────────────────────────────────────
function calcTradeStats(symbolStats: TradeStats[], totalTrades: number) {
  const winners = symbolStats.filter(s => s.pnl > 0)
  const losers  = symbolStats.filter(s => s.pnl < 0)
  const totalWins   = winners.reduce((s, x) => s + x.pnl, 0)
  const totalLosses = Math.abs(losers.reduce((s, x) => s + x.pnl, 0))
  return {
    winRate:      safe(totalTrades > 0 ? (winners.length / Math.max(symbolStats.length, 1)) * 100 : 0),
    avgWin:       safe(winners.length > 0 ? totalWins   / winners.length : 0),
    avgLoss:      safe(losers.length  > 0 ? totalLosses / losers.length  : 0),
    profitFactor: safe(totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0),
  }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generateDailyReport(
  accountId: number = 1,
  date: Date = new Date()
): Promise<DailyReport> {

  const reportDate = date.toISOString().split('T')[0]

  // 1. Try broker trades for realized P&L
  const brokerTrades = await fetchBrokerTrades()
  const { realizedPnl, bySymbol, totalTrades } = calcRealizedPnl(brokerTrades)

  // 2. Try broker holdings for unrealized P&L
  const brokerHoldings = await fetchBrokerHoldings()
  let unrealizedPnl  = brokerHoldings?.totalPnl ?? 0
  let totalInvested  = brokerHoldings?.totalInvested ?? 0

  // 3. Fall back to paper trades if no broker connected
  if (brokerTrades.length === 0 && !brokerHoldings) {
    const db       = getDb()
    const account  = getAccount(accountId)
    const dayStart = `${reportDate}T00:00:00`
    const dayEnd   = `${reportDate}T23:59:59`

    const paperTrades = db.prepare(`
      SELECT symbol, transaction_type as txnType, quantity as qty, price
      FROM paper_trades WHERE account_id = ? AND executed_at BETWEEN ? AND ?
    `).all(accountId, dayStart, dayEnd) as any[]

    const paperResult = calcRealizedPnl(paperTrades)

    const positions = getPositions(accountId)
    for (const pos of positions) {
      const ltp = await getLTP(pos.symbol).catch(() => null)
      if (ltp !== null) {
        const currentPrice = ltp
        unrealizedPnl += (currentPrice - pos.averagePrice) * pos.quantity
        totalInvested  += pos.averagePrice * Math.abs(pos.quantity)
      }
    }

    const realizedRow = db.prepare(
      `SELECT SUM(COALESCE(realized_pnl, 0)) as realized FROM paper_positions WHERE account_id = ?`
    ).get(accountId) as { realized: number | null }
    const paperRealizedPnl = paperResult.realizedPnl + (realizedRow?.realized ?? 0)

    const totalPnl    = safe(paperRealizedPnl + unrealizedPnl)
    const totalReturn = totalInvested > 0 ? safe((totalPnl / totalInvested) * 100) : 0
    const stats       = calcTradeStats(paperResult.bySymbol, paperResult.totalTrades)

    const report: DailyReport = {
      accountId, reportDate,
      openValue:      safe(unrealizedPnl > 0 ? totalInvested + unrealizedPnl : totalInvested),
      closedValue:    safe(paperTrades.reduce((s, t) => s + t.qty * t.price, 0)),
      realizedPnl:    safe(paperRealizedPnl),
      unrealizedPnl:  safe(unrealizedPnl),
      totalPnl, totalReturn,
      tradesExecuted: paperResult.totalTrades,
      ...stats,
      topGainers: paperResult.bySymbol.sort((a, b) => b.pnl - a.pnl).slice(0, 3),
      topLosers:  paperResult.bySymbol.sort((a, b) => a.pnl - b.pnl).slice(0, 3),
    }
    createOrUpdateReport(report)
    return report
  }

  // 4. Broker-connected path
  const totalPnl    = safe(realizedPnl + unrealizedPnl)
  const totalReturn = totalInvested > 0 ? safe((totalPnl / totalInvested) * 100) : 0
  const stats       = calcTradeStats(bySymbol, totalTrades)

  const sortedByPnl   = [...bySymbol].sort((a, b) => b.pnl - a.pnl)
  const openValue     = totalInvested + unrealizedPnl

  const report: DailyReport = {
    accountId, reportDate,
    openValue:      safe(openValue),
    closedValue:    safe(brokerTrades.filter(t => t.txnType === 'SELL').reduce((s, t) => s + t.qty * t.price, 0)),
    realizedPnl:    safe(realizedPnl),
    unrealizedPnl:  safe(unrealizedPnl),
    totalPnl, totalReturn,
    tradesExecuted: totalTrades,
    ...stats,
    topGainers: sortedByPnl.slice(0, 3),
    topLosers:  [...bySymbol].sort((a, b) => a.pnl - b.pnl).slice(0, 3),
  }

  createOrUpdateReport(report)
  return report
}
