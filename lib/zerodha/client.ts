/**
 * Zerodha Kite Connect v3 client
 * OAuth flow: user → kite.trade/connect/login → our /callback with request_token
 * We exchange request_token for access_token using sha256(apiKey+requestToken+apiSecret)
 */
import crypto from 'crypto'
import { log } from '@/lib/utils/logger'

const KITE_API = 'https://api.kite.trade'

export interface ZerodhaSession {
  accessToken: string
  userId:      string
  userName:    string
  email:       string
  loginTime:   string
}

/**
 * Exchange request_token (from OAuth redirect) for an access_token.
 * checksum = sha256(api_key + request_token + api_secret)
 */
export async function generateSession(
  apiKey:       string,
  requestToken: string,
  apiSecret:    string,
): Promise<ZerodhaSession> {
  const checksum = crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')

  log.info('zerodha', `Generating session for request_token: ${requestToken.slice(0, 8)}…`)

  const res = await fetch(`${KITE_API}/session/token`, {
    method:  'POST',
    headers: {
      'X-Kite-Version':   '3',
      'Content-Type':     'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }),
  })

  const data = await res.json()

  if (!res.ok || data.status !== 'success') {
    throw new Error(data.message ?? `Zerodha session generation failed (${res.status})`)
  }

  const d = data.data
  return {
    accessToken: d.access_token,
    userId:      d.user_id,
    userName:    d.user_name ?? d.user_id,
    email:       d.email ?? '',
    loginTime:   d.login_time ?? new Date().toISOString(),
  }
}

/** Standard headers for authenticated Kite Connect API calls */
export function kiteHeaders(apiKey: string, accessToken: string): Record<string, string> {
  return {
    'X-Kite-Version': '3',
    'Authorization':  `token ${apiKey}:${accessToken}`,
    'Content-Type':   'application/json',
  }
}

/** Build the Kite Connect OAuth login URL */
export function kiteLoginUrl(apiKey: string): string {
  return `https://kite.trade/connect/login?api_key=${encodeURIComponent(apiKey)}&v=3`
}

/** Fetch the authenticated user's profile */
export async function getProfile(
  apiKey: string,
  accessToken: string,
): Promise<{ userId: string; userName: string; email: string } | null> {
  try {
    const res = await fetch('https://api.kite.trade/user/profile', {
      headers: kiteHeaders(apiKey, accessToken),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!res.ok || data.status !== 'success') return null
    const d = data.data
    return { userId: d.user_id, userName: d.user_name ?? d.user_id, email: d.email ?? '' }
  } catch { return null }
}

/** Fetch portfolio holdings */
export async function getHoldings(apiKey: string, accessToken: string): Promise<any[]> {
  try {
    const res  = await fetch('https://api.kite.trade/portfolio/holdings', {
      headers: kiteHeaders(apiKey, accessToken),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    return data?.data ?? []
  } catch { return [] }
}

/** Fetch open positions */
export async function getPositions(apiKey: string, accessToken: string): Promise<any[]> {
  try {
    const res  = await fetch('https://api.kite.trade/portfolio/positions', {
      headers: kiteHeaders(apiKey, accessToken),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    // Kite returns { net: [...], day: [...] }
    return data?.data?.net ?? data?.data ?? []
  } catch { return [] }
}
