/**
 * OpenAlgo WebSocket price feed — server-side singleton
 * Maintains ONE persistent WS connection to OpenAlgo at port 8765.
 * Uses globalThis to survive Next.js HMR reloads in dev mode.
 */

import WebSocket from 'ws'

const OA_WS_URL = `ws://127.0.0.1:${process.env.OPENALGO_WS_PORT ?? '8765'}`
const OA_API_KEY = process.env.OPENALGO_API_KEY ?? ''

export interface PriceTick {
  symbol:    string
  exchange:  string
  ltp:       number
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
  change:    number
  changePct: number
  timestamp: number
}

type Listener = (tick: PriceTick) => void

// ─── Global singleton (survives HMR in Next.js dev mode) ─────────────────────

interface WsFeedState {
  ws:         WebSocket | null
  authed:     boolean
  reconnectT: ReturnType<typeof setTimeout> | null
  listeners:  Map<string, Set<Listener>>
  latestTick: Map<string, PriceTick>
}

const g = globalThis as any
if (!g.__oaFeed) {
  g.__oaFeed = {
    ws:         null,
    authed:     false,
    reconnectT: null,
    listeners:  new Map<string, Set<Listener>>(),
    latestTick: new Map<string, PriceTick>(),
  } satisfies WsFeedState
}

const state: WsFeedState = g.__oaFeed

function key(symbol: string, exchange: string) {
  return `${symbol.toUpperCase()}:${exchange.toUpperCase()}`
}

// ─── WebSocket lifecycle ──────────────────────────────────────────────────────

function connect() {
  const s = state
  if (s.ws && (s.ws.readyState === WebSocket.OPEN || s.ws.readyState === WebSocket.CONNECTING)) return

  console.log('[ws-feed] connecting to', OA_WS_URL, 'key:', OA_API_KEY.slice(0, 8) + '...')
  const ws = new WebSocket(OA_WS_URL)
  s.ws = ws

  ws.on('open', () => {
    console.log('[ws-feed] open — authenticating')
    s.authed = false
    ws.send(JSON.stringify({ action: 'authenticate', apikey: OA_API_KEY }))
  })

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      console.log('[ws-feed] msg:', msg.type, msg.status ?? '')

      if (msg.type === 'auth' && msg.status === 'success') {
        console.log('[ws-feed] authenticated!')
        s.authed = true
        resubscribeAll()
        return
      }

      if (msg.type === 'auth' && msg.status !== 'success') {
        console.error('[ws-feed] auth failed:', msg)
        return
      }

      if (msg.type === 'market_data' && msg.data) {
        const d = msg.data
        const chg    = (d.ltp ?? 0) - (d.close ?? 0)
        const chgPct = d.close ? (chg / d.close) * 100 : 0
        const tick: PriceTick = {
          symbol:    msg.symbol,
          exchange:  msg.exchange,
          ltp:       d.ltp    ?? 0,
          open:      d.open   ?? 0,
          high:      d.high   ?? 0,
          low:       d.low    ?? 0,
          close:     d.close  ?? 0,
          volume:    d.volume ?? 0,
          change:    parseFloat(chg.toFixed(2)),
          changePct: parseFloat(chgPct.toFixed(2)),
          timestamp: Date.now(),
        }

        const k = key(tick.symbol, tick.exchange)
        s.latestTick.set(k, tick)

        const subs = s.listeners.get(k)
        if (subs) subs.forEach(fn => fn(tick))
      }
    } catch (e) {
      console.error('[ws-feed] parse error:', e)
    }
  })

  ws.on('close', (code, reason) => {
    console.log('[ws-feed] closed', code, reason.toString())
    s.authed = false
    if (s.ws === ws) s.ws = null
    scheduleReconnect()
  })

  ws.on('error', (e) => {
    console.error('[ws-feed] error:', e.message)
    s.authed = false
    if (s.ws === ws) s.ws = null
    scheduleReconnect()
  })
}

function scheduleReconnect() {
  if (state.reconnectT) return
  state.reconnectT = setTimeout(() => {
    state.reconnectT = null
    connect()
  }, 3000)
}

function resubscribeAll() {
  const s = state
  if (!s.authed || !s.ws || s.ws.readyState !== WebSocket.OPEN) return
  const symbols: { symbol: string; exchange: string; mode: number }[] = []
  s.listeners.forEach((subs, k) => {
    if (subs.size > 0) {
      const [symbol, exchange] = k.split(':')
      symbols.push({ symbol, exchange, mode: 2 })
    }
  })
  if (symbols.length > 0) {
    console.log('[ws-feed] resubscribing', symbols.length, 'symbols')
    s.ws.send(JSON.stringify({ action: 'subscribe', symbols }))
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function subscribe(symbol: string, exchange: string, listener: Listener): () => void {
  const s = state
  const k = key(symbol, exchange)

  if (!s.listeners.has(k)) s.listeners.set(k, new Set())
  s.listeners.get(k)!.add(listener)

  // Send latest cached tick immediately
  const cached = s.latestTick.get(k)
  if (cached) listener(cached)

  // Ensure connection is up
  connect()

  // Subscribe this symbol if WS is ready
  if (s.authed && s.ws?.readyState === WebSocket.OPEN) {
    s.ws.send(JSON.stringify({
      action:  'subscribe',
      symbols: [{ symbol: symbol.toUpperCase(), exchange: exchange.toUpperCase(), mode: 2 }],
    }))
  }

  return () => {
    const set = s.listeners.get(k)
    if (!set) return
    set.delete(listener)
    if (set.size === 0) {
      s.listeners.delete(k)
      s.latestTick.delete(k)
      if (s.authed && s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({
          action:  'unsubscribe',
          symbols: [{ symbol: symbol.toUpperCase(), exchange: exchange.toUpperCase() }],
        }))
      }
    }
  }
}

export function getLatestTick(symbol: string, exchange: string): PriceTick | null {
  return state.latestTick.get(key(symbol, exchange)) ?? null
}

export function getConnectionStatus() {
  const s = state
  if (!s.ws) return 'disconnected'
  if (s.ws.readyState === WebSocket.CONNECTING) return 'connecting'
  if (s.ws.readyState === WebSocket.OPEN)       return s.authed ? 'connected' : 'authenticating'
  return 'disconnected'
}

// Auto-connect on module load (only if not already connected)
connect()
