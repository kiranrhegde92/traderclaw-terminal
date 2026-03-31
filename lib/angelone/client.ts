/**
 * Angel One SmartAPI client wrapper
 * Uses direct HTTPS calls to Angel One REST API
 * (smartapi-javascript npm package fails under webpack/Next.js due to public-ip dep)
 */
import { log } from '@/lib/utils/logger'

const BASE = 'https://apiconnect.angelbroking.com'

/** Shared headers for all Angel One API requests */
export function commonHeaders(apiKey: string, jwtToken?: string) {
  const h: Record<string, string> = {
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'X-UserType':      'USER',
    'X-SourceID':      'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP':'127.0.0.1',
    'X-MACAddress':    '00:00:00:00:00:00',
    'X-PrivateKey':    apiKey,
  }
  if (jwtToken) h['Authorization'] = `Bearer ${jwtToken}`
  return h
}

export interface AngelOneSession {
  jwtToken:     string
  refreshToken: string
  feedToken:    string
  clientCode:   string
  profile?: {
    name:  string
    email: string
  }
}

/** Login with credentials (server-side only) */
export async function loginWithCredentials(
  clientCode: string,
  password:   string,
  totp:       string,
  apiKey:     string
): Promise<AngelOneSession> {
  // Step 1: Generate session
  const loginRes = await fetch(
    `${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
    {
      method:  'POST',
      headers: commonHeaders(apiKey),
      body:    JSON.stringify({ clientcode: clientCode, password, totp }),
    }
  )
  const loginJson = await loginRes.json()
  if (!loginJson?.status || !loginJson?.data?.jwtToken) {
    throw new Error(loginJson?.message ?? `Login failed (${loginRes.status})`)
  }
  const { jwtToken, refreshToken, feedToken } = loginJson.data

  // Step 2: Fetch profile
  let name = clientCode, email = ''
  try {
    const profileRes = await fetch(
      `${BASE}/rest/secure/angelbroking/user/v1/getProfile`,
      { headers: commonHeaders(apiKey, jwtToken) }
    )
    const profileJson = await profileRes.json()
    name  = profileJson?.data?.name  ?? clientCode
    email = profileJson?.data?.email ?? ''
  } catch { /* profile fetch failure is non-fatal */ }

  return { jwtToken, refreshToken, feedToken, clientCode, profile: { name, email } }
}

/** Fetch portfolio holdings */
export async function getHoldings(jwtToken: string, apiKey: string) {
  try {
    const res  = await fetch(`${BASE}/rest/secure/angelbroking/portfolio/v1/getHolding`,
      { headers: commonHeaders(apiKey, jwtToken) })
    const json = await res.json()
    return json?.data ?? []
  } catch (err) {
    log.error('angelone', `getHoldings failed: ${err}`)
    return []
  }
}

/** Fetch open positions */
export async function getPositions(jwtToken: string, apiKey: string) {
  try {
    const res  = await fetch(`${BASE}/rest/secure/angelbroking/order/v1/getPosition`,
      { headers: commonHeaders(apiKey, jwtToken) })
    const json = await res.json()
    return json?.data ?? []
  } catch (err) {
    log.error('angelone', `getPositions failed: ${err}`)
    return []
  }
}

/** Place an order */
export async function placeOrder(jwtToken: string, apiKey: string, params: {
  variety:         string
  tradingsymbol:   string
  symboltoken:     string
  transactiontype: string
  exchange:        string
  ordertype:       string
  producttype:     string
  duration:        string
  price:           string
  squareoff:       string
  stoploss:        string
  quantity:        string
}) {
  const res = await fetch(`${BASE}/rest/secure/angelbroking/order/v1/placeOrder`, {
    method:  'POST',
    headers: commonHeaders(apiKey, jwtToken),
    body:    JSON.stringify(params),
  })
  return res.json()
}

/** Get historical candle data */
export async function getHistoricalData(jwtToken: string, apiKey: string, params: {
  exchange:    string
  symboltoken: string
  interval:    string
  fromdate:    string
  todate:      string
}) {
  try {
    const res  = await fetch(`${BASE}/rest/secure/angelbroking/historical/v1/getCandleData`, {
      method:  'POST',
      headers: commonHeaders(apiKey, jwtToken),
      body:    JSON.stringify(params),
    })
    const json = await res.json()
    if (!json?.data) return []
    return json.data.map((d: any[]) => ({
      time:   Math.floor(new Date(d[0]).getTime() / 1000),
      open:   d[1], high: d[2], low: d[3], close: d[4], volume: d[5],
    }))
  } catch (err) {
    log.error('angelone', `getHistoricalData failed: ${err}`)
    return []
  }
}
