/**
 * OpenAlgo unified REST client
 * Talks to the local OpenAlgo server (http://localhost:5000)
 * Falls back to direct Angel One calls when OpenAlgo is unavailable.
 */

const OPENALGO_URL  = process.env.OPENALGO_URL  ?? 'http://127.0.0.1:5000'
const OPENALGO_KEY  = process.env.OPENALGO_API_KEY ?? ''

// ─── helpers ─────────────────────────────────────────────────────────────────

async function post<T = any>(path: string, body?: object): Promise<T> {
  const res  = await fetch(`${OPENALGO_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ apikey: OPENALGO_KEY, ...body }),
    signal:  AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenAlgo ${path} → HTTP ${res.status}`)
  return res.json()
}

async function get_<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${OPENALGO_URL}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': OPENALGO_KEY },
    signal:  AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenAlgo GET ${path} → HTTP ${res.status}`)
  return res.json()
}

// ─── Account ─────────────────────────────────────────────────────────────────

export async function getFunds() {
  const data = await post('/api/v1/funds')
  return data?.data ?? data
}

export async function getHoldings() {
  const data = await post('/api/v1/holdings')
  // OpenAlgo returns { data: { holdings: [...], statistics: {...} } }
  return data?.data?.holdings ?? data?.data ?? []
}

export async function getPositions() {
  const data = await post('/api/v1/positionbook')
  return data?.data ?? []
}

export async function getOrderBook() {
  const data = await post('/api/v1/orderbook')
  return data?.data ?? []
}

export async function getTradeBook() {
  const data = await post('/api/v1/tradebook')
  return data?.data ?? []
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface OrderParams {
  symbol:          string
  exchange:        'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX' | 'CDS'
  action:          'BUY' | 'SELL'
  quantity:        number
  price?:          number
  trigger_price?:  number
  product:         'CNC' | 'MIS' | 'NRML'
  order_type:      'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
  validity?:       'DAY' | 'IOC'
  disclosed_quantity?: number
  strategy_tag?:   string
}

export async function placeOrder(params: OrderParams) {
  return post('/api/v1/placeorder', {
    symbol:         params.symbol,
    exchange:       params.exchange,
    action:         params.action,
    quantity:       params.quantity,
    price:          params.price ?? 0,
    trigger_price:  params.trigger_price ?? 0,
    product:        params.product,
    order_type:     params.order_type,
    validity:       params.validity ?? 'DAY',
    disclosed_quantity: params.disclosed_quantity ?? 0,
    strategy_tag:   params.strategy_tag ?? 'openclaw',
  })
}

export async function modifyOrder(orderId: string, params: Partial<OrderParams>) {
  return post('/api/v1/modifyorder', { orderid: orderId, ...params })
}

export async function cancelOrder(orderId: string, strategy?: string) {
  return post('/api/v1/cancelorder', { orderid: orderId, strategy: strategy ?? 'openclaw' })
}

export async function cancelAllOrders() {
  return post('/api/v1/cancelallorder', { strategy: 'openclaw' })
}

// ─── Basket Orders (multi-leg strategies) ────────────────────────────────────

export interface BasketLeg {
  symbol:     string
  exchange:   string
  action:     'BUY' | 'SELL'
  quantity:   number
  price?:     number
  order_type: 'MARKET' | 'LIMIT'
  product:    'MIS' | 'NRML' | 'CNC'
}

export async function placeBasketOrder(legs: BasketLeg[], tag = 'openclaw') {
  const orders = legs.map(leg => ({
    symbol:         leg.symbol,
    exchange:       leg.exchange,
    action:         leg.action,
    quantity:       leg.quantity,
    price:          leg.price ?? 0,
    trigger_price:  0,
    product:        leg.product,
    order_type:     leg.order_type,
    validity:       'DAY',
    disclosed_quantity: 0,
    strategy_tag:   tag,
  }))
  return post('/api/v1/basketorder', { orders })
}

// ─── Market Data ─────────────────────────────────────────────────────────────

export async function getQuote(symbol: string, exchange: string) {
  return post('/api/v1/quotes', { symbol, exchange })
}

export async function getDepth(symbol: string, exchange: string) {
  return post('/api/v1/depth', { symbol, exchange })
}

export async function getHistoricalData(params: {
  symbol:   string
  exchange: string
  interval: string     // '1m' | '5m' | '15m' | '30m' | '1h' | '1d'
  start:    string     // 'YYYY-MM-DD HH:mm'
  end:      string
}) {
  return post('/api/v1/history', params)
}

// ─── Margins ─────────────────────────────────────────────────────────────────

export async function getMarginRequired(legs: BasketLeg[]) {
  return post('/api/v1/margin', { orders: legs })
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function isOpenAlgoUp(): Promise<boolean> {
  try {
    const res = await fetch(`${OPENALGO_URL}/api/v1/funds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ apikey: OPENALGO_KEY }),
      signal:  AbortSignal.timeout(3_000),
    })
    return res.status !== 502 && res.status !== 503 && res.status !== 0
  } catch { return false }
}

export const OPENALGO = {
  url:    OPENALGO_URL,
  apiKey: OPENALGO_KEY,
  wsUrl:  `ws://127.0.0.1:${process.env.OPENALGO_WS_PORT ?? '8765'}`,
}
