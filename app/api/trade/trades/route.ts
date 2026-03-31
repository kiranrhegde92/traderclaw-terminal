import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { commonHeaders } from '@/lib/angelone/client'

interface UnifiedTrade {
  tradeId:   string
  orderId:   string
  symbol:    string
  txnType:   string
  qty:       number
  tradePrice: number
  value:     number
  time:      string
  broker:    string
  exchange:  string
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
  const trades: UnifiedTrade[] = []

  try {
    if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
      const res  = await fetch(
        'https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/getTradeBook',
        { headers: commonHeaders(cfg.session_apikey, cfg.session_jwt) }
      )
      const json = await res.json()
      const raw: any[] = json?.data ?? []
      for (const t of raw) {
        const qty   = Number(t.fillshares ?? t.quantity ?? 0)
        const price = Number(t.fillprice ?? t.averageprice ?? 0)
        trades.push({
          tradeId:    t.tradeid ?? t.orderid,
          orderId:    t.orderid,
          symbol:     t.tradingsymbol,
          txnType:    t.transactiontype,
          qty,
          tradePrice: price,
          value:      qty * price,
          time:       t.updatetime ?? t.filltime ?? '',
          broker:     'angelone',
          exchange:   t.exchange ?? 'NSE',
        })
      }
    } else if (broker === 'zerodha' && cfg.zerodha_access_token && cfg.zerodha_api_key) {
      const res  = await fetch('https://api.kite.trade/trades', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization':  `token ${cfg.zerodha_api_key}:${cfg.zerodha_access_token}`,
        },
      })
      const json = await res.json()
      const raw: any[] = json?.data ?? []
      for (const t of raw) {
        const qty   = Number(t.quantity ?? 0)
        const price = Number(t.average_price ?? t.price ?? 0)
        trades.push({
          tradeId:    String(t.trade_id),
          orderId:    String(t.order_id),
          symbol:     t.tradingsymbol,
          txnType:    t.transaction_type,
          qty,
          tradePrice: price,
          value:      qty * price,
          time:       t.fill_timestamp ?? t.order_timestamp ?? '',
          broker:     'zerodha',
          exchange:   t.exchange ?? 'NSE',
        })
      }
    }
  } catch { /* broker fetch failed — still return paper trades */ }

  // Paper trades (today)
  const today = new Date().toISOString().slice(0, 10)
  const paperRows = db.prepare(`
    SELECT * FROM paper_trades
    WHERE account_id = 1 AND date(executed_at) = ?
    ORDER BY executed_at DESC
  `).all(today) as any[]

  for (const t of paperRows) {
    trades.push({
      tradeId:    String(t.id),
      orderId:    String(t.order_id),
      symbol:     t.symbol,
      txnType:    t.transaction_type,
      qty:        t.quantity,
      tradePrice: t.price,
      value:      t.quantity * t.price,
      time:       t.executed_at,
      broker:     'paper',
      exchange:   t.exchange ?? 'NSE',
    })
  }

  return NextResponse.json({ trades, broker: broker ?? 'paper' })
}
