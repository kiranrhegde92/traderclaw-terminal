import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db     = getDb()
    const config = db.prepare('SELECT key, value FROM app_config WHERE key LIKE ? OR key LIKE ?')
      .all('session_%', 'zerodha_%') as { key: string; value: string }[]
    const map    = Object.fromEntries(config.map(r => [r.key, r.value]))

    const broker = map.session_broker ?? null

    // ── Zerodha session ───────────────────────────────────────────────
    if (broker === 'zerodha' && map.zerodha_access_token) {
      return NextResponse.json({
        connected:   true,
        broker:      'zerodha',
        clientCode:  map.zerodha_user_id  ?? null,
        jwtToken:    map.zerodha_access_token,
        feedToken:   null,
        profile:     map.zerodha_profile ? JSON.parse(map.zerodha_profile) : null,
      })
    }

    // ── Angel One session ─────────────────────────────────────────────
    if (map.session_jwt) {
      return NextResponse.json({
        connected:  true,
        broker:     'angelone',
        clientCode: map.session_client  ?? null,
        jwtToken:   map.session_jwt     ?? null,
        feedToken:  map.session_feed    ?? null,
        profile:    map.session_profile ? JSON.parse(map.session_profile) : null,
      })
    }

    return NextResponse.json({ connected: false })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
