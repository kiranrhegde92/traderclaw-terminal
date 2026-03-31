import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { commonHeaders } from '@/lib/angelone/client'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { log } from '@/lib/utils/logger'

// Ensure gtt_orders table exists
function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gtt_orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol        TEXT NOT NULL,
      exchange      TEXT NOT NULL DEFAULT 'NSE',
      ltp           REAL NOT NULL DEFAULT 0,
      condition     TEXT NOT NULL CHECK(condition IN ('above','below')),
      trigger_price REAL NOT NULL,
      order_qty     INTEGER NOT NULL,
      order_price   REAL NOT NULL,
      order_type    TEXT NOT NULL DEFAULT 'LIMIT',
      status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','TRIGGERED','CANCELLED','EXPIRED')),
      broker_rule_id TEXT,
      broker        TEXT NOT NULL DEFAULT 'local',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

function getSession(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`SELECT key, value FROM app_config WHERE key IN (
    'session_jwt','session_apikey','session_broker',
    'zerodha_access_token','zerodha_api_key'
  )`).all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export async function GET(req: NextRequest) {
  const db = getDb()
  ensureTable(db)
  const cfg = getSession(db)
  const broker = cfg.session_broker ?? null
  const gttList: any[] = []

  // Angel One GTT rules
  if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
    try {
      const res  = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/gtt/v1/ruleList', {
        method:  'POST',
        headers: commonHeaders(cfg.session_apikey, cfg.session_jwt),
        body:    JSON.stringify({ status: ['ACTIVE', 'NEW'], page: 1, count: 100 }),
      })
      const json = await res.json()
      const rules: any[] = json?.data?.list ?? []
      for (const r of rules) {
        gttList.push({
          id:           `ao_${r.id}`,
          symbol:       r.tradingsymbol ?? r.symbolname,
          exchange:     r.exchange,
          condition:    r.transactiontype === 'BUY' ? 'above' : 'below',
          triggerPrice: r.triggerprice,
          orderPrice:   r.price,
          orderQty:     Number(r.qty),
          orderType:    r.ordertype ?? 'LIMIT',
          status:       r.status ?? 'ACTIVE',
          broker:       'angelone',
          createdAt:    r.createddate ?? '',
        })
      }
    } catch { /* non-fatal */ }
  }

  // Local GTT orders
  const localRows = db.prepare(`
    SELECT * FROM gtt_orders WHERE status = 'ACTIVE' ORDER BY created_at DESC
  `).all() as any[]
  for (const r of localRows) {
    gttList.push({
      id:           r.id,
      symbol:       r.symbol,
      exchange:     r.exchange,
      ltp:          r.ltp,
      condition:    r.condition,
      triggerPrice: r.trigger_price,
      orderPrice:   r.order_price,
      orderQty:     r.order_qty,
      orderType:    r.order_type,
      status:       r.status,
      broker:       r.broker,
      createdAt:    r.created_at,
    })
  }

  return NextResponse.json({ gtt: gttList, broker })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  ensureTable(db)
  const cfg = getSession(db)
  const broker = cfg.session_broker ?? 'local'

  try {
    const body = await req.json()
    const { symbol, exchange, ltp, condition, triggerPrice, orderQty, orderPrice, orderType } = body

    if (!symbol || !condition || !triggerPrice || !orderQty || !orderPrice) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let brokerRuleId: string | null = null

    // Try Angel One GTT
    if (broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
      try {
        const payload = {
          tradingsymbol:   symbol,
          symboltoken:     '0',
          exchange:        exchange ?? 'NSE',
          transactiontype: condition === 'above' ? 'BUY' : 'SELL',
          producttype:     'MIS',
          price:           String(orderPrice),
          qty:             String(orderQty),
          triggerprice:    String(triggerPrice),
          disclosedqty:    '0',
          ordertype:       orderType ?? 'LIMIT',
        }
        const res  = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/gtt/v1/createRule', {
          method:  'POST',
          headers: commonHeaders(cfg.session_apikey, cfg.session_jwt),
          body:    JSON.stringify(payload),
        })
        const json = await res.json()
        if (json?.status) brokerRuleId = String(json.data?.id ?? '')
      } catch { /* fall through to local */ }
    }

    const currentLtp = ltp ?? (await getLTP(symbol)) ?? 0
    const id = (db.prepare(`
      INSERT INTO gtt_orders (symbol,exchange,ltp,condition,trigger_price,order_qty,order_price,order_type,broker,broker_rule_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(symbol, exchange ?? 'NSE', currentLtp, condition, triggerPrice, orderQty, orderPrice, orderType ?? 'LIMIT', brokerRuleId ? broker : 'local', brokerRuleId ?? null) as any).lastInsertRowid

    log.trade('gtt', `GTT created: ${condition} ${symbol} @ ₹${triggerPrice} #${id}`)
    return NextResponse.json({ success: true, id, brokerRuleId })
  } catch (err: any) {
    log.error('gtt', `Create GTT failed: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb()
  ensureTable(db)
  const id     = req.nextUrl.searchParams.get('id')
  const cfg    = getSession(db)
  const broker = cfg.session_broker ?? 'local'

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // If Angel One rule
  if (id.startsWith('ao_') && broker === 'angelone' && cfg.session_jwt && cfg.session_apikey) {
    const ruleId = id.replace('ao_', '')
    try {
      await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/gtt/v1/cancelRule', {
        method:  'POST',
        headers: commonHeaders(cfg.session_apikey, cfg.session_jwt),
        body:    JSON.stringify({ id: ruleId }),
      })
    } catch { /* non-fatal */ }
    return NextResponse.json({ success: true })
  }

  db.prepare(`UPDATE gtt_orders SET status='CANCELLED', updated_at=datetime('now') WHERE id=?`).run(id)
  log.trade('gtt', `GTT cancelled #${id}`)
  return NextResponse.json({ success: true })
}
