import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db  = getDb()
    const cfg = db.prepare("SELECT key, value FROM app_config WHERE key IN ('session_broker','session_jwt','zerodha_access_token')").all() as { key: string; value: string }[]
    const map = Object.fromEntries(cfg.map(r => [r.key, r.value]))

    const broker = map.session_broker ?? null

    if (broker === 'zerodha' && map.zerodha_access_token) {
      return NextResponse.json({ source: 'zerodha', connected: true, broker: 'zerodha' })
    }
    if (map.session_jwt) {
      return NextResponse.json({ source: 'angelone', connected: true, broker: 'angelone' })
    }

    return NextResponse.json({ source: 'yahoo', connected: false, broker: null })
  } catch {
    return NextResponse.json({ source: 'yahoo', connected: false, broker: null })
  }
}
