/**
 * Zerodha Kite Connect OAuth callback
 * Kite redirects here after user login: ?request_token=TOKEN&action=login&status=success
 * We exchange request_token → access_token, persist session, redirect to dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateSession, getProfile } from '@/lib/zerodha/client'
import { invalidateZerodhaSession } from '@/lib/zerodha/market'
import { getDb } from '@/lib/db'
import { log } from '@/lib/utils/logger'
import { signToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const requestToken = searchParams.get('request_token')
  const status       = searchParams.get('status')

  if (status !== 'success' || !requestToken) {
    const reason = searchParams.get('message') ?? 'Login cancelled'
    log.warn('auth', `Zerodha OAuth failed: ${reason}`)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, req.url))
  }

  try {
    // Read API key + secret from DB (saved during OAuth initiation)
    const db     = getDb()
    const apiKey = (db.prepare("SELECT value FROM app_config WHERE key='zerodha_api_key_pending'").get() as any)?.value
    const secret = (db.prepare("SELECT value FROM app_config WHERE key='zerodha_api_secret_pending'").get() as any)?.value

    if (!apiKey || !secret) {
      return NextResponse.redirect(new URL('/login?error=Zerodha+API+credentials+not+found', req.url))
    }

    log.info('auth', `Zerodha OAuth: exchanging request_token ${requestToken.slice(0, 8)}…`)
    const session = await generateSession(apiKey, requestToken, secret)

    // Fetch profile
    const profile = await getProfile(apiKey, session.accessToken) ?? {
      userId:   session.userId,
      userName: session.userName,
      email:    session.email,
    }

    // Persist session to DB
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_access_token', session.accessToken)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_api_key',      apiKey)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_user_id',      session.userId)
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('zerodha_profile',      JSON.stringify({ name: profile.userName, email: profile.email }))
    db.prepare(`INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run('session_broker',       'zerodha')

    // Promote pending keys to active, clean up
    db.prepare(`DELETE FROM app_config WHERE key IN ('zerodha_api_key_pending','zerodha_api_secret_pending')`).run()

    invalidateZerodhaSession()
    log.trade('auth', `✓ Zerodha login successful: ${profile.userName} (${session.userId})`)

    // Issue app-level JWT (24h) and set cookie, then redirect
    const appToken = await signToken({ userId: 1, clientCode: session.userId, broker: 'zerodha' })
    const response = NextResponse.redirect(new URL('/', req.url))
    response.cookies.set('openclaw-auth', appToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge:   60 * 60 * 24,
      path:     '/',
    })
    return response
  } catch (err: any) {
    log.error('auth', `Zerodha callback failed: ${err.message}`)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent('Zerodha authentication failed')}`, req.url)
    )
  }
}
