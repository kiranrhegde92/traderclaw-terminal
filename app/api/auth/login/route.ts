import { NextRequest, NextResponse } from 'next/server'
import { loginWithCredentials } from '@/lib/angelone/client'
import { generateTOTP } from '@/lib/angelone/auth'
import { invalidateSession } from '@/lib/angelone/market'
import { kiteLoginUrl } from '@/lib/zerodha/client'
import { getDb } from '@/lib/db'
import { log } from '@/lib/utils/logger'
import { signToken } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/crypto'

function getStoredCredentials(broker: string): Record<string, string> | null {
  try {
    const db = getDb()
    db.exec(`CREATE TABLE IF NOT EXISTS broker_credentials (
      broker TEXT PRIMARY KEY,
      encrypted_data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`)
    const row = db
      .prepare(`SELECT encrypted_data FROM broker_credentials WHERE broker = ?`)
      .get(broker) as { encrypted_data: string } | undefined
    if (!row) return null
    return JSON.parse(decrypt(row.encrypted_data))
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const broker = (body.broker as string) ?? 'angelone'

    // ── Zerodha OAuth initiation ───────────────────────────────────────
    if (broker === 'zerodha') {
      const stored    = getStoredCredentials('zerodha') ?? {}
      const apiKey    = body.apiKey    || stored.apiKey    || process.env.ZERODHA_API_KEY    || ''
      const apiSecret = body.apiSecret || stored.apiSecret || process.env.ZERODHA_API_SECRET || ''

      if (!apiKey || !apiSecret) {
        return NextResponse.json(
          { error: 'Zerodha API Key and Secret are required — get them from kite.trade/developers' },
          { status: 400 }
        )
      }

      // Persist credentials encrypted if requested
      if (body.saveCredentials) {
        const db = getDb()
        db.exec(`CREATE TABLE IF NOT EXISTS broker_credentials (
          broker TEXT PRIMARY KEY,
          encrypted_data TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        )`)
        db.prepare(`
          INSERT OR REPLACE INTO broker_credentials (broker, encrypted_data, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run('zerodha', encrypt(JSON.stringify({ apiKey, apiSecret })))
      }

      // Stash API key + secret temporarily so the OAuth callback can use them
      const db = getDb()
      db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_api_key_pending',    apiKey)
      db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_api_secret_pending', apiSecret)

      log.info('auth', `Zerodha OAuth: redirecting to Kite Connect login`)
      return NextResponse.json({ redirectUrl: kiteLoginUrl(apiKey) })
    }

    if (broker !== 'angelone') {
      return NextResponse.json(
        { error: `${broker} integration is coming soon` },
        { status: 400 }
      )
    }

    // Merge stored credentials with provided values (provided values win)
    const stored = getStoredCredentials(broker) ?? {}
    const clientCode = body.clientCode || stored.clientCode || ''
    const password   = body.password   || stored.password   || ''
    const totpSecret = body.totpSecret || stored.totpSecret || ''
    const apiKey     = body.apiKey     || stored.apiKey     || process.env.ANGELONE_API_KEY || ''

    if (!clientCode || !password) {
      return NextResponse.json(
        { error: 'Client Code and Password are required' },
        { status: 400 }
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key is required — get it from the Angel One developer portal' },
        { status: 400 }
      )
    }

    // Resolve TOTP: provided code > stored secret > env secret
    let totp = body.totp as string | undefined
    if (!totp && totpSecret) {
      totp = await generateTOTP(totpSecret)
    }
    if (!totp && process.env.ANGELONE_TOTP_SECRET) {
      totp = await generateTOTP(process.env.ANGELONE_TOTP_SECRET)
    }
    if (!totp) {
      return NextResponse.json(
        { error: 'TOTP required — enter your 6-digit code or provide a TOTP secret key for auto-generation' },
        { status: 400 }
      )
    }

    // Save credentials encrypted if requested
    if (body.saveCredentials) {
      const db = getDb()
      db.exec(`CREATE TABLE IF NOT EXISTS broker_credentials (
        broker TEXT PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )`)
      const fields = { clientCode, password, totpSecret, apiKey }
      db.prepare(`
        INSERT OR REPLACE INTO broker_credentials (broker, encrypted_data, updated_at)
        VALUES (?, ?, datetime('now'))
      `).run(broker, encrypt(JSON.stringify(fields)))
      log.info('auth', `Credentials saved (encrypted) for broker: ${broker}`)
    }

    log.info('auth', `Login attempt for client: ${clientCode}`)
    const session = await loginWithCredentials(clientCode, password, totp, apiKey)

    // Persist session to DB
    const db = getDb()
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_jwt',     session.jwtToken)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_feed',    session.feedToken)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_client',  session.clientCode)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_profile', JSON.stringify(session.profile))
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_apikey',  apiKey)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_broker',  'angelone')

    invalidateSession()
    log.trade('auth', `✓ Angel One login successful: ${session.profile?.name ?? clientCode}`)

    // Issue app-level JWT (24h)
    const appToken = await signToken({ userId: 1, clientCode: session.clientCode })

    const response = NextResponse.json({
      success:    true,
      jwtToken:   session.jwtToken,
      feedToken:  session.feedToken,
      clientCode: session.clientCode,
      profile:    session.profile,
      appToken,
    })
    response.cookies.set('openclaw-auth', appToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge:   60 * 60 * 24,
      path:     '/',
    })
    return response
  } catch (err: any) {
    log.error('auth', `Login failed: ${err.message}`)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}
