import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { invalidateSession } from '@/lib/angelone/market'
import { invalidateZerodhaSession } from '@/lib/zerodha/market'
import { cache } from '@/lib/nse/cache'
import { log } from '@/lib/utils/logger'

export async function POST() {
  try {
    const db = getDb()
    db.prepare(`DELETE FROM app_config WHERE key LIKE 'session_%'`).run()
    db.prepare(`DELETE FROM app_config WHERE key LIKE 'zerodha_%'`).run()
    invalidateSession()
    invalidateZerodhaSession()
    // Clear server-side TTL cache so next request fetches fresh non-broker data
    cache.clear()
    log.info('auth', 'Logged out')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
