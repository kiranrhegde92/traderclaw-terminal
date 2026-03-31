/**
 * SSE endpoint for live price streaming
 * GET /api/monitor/prices?symbols=NIFTY,RELIANCE,...
 */
import { NextRequest } from 'next/server'
import { getLTP }      from '@/lib/data/yfinance-proxy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbolsParam     = searchParams.get('symbols') ?? ''
  const symbols          = symbolsParam.split(',').map(s => s.trim()).filter(Boolean)

  if (!symbols.length) {
    return new Response('No symbols', { status: 400 })
  }

  const encoder = new TextEncoder()
  let closed    = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Initial fetch
      const prices = await fetchPrices(symbols)
      send({ type: 'prices', data: prices })

      // Poll every 5 seconds
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return }
        try {
          const p = await fetchPrices(symbols)
          send({ type: 'prices', data: p })
        } catch (e) {
          send({ type: 'error', message: 'Fetch failed' })
        }
      }, 5000)

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return }
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {}
      }, 30000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {}
  await Promise.all(
    symbols.map(async s => {
      try {
        const ltp = await getLTP(s)
        if (ltp) results[s] = ltp
      } catch {}
    })
  )
  return results
}
