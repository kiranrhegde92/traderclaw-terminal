import { NextResponse }   from 'next/server'
import { getHoldings as getAngelHoldings, getPositions as getAngelPositions } from '@/lib/angelone/client'
import { getHoldings as getZerodhaHoldings, getPositions as getZerodhaPositions } from '@/lib/zerodha/client'
import { getHoldings as getOAHoldings,    getPositions as getOAPositions,
         isOpenAlgoUp }                   from '@/lib/openalgo/client'
import { getDb }          from '@/lib/db'
import { getAccount, getPositions as getPaperPositions } from '@/lib/db/queries/paper-trades'

function getSessions() {
  try {
    const db  = getDb()
    const cfg = db.prepare('SELECT key, value FROM app_config WHERE key LIKE ? OR key LIKE ?')
      .all('session_%', 'zerodha_%') as { key: string; value: string }[]
    const map = Object.fromEntries(cfg.map(r => [r.key, r.value]))
    return {
      broker:   map.session_broker ?? null,
      angelone: map.session_jwt
        ? { jwtToken: map.session_jwt, apiKey: map.session_apikey ?? process.env.ANGELONE_API_KEY ?? '' }
        : null,
      zerodha:  map.zerodha_access_token
        ? { accessToken: map.zerodha_access_token, apiKey: map.zerodha_api_key ?? process.env.ZERODHA_API_KEY ?? '' }
        : null,
    }
  } catch { return { broker: null, angelone: null, zerodha: null } }
}

export async function GET() {
  try {
    // ── Try OpenAlgo first ──────────────────────────────────────────────
    const oaUp = await isOpenAlgoUp().catch(() => false)

    if (oaUp) {
      const [holdings, positions] = await Promise.all([
        getOAHoldings().catch(() => null),
        getOAPositions().catch(() => null),
      ])

      if (Array.isArray(holdings) && holdings.length > 0) {
        return NextResponse.json(summariseHoldings(holdings, positions ?? [], 'openalgo'))
      }
    }

    const sessions = getSessions()

    // ── Zerodha ─────────────────────────────────────────────────────────
    if (sessions.zerodha && sessions.broker === 'zerodha') {
      const { accessToken, apiKey } = sessions.zerodha
      const [holdings, positions]  = await Promise.all([
        getZerodhaHoldings(apiKey, accessToken).catch(() => []),
        getZerodhaPositions(apiKey, accessToken).catch(() => []),
      ])
      if (Array.isArray(holdings) && holdings.length > 0) {
        return NextResponse.json(summariseZerodhaHoldings(holdings, positions, 'zerodha'))
      }
    }

    // ── Angel One ────────────────────────────────────────────────────────
    if (sessions.angelone?.jwtToken) {
      const { jwtToken, apiKey } = sessions.angelone
      const [holdings, positions] = await Promise.all([
        getAngelHoldings(jwtToken, apiKey).catch(() => null),
        getAngelPositions(jwtToken, apiKey).catch(() => null),
      ])

      if (Array.isArray(holdings) && holdings.length > 0) {
        return NextResponse.json(summariseHoldings(holdings, positions ?? [], 'angelone'))
      }
    }

    // ── Paper trade fallback ────────────────────────────────────────────
    try {
      const account   = getAccount(1)
      const positions = getPaperPositions(1)

      if (account && positions.length > 0) {
        const raw: any = account
        const balance  = raw.current_balance ?? raw.currentBalance ?? 0
        const initial  = raw.initial_balance ?? raw.initialBalance ?? 0
        const unrealised = positions.reduce((s, p) => s + ((p as any).unrealisedPnl ?? 0), 0)
        const totalPnl   = balance - initial + unrealised

        return NextResponse.json({
          connected:    true,
          source:       'paper',
          holdings:     positions.length,
          totalValue:   balance + unrealised,
          totalCost:    initial,
          totalPnl,
          totalPnlPct:  initial > 0 ? (totalPnl / initial) * 100 : 0,
          todayPnl:     unrealised,
          todayPnlPct:  initial > 0 ? (unrealised / initial) * 100 : 0,
        })
      }
    } catch { /* no paper trade db yet */ }

    // ── Not connected ───────────────────────────────────────────────────
    return NextResponse.json({ connected: false })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message })
  }
}

// ─── OpenAlgo / Angel One → OpenClaw normalisation ───────────────────────────

function summariseHoldings(holdings: any[], positions: any[], source: string) {
  let totalValue  = 0
  let totalCost   = 0
  let totalPnl    = 0
  let todayPnl    = 0

  for (const h of holdings) {
    const qty      = +(h.quantity ?? h.realisedquantity ?? h.authorisedquantity ?? 0)
    const avgPrice = +(h.averageprice ?? h.avgprice ?? 0)
    const ltp      = +(h.ltp ?? 0)
    const pnl      = +(h.profitandloss ?? h.pnl ?? 0)
    const close    = +(h.close ?? ltp)

    totalCost  += qty * avgPrice
    totalValue += qty * ltp
    totalPnl   += pnl
    if (close && ltp) todayPnl += (ltp - close) * qty
  }

  for (const p of positions) {
    const unrealised = +(p.unrealised ?? p.pnl ?? 0)
    todayPnl   += unrealised
    totalPnl   += unrealised
    totalValue += unrealised > 0 ? unrealised : 0
  }

  return {
    connected:   true,
    source,
    holdings:    holdings.length,
    positions:   positions.filter((p: any) => Math.abs(+(p.netqty ?? p.quantity ?? 0)) > 0).length,
    totalValue:  Math.round(totalValue),
    totalCost:   Math.round(totalCost),
    totalPnl:    Math.round(totalPnl),
    totalPnlPct: totalCost > 0 ? +((totalPnl / totalCost) * 100).toFixed(2) : 0,
    todayPnl:    Math.round(todayPnl),
    todayPnlPct: totalCost > 0 ? +((todayPnl  / totalCost) * 100).toFixed(2) : 0,
  }
}

// ─── Zerodha → OpenClaw normalisation ────────────────────────────────────────

function summariseZerodhaHoldings(holdings: any[], positions: any[], source: string) {
  let totalValue = 0
  let totalCost  = 0
  let totalPnl   = 0
  let todayPnl   = 0

  for (const h of holdings) {
    const qty  = +(h.quantity ?? 0)
    const avg  = +(h.average_price ?? 0)
    const ltp  = +(h.last_price    ?? 0)
    const pnl  = +(h.pnl           ?? (ltp - avg) * qty)
    const prev = +(h.close_price   ?? ltp)

    totalCost  += qty * avg
    totalValue += qty * ltp
    totalPnl   += pnl
    if (prev && ltp) todayPnl += (ltp - prev) * qty
  }

  for (const p of positions) {
    const unrealised = +(p.unrealised ?? p.pnl ?? 0)
    todayPnl   += unrealised
    totalPnl   += unrealised
    totalValue += unrealised > 0 ? unrealised : 0
  }

  return {
    connected:   true,
    source,
    holdings:    holdings.length,
    positions:   positions.filter((p: any) => Math.abs(+(p.quantity ?? 0)) > 0).length,
    totalValue:  Math.round(totalValue),
    totalCost:   Math.round(totalCost),
    totalPnl:    Math.round(totalPnl),
    totalPnlPct: totalCost > 0 ? +((totalPnl / totalCost) * 100).toFixed(2) : 0,
    todayPnl:    Math.round(todayPnl),
    todayPnlPct: totalCost > 0 ? +((todayPnl  / totalCost) * 100).toFixed(2) : 0,
  }
}
