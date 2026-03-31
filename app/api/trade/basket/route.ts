import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { log } from '@/lib/utils/logger'

function ensureTables(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS basket_orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      orders_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export async function GET(_req: NextRequest) {
  const db = getDb()
  ensureTables(db)
  const rows = db.prepare('SELECT * FROM basket_orders ORDER BY created_at DESC').all() as any[]
  const baskets = rows.map(r => ({
    id:        r.id,
    name:      r.name,
    orders:    JSON.parse(r.orders_json ?? '[]'),
    createdAt: r.created_at,
  }))
  return NextResponse.json({ baskets })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  ensureTables(db)

  try {
    const { name, orders, execute, broker } = await req.json()

    if (!name || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'name and orders[] required' }, { status: 400 })
    }

    const results: any[] = []

    if (execute) {
      // Execute all orders sequentially
      const selectedBroker = broker ?? 'paper'
      for (const o of orders) {
        try {
          const res = await fetch(`${req.nextUrl.origin}/api/trade/order`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              broker:      selectedBroker,
              symbol:      o.symbol,
              exchange:    o.exchange ?? 'NSE',
              txnType:     o.txnType,
              qty:         o.qty,
              orderType:   o.orderType ?? 'MARKET',
              price:       o.price ?? null,
              productType: o.productType ?? 'MIS',
              variety:     'NORMAL',
            }),
          })
          const json = await res.json()
          results.push({ symbol: o.symbol, txnType: o.txnType, qty: o.qty, success: res.ok, orderId: json.orderId, error: json.error })
        } catch (err: any) {
          results.push({ symbol: o.symbol, txnType: o.txnType, qty: o.qty, success: false, error: err.message })
        }
      }
      log.trade('basket', `Basket "${name}" executed: ${results.filter(r => r.success).length}/${results.length} orders ok`)
      return NextResponse.json({ executed: true, results })
    }

    // Save as template
    const id = (db.prepare(`
      INSERT INTO basket_orders (name, orders_json) VALUES (?, ?)
    `).run(name, JSON.stringify(orders)) as any).lastInsertRowid
    log.trade('basket', `Basket "${name}" saved #${id}`)
    return NextResponse.json({ saved: true, id })
  } catch (err: any) {
    log.error('basket', `Basket POST failed: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = getDb()
  ensureTables(db)
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  db.prepare('DELETE FROM basket_orders WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
