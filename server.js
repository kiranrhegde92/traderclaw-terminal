/**
 * server.js — Custom Next.js server with WebSocket support
 * Handles:
 *  - WebSocket connections for real-time price streaming
 *  - Angel One WebSocket proxy
 *  - SSE broadcast for connected browsers
 *
 * Run: node server.js (dev) | NODE_ENV=production node server.js (prod)
 */
const { createServer } = require('http')
const { parse }        = require('url')
const next             = require('next')
const { WebSocketServer, WebSocket } = require('ws')

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

/* ─── Price Store ────────────────────────────────────────────────────── */
const priceStore = new Map()   // symbol → { ltp, chg, chgPct, timestamp }
const subscribers = new Set()  // Set<WebSocket>

function broadcastPrices() {
  if (subscribers.size === 0) return
  const payload = JSON.stringify({
    type: 'prices',
    data: Object.fromEntries(priceStore),
  })
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    } else {
      subscribers.delete(ws)
    }
  }
}

/* ─── Price fetcher (yfinance fallback) ──────────────────────────────── */
let fetchInProgress = false

async function fetchYFPrice(symbols) {
  if (fetchInProgress || symbols.length === 0) return
  fetchInProgress = true
  try {
    // Batch fetch from Yahoo Finance
    for (const symbol of symbols) {
      try {
        const ticker = symbolToYF(symbol)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`
        const res  = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        })
        if (!res.ok) continue
        const json = await res.json()
        const meta = json?.chart?.result?.[0]?.meta
        if (meta) {
          priceStore.set(symbol, {
            ltp:       meta.regularMarketPrice,
            chg:       meta.regularMarketPrice - meta.previousClose,
            chgPct:    ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
            timestamp: Date.now(),
          })
        }
      } catch {}
    }
    broadcastPrices()
  } finally {
    fetchInProgress = false
  }
}

function symbolToYF(symbol) {
  const indexMap = {
    'NIFTY 50':      '^NSEI',
    'NIFTY':         '^NSEI',
    'BANKNIFTY':     '^NSEBANK',
    'SENSEX':        '^BSESN',
    'NIFTYIT':       '^CNXIT',
    'FINNIFTY':      'NIFTY_FIN_SERVICE.NS',
    'MIDCPNIFTY':    '^NSMIDCP',
  }
  return indexMap[symbol] ?? `${symbol}.NS`
}

/* ─── Angel One WebSocket Proxy ─────────────────────────────────────── */
let angelOneWS = null
let angelTokens = { jwtToken: '', feedToken: '', clientCode: '' }

function connectAngelOneWS(jwtToken, feedToken, clientCode, symbols) {
  if (angelOneWS) angelOneWS.terminate()
  angelTokens = { jwtToken, feedToken, clientCode }

  const ws = new WebSocket('wss://smartapisocket.angelbroking.com/smart-stream', {
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      'x-client-code': clientCode,
      'x-feed-token':  feedToken,
    },
  })

  angelOneWS = ws

  ws.on('open', () => {
    console.log('[WS] Angel One connected')
    // Subscribe to LTP mode for all symbols
    const subMsg = {
      correlationID: 'openclaw',
      action: 1,
      params: {
        mode: 1,
        tokenList: symbols.map(s => ({ exchangeType: 1, tokens: [s] })),
      },
    }
    ws.send(JSON.stringify(subMsg))
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.last_traded_price) {
        const ltp    = msg.last_traded_price / 100
        const symbol = msg.trading_symbol
        const prev   = priceStore.get(symbol)
        priceStore.set(symbol, {
          ltp,
          chg:       prev ? ltp - prev.ltp : 0,
          chgPct:    prev && prev.ltp ? ((ltp - prev.ltp) / prev.ltp) * 100 : 0,
          timestamp: Date.now(),
        })
      }
    } catch {}
    broadcastPrices()
  })

  ws.on('close', () => {
    console.log('[WS] Angel One disconnected')
    angelOneWS = null
  })

  ws.on('error', (err) => {
    console.error('[WS] Angel One error:', err.message)
  })
}

/* ─── Start Server ───────────────────────────────────────────────────── */
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  /* Browser WebSocket server */
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws, req) => {
    console.log('[WS] Browser client connected')
    subscribers.add(ws)

    // Send current prices immediately
    if (priceStore.size > 0) {
      ws.send(JSON.stringify({ type: 'prices', data: Object.fromEntries(priceStore) }))
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'subscribe') {
          const syms = msg.symbols || []
          // Start polling for these symbols
          fetchYFPrice(syms)
        }
        if (msg.type === 'angel-connect') {
          connectAngelOneWS(msg.jwtToken, msg.feedToken, msg.clientCode, msg.symbols || [])
        }
      } catch {}
    })

    ws.on('close', () => {
      subscribers.delete(ws)
      console.log('[WS] Browser client disconnected')
    })
  })

  /* Upgrade HTTP → WebSocket */
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  /* Default YF polling every 5s when no Angel One WS */
  const defaultSymbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX', 'NIFTYIT']
  setInterval(() => {
    if (!angelOneWS) fetchYFPrice(defaultSymbols)
  }, 5000)

  server.listen(port, '0.0.0.0', () => {
    // Find local network IP for mobile access
    const { networkInterfaces } = require('os')
    const nets = networkInterfaces()
    let localIP = 'localhost'
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break }
      }
    }
    console.log(`
╔══════════════════════════════════════════════╗
║   TraderClaw Terminal — ${dev ? 'DEVELOPMENT' : 'PRODUCTION'}         ║
║   Local:   http://localhost:${port}             ║
║   Network: http://${localIP}:${port}           ║
║   WebSocket: ws://${localIP}:${port}/ws        ║
╚══════════════════════════════════════════════╝
    `)
  })
})
