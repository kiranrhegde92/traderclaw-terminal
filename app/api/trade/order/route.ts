import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { commonHeaders } from '@/lib/angelone/client'
import { log } from '@/lib/utils/logger'

function getSession(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`SELECT key, value FROM app_config WHERE key IN (
    'session_jwt','session_apikey','session_broker',
    'zerodha_access_token','zerodha_api_key'
  )`).all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function insertPaperRecord(db: ReturnType<typeof getDb>, body: any, orderId: string, broker: string) {
  try {
    db.prepare(`
      INSERT INTO paper_orders (account_id,symbol,exchange,segment,order_type,transaction_type,
        product_type,quantity,price,trigger_price,status,notes,created_at,updated_at)
      VALUES (1,?,?,?,?,?,?,?,?,?,'PENDING',?,datetime('now'),datetime('now'))
    `).run(
      body.symbol,
      body.exchange ?? 'NSE',
      'EQ',
      body.orderType,
      body.txnType,
      body.productType ?? 'MIS',
      body.qty,
      body.price ?? null,
      body.triggerPrice ?? null,
      `live:${broker}:${orderId}`,
    )
  } catch { /* non-fatal */ }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { broker, symbol, exchange, txnType, qty, orderType, price, triggerPrice, productType, variety } = body

    if (!broker || !symbol || !txnType || !qty || !orderType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const cfg = getSession(db)

    // Paper trade fallback
    if (broker === 'paper') {
      const res = await fetch(`${req.nextUrl.origin}/api/paper-trade/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, exchange: exchange ?? 'NSE', transactionType: txnType,
          orderType, quantity: qty, price, triggerPrice, productType: productType ?? 'MIS',
        }),
      })
      const data = await res.json()
      return NextResponse.json({ orderId: String(data.orderId), status: 'PENDING', message: 'Paper order placed', broker: 'paper' })
    }

    // Angel One
    if (broker === 'angelone') {
      const jwt = cfg.session_jwt
      const apiKey = cfg.session_apikey
      if (!jwt || !apiKey) {
        return NextResponse.json({ error: 'Angel One session not found. Please login first.' }, { status: 401 })
      }
      const payload: Record<string, string> = {
        variety:         variety ?? 'NORMAL',
        tradingsymbol:   symbol,
        symboltoken:     '0',
        transactiontype: txnType,
        exchange:        exchange ?? 'NSE',
        ordertype:       orderType,
        producttype:     productType ?? 'MIS',
        duration:        'DAY',
        price:           String(price ?? 0),
        squareoff:       '0',
        stoploss:        '0',
        quantity:        String(qty),
      }
      if (triggerPrice) payload.triggerprice = String(triggerPrice)

      const res  = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder', {
        method:  'POST',
        headers: commonHeaders(apiKey, jwt),
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json?.status) {
        log.error('trade', `Angel One order failed: ${json?.message}`)
        return NextResponse.json({ error: json?.message ?? 'Order failed', details: json }, { status: 400 })
      }
      const orderId = json.data?.orderid ?? json.data?.uniqueorderid ?? String(Date.now())
      insertPaperRecord(db, body, orderId, 'angelone')
      log.trade('trade', `Angel One order placed: ${txnType} ${symbol} x${qty} #${orderId}`)
      return NextResponse.json({ orderId, status: 'OPEN', message: json.message ?? 'Order placed', broker: 'angelone' })
    }

    // Zerodha
    if (broker === 'zerodha') {
      const token  = cfg.zerodha_access_token
      const apiKey = cfg.zerodha_api_key
      if (!token || !apiKey) {
        return NextResponse.json({ error: 'Zerodha session not found. Please login first.' }, { status: 401 })
      }
      const params = new URLSearchParams({
        tradingsymbol:    symbol,
        exchange:         exchange ?? 'NSE',
        transaction_type: txnType,
        order_type:       orderType,
        quantity:         String(qty),
        product:          productType ?? 'MIS',
        validity:         'DAY',
      })
      if (price && orderType !== 'MARKET')        params.set('price', String(price))
      if (triggerPrice)                           params.set('trigger_price', String(triggerPrice))

      const kiteVariety = variety ?? 'regular'
      const res = await fetch(`https://api.kite.trade/orders/${kiteVariety}`, {
        method:  'POST',
        headers: {
          'X-Kite-Version': '3',
          'Authorization':  `token ${apiKey}:${token}`,
          'Content-Type':   'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        log.error('trade', `Zerodha order failed: ${json?.message}`)
        return NextResponse.json({ error: json?.message ?? 'Order failed' }, { status: 400 })
      }
      const orderId = String(json.data?.order_id ?? Date.now())
      insertPaperRecord(db, body, orderId, 'zerodha')
      log.trade('trade', `Zerodha order placed: ${txnType} ${symbol} x${qty} #${orderId}`)
      return NextResponse.json({ orderId, status: 'OPEN', message: 'Order placed', broker: 'zerodha' })
    }

    return NextResponse.json({ error: `Unknown broker: ${broker}` }, { status: 400 })
  } catch (err: any) {
    log.error('trade', `POST /api/trade/order failed: ${err.message}`)
    return NextResponse.json({ error: 'Order placement failed', message: err.message }, { status: 500 })
  }
}
