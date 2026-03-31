import { NextResponse } from 'next/server'
import { getDb }        from '@/lib/db'
import { getHoldings as getAngelHoldings, getPositions as getAngelPositions } from '@/lib/angelone/client'
import { getHoldings as getZerodhaHoldings, getPositions as getZerodhaPositions } from '@/lib/zerodha/client'
import { getHoldings as getOAHoldings,    getPositions as getOAPositions,
         isOpenAlgoUp }                   from '@/lib/openalgo/client'

function getSessions() {
  try {
    const db  = getDb()
    const cfg = db.prepare('SELECT key, value FROM app_config WHERE key LIKE ? OR key LIKE ?')
      .all('session_%', 'zerodha_%') as { key: string; value: string }[]
    const map = Object.fromEntries(cfg.map(r => [r.key, r.value]))
    return {
      broker:      map.session_broker ?? null,
      angelone:    map.session_jwt
        ? { jwtToken: map.session_jwt, apiKey: map.session_apikey ?? process.env.ANGELONE_API_KEY ?? '' }
        : null,
      zerodha:     map.zerodha_access_token
        ? { accessToken: map.zerodha_access_token, apiKey: map.zerodha_api_key ?? process.env.ZERODHA_API_KEY ?? '' }
        : null,
    }
  } catch { return { broker: null, angelone: null, zerodha: null } }
}

export async function GET() {
  try {
    // Try OpenAlgo first (it has its own auth)
    const oaUp = await isOpenAlgoUp()

    if (oaUp) {
      const [holdings, positions] = await Promise.all([
        getOAHoldings().catch(() => null),
        getOAPositions().catch(() => null),
      ])
      if (holdings !== null) {
        return NextResponse.json({
          data:   { holdings: normaliseOA(holdings), positions: normaliseOAPos(positions ?? []) },
          source: 'openalgo',
        })
      }
    }

    const sessions = getSessions()

    // ── Zerodha ───────────────────────────────────────────────────────
    if (sessions.zerodha && sessions.broker === 'zerodha') {
      const { accessToken, apiKey } = sessions.zerodha
      const [holdings, positions]  = await Promise.all([
        getZerodhaHoldings(apiKey, accessToken),
        getZerodhaPositions(apiKey, accessToken),
      ])
      return NextResponse.json({
        data:   { holdings: normaliseZerodhaHoldings(holdings), positions: normaliseZerodhaPositions(positions) },
        source: 'zerodha',
      })
    }

    // ── Angel One ─────────────────────────────────────────────────────
    if (sessions.angelone) {
      const { jwtToken, apiKey } = sessions.angelone
      const [holdings, positions] = await Promise.all([
        getAngelHoldings(jwtToken, apiKey),
        getAngelPositions(jwtToken, apiKey),
      ])
      return NextResponse.json({
        data:   { holdings: holdings ?? [], positions: positions ?? [] },
        source: 'angelone',
      })
    }

    return NextResponse.json({
      data:    { holdings: [], positions: [] },
      source:  'unavailable',
      message: 'Connect a broker to see your portfolio',
    })
  } catch (err: any) {
    return NextResponse.json({
      data:   { holdings: [], positions: [] },
      source: 'error',
      error:  err.message,
    }, { status: 500 })
  }
}

// ─── OpenAlgo → OpenClaw normalisation ───────────────────────────────────────
// OpenAlgo returns a unified format; map it to what the UI expects.

function normaliseOA(raw: any[]): any[] {
  return raw.map(h => {
    const qty     = h.quantity ?? 0
    const pnl     = h.pnl ?? h.profitandloss ?? 0
    const pnlPct  = h.pnlpercent ?? h.pnlpercentage ?? 0

    // Derive avgprice and ltp from pnl + pnlpercent when broker omits them
    let avgprice = h.avgprice ?? h.averageprice ?? 0
    let ltp      = h.ltp ?? 0
    if (!avgprice && qty && pnlPct) {
      avgprice = pnl / (pnlPct / 100) / qty
    }
    if (!ltp && avgprice && qty) {
      ltp = avgprice + pnl / qty
    }

    return {
      tradingsymbol:           h.symbol ?? h.tradingsymbol ?? '',
      companynamewithexchange: h.symbolname ?? h.name ?? h.symbol ?? '',
      exchange:                h.exchange ?? 'NSE',
      isin:                    h.isin ?? '',
      t1quantity:              h.t1quantity ?? 0,
      realisedquantity:        qty,
      quantity:                qty,
      authorisedquantity:      qty,
      product:                 h.product ?? 'CNC',
      collateralquantity:      0,
      collateraltype:          '',
      haircut:                 0,
      averageprice:            Math.round(avgprice * 100) / 100,
      ltp:                     Math.round(ltp * 100) / 100,
      symboltoken:             h.symboltoken ?? '',
      close:                   h.close ?? ltp,
      profitandloss:           pnl,
      pnlpercentage:           pnlPct,
      instrumenttype:          'EQ',
    }
  })
}

function normaliseOAPos(raw: any[]): any[] {
  return raw.map(p => ({
    tradingsymbol: p.symbol ?? p.tradingsymbol ?? '',
    exchange:      p.exchange ?? 'NSE',
    netqty:        p.netqty ?? p.quantity ?? 0,
    unrealised:    p.unrealised ?? p.pnl ?? 0,
    product:       p.product ?? 'MIS',
  }))
}

// ─── Zerodha → OpenClaw normalisation ────────────────────────────────────────
// Kite Connect holdings: { tradingsymbol, exchange, isin, t1_quantity, realised_quantity,
//   quantity, authorised_quantity, product, collateral_quantity, collateral_type, haircut,
//   average_price, last_price, close_price, pnl, day_change, day_change_percentage }

function normaliseZerodhaHoldings(raw: any[]): any[] {
  return raw.map(h => {
    const qty    = h.quantity ?? 0
    const avg    = h.average_price ?? 0
    const ltp    = h.last_price    ?? 0
    const pnl    = h.pnl           ?? (ltp - avg) * qty
    const pnlPct = avg && qty ? ((ltp - avg) / avg * 100) : 0
    return {
      tradingsymbol:           h.tradingsymbol ?? '',
      companynamewithexchange: h.tradingsymbol ?? '',
      exchange:                h.exchange ?? 'NSE',
      isin:                    h.isin ?? '',
      t1quantity:              h.t1_quantity ?? 0,
      realisedquantity:        h.realised_quantity ?? qty,
      quantity:                qty,
      authorisedquantity:      h.authorised_quantity ?? qty,
      product:                 h.product ?? 'CNC',
      collateralquantity:      h.collateral_quantity ?? 0,
      collateraltype:          h.collateral_type ?? '',
      haircut:                 h.haircut ?? 0,
      averageprice:            Math.round(avg * 100) / 100,
      ltp:                     Math.round(ltp * 100) / 100,
      symboltoken:             '',
      close:                   h.close_price ?? ltp,
      profitandloss:           Math.round(pnl * 100) / 100,
      pnlpercentage:           Math.round(pnlPct * 100) / 100,
      instrumenttype:          'EQ',
    }
  })
}

function normaliseZerodhaPositions(raw: any[]): any[] {
  return raw.map(p => ({
    tradingsymbol: p.tradingsymbol ?? '',
    exchange:      p.exchange ?? 'NSE',
    netqty:        p.quantity ?? 0,
    unrealised:    p.unrealised ?? p.pnl ?? 0,
    product:       p.product ?? 'MIS',
  }))
}

