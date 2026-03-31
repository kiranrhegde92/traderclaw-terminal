import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { commonHeaders } from '@/lib/angelone/client'

interface UnifiedOrder {
  orderId:   string
  symbol:    string
  txnType:   string
  qty:       number
  filledQty: number
  price:     number
  avgPrice:  number
  status:    string
  time:      string
  broker:    string
  exchange:  string
  orderType: string
}

function getSession(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`SELECT key, value FROM app_config WHERE key IN (
    'session_jwt','session_apikey','session_broker',
    'zerodha_access_token','zerodha_api_key'
  )`).all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function GET(_req: NextRequest) {
  const db  = getDb()
  const cfg = getSession(db)
  const broker = cfg.session_broker ?? null
  const orders: UnifiedOrder[] = []

  // ── Broker orders ──────────────────────────────────────────────────────────
  try {
    if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
      const res  = await fetch(
        'https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/getOrderBook',
        { headers: commonHeaders(cfg.session_apikey, cfg.session_jwt) }
      )
      const json = await res.json()
      const raw: any[] = json?.data ?? []
      for (const o of raw) {
        orders.push({
          orderId:   o.orderid ?? o.uniqueorderid,
          symbol:    o.tradingsymbol,
          txnType:   o.transactiontype,
          qty:       Number(o.quantity ?? 0),
          filledQty: Number(o.filledshares ?? o.fillshares ?? 0),
          price:     Number(o.price ?? 0),
          avgPrice:  Number(o.averageprice ?? 0),
          status:    o.orderstatus ?? o.status ?? 'UNKNOWN',
          time:      o.updatetime ?? o.exchtime ?? '',
          broker:    'angelone',
          exchange:  o.exchange ?? 'NSE',
          orderType: o.ordertype ?? '',
        })
      }
    } else if (broker === 'zerodha' && cfg.zerodha_access_token && cfg.zerodha_api_key) {
      const res  = await fetch('https://api.kite.trade/orders', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization':  `token ${cfg.zerodha_api_key}:${cfg.zerodha_access_token}`,
        },
      })
      const json = await res.json()
      const raw: any[] = json?.data ?? []
      for (const o of raw) {
        orders.push({
          orderId:   String(o.order_id),
          symbol:    o.tradingsymbol,
          txnType:   o.transaction_type,
          qty:       Number(o.quantity ?? 0),
          filledQty: Number(o.filled_quantity ?? 0),
          price:     Number(o.price ?? 0),
          avgPrice:  Number(o.average_price ?? 0),
          status:    o.status ?? 'UNKNOWN',
          time:      o.order_timestamp ?? '',
          broker:    'zerodha',
          exchange:  o.exchange ?? 'NSE',
          orderType: o.order_type ?? '',
        })
      }
    }
  } catch { /* broker fetch failed — still return paper orders */ }

  // ── Paper orders (today) ───────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const paperRows = db.prepare(`
    SELECT * FROM paper_orders
    WHERE account_id = 1 AND date(created_at) = ?
    ORDER BY created_at DESC
  `).all(today) as any[]

  for (const o of paperRows) {
    orders.push({
      orderId:   String(o.id),
      symbol:    o.symbol,
      txnType:   o.transaction_type,
      qty:       o.quantity,
      filledQty: o.filled_quantity ?? 0,
      price:     o.price ?? 0,
      avgPrice:  o.filled_price ?? 0,
      status:    o.status,
      time:      o.created_at,
      broker:    'paper',
      exchange:  o.exchange ?? 'NSE',
      orderType: o.order_type,
    })
  }

  return NextResponse.json({ orders, broker: broker ?? 'paper' })
}
