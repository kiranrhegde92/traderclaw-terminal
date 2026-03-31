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

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const { orderId } = params
  const broker = req.nextUrl.searchParams.get('broker') ?? 'angelone'
  const db = getDb()
  const cfg = getSession(db)

  try {
    if (broker === 'angelone') {
      const jwt = cfg.session_jwt; const apiKey = cfg.session_apikey
      if (!jwt || !apiKey) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
      const res = await fetch(
        `https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/details/${orderId}`,
        { headers: commonHeaders(apiKey, jwt) }
      )
      const json = await res.json()
      return NextResponse.json({ order: json.data ?? null, raw: json })
    }

    if (broker === 'zerodha') {
      const token = cfg.zerodha_access_token; const apiKey = cfg.zerodha_api_key
      if (!token || !apiKey) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
      const res = await fetch(`https://api.kite.trade/orders/${orderId}`, {
        headers: { 'X-Kite-Version': '3', 'Authorization': `token ${apiKey}:${token}` },
      })
      const json = await res.json()
      return NextResponse.json({ order: json.data?.[0] ?? null, raw: json })
    }

    // Paper
    const row = db.prepare('SELECT * FROM paper_orders WHERE id = ?').get(orderId) as any
    return NextResponse.json({ order: row ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { orderId: string } }) {
  const { orderId } = params
  const broker = req.nextUrl.searchParams.get('broker') ?? 'angelone'
  const db = getDb()
  const cfg = getSession(db)

  try {
    if (broker === 'angelone') {
      const jwt = cfg.session_jwt; const apiKey = cfg.session_apikey
      if (!jwt || !apiKey) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
      const res = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/cancelOrder', {
        method: 'POST',
        headers: commonHeaders(apiKey, jwt),
        body: JSON.stringify({ variety: 'NORMAL', orderid: orderId }),
      })
      const json = await res.json()
      log.trade('trade', `Angel One cancel order #${orderId}: ${json?.message}`)
      return NextResponse.json({ success: json?.status ?? false, message: json?.message })
    }

    if (broker === 'zerodha') {
      const token = cfg.zerodha_access_token; const apiKey = cfg.zerodha_api_key
      if (!token || !apiKey) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
      const res = await fetch(`https://api.kite.trade/orders/regular/${orderId}`, {
        method: 'DELETE',
        headers: { 'X-Kite-Version': '3', 'Authorization': `token ${apiKey}:${token}` },
      })
      const json = await res.json()
      log.trade('trade', `Zerodha cancel order #${orderId}: ${json?.message}`)
      return NextResponse.json({ success: json?.status === 'success', message: json?.message })
    }

    // Paper
    db.prepare(`UPDATE paper_orders SET status='CANCELLED', updated_at=datetime('now') WHERE id=?`).run(orderId)
    log.trade('trade', `Paper cancel order #${orderId}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
