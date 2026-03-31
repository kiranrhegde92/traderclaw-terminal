/**
 * GET /api/prices/stream?symbols=NIFTY:NSE,RELIANCE:NSE
 *
 * Server-Sent Events endpoint — pushes real-time price ticks to the browser.
 * Works through Cloudflare tunnel (pure HTTP, no raw WebSocket needed in browser).
 */

import { subscribe } from '@/lib/openalgo/ws-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url      = new URL(req.url)
  const raw      = url.searchParams.get('symbols') ?? ''   // "NIFTY:NSE,RELIANCE:NSE"
  const pairs    = raw.split(',').filter(Boolean).map(s => {
    const [symbol, exchange = 'NSE'] = s.trim().toUpperCase().split(':')
    return { symbol, exchange }
  })

  if (!pairs.length) {
    return new Response('Missing ?symbols=', { status: 400 })
  }

  let controller: ReadableStreamDefaultController<Uint8Array>
  const enc      = new TextEncoder()
  const unsubs:  Array<() => void> = []

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl

      function send(data: object) {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      // Send connected event
      send({ type: 'connected', symbols: pairs, ts: Date.now() })

      // Subscribe each symbol
      pairs.forEach(({ symbol, exchange }) => {
        const unsub = subscribe(symbol, exchange, tick => send(tick))
        unsubs.push(unsub)
      })

      // Heartbeat every 20s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 20_000)

      // Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubs.forEach(u => u())
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // Disable nginx buffering
    },
  })
}
