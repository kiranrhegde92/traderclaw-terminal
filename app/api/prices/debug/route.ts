import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.OPENALGO_API_KEY ?? '(not set)'
  const wsUrl  = `ws://127.0.0.1:${process.env.OPENALGO_WS_PORT ?? '8765'}`

  // Test WS directly from this route
  const WebSocket = (await import('ws')).default
  const result = await new Promise<any>((resolve) => {
    const ws = new WebSocket(wsUrl)
    const timeout = setTimeout(() => resolve({ error: 'timeout' }), 5000)
    ws.on('open', () => {
      ws.send(JSON.stringify({ action: 'authenticate', apikey: apiKey }))
    })
    ws.on('message', (data) => {
      clearTimeout(timeout)
      try { resolve(JSON.parse(data.toString())) } catch { resolve({ raw: data.toString() }) }
      ws.close()
    })
    ws.on('error', (e) => { clearTimeout(timeout); resolve({ error: e.message }) })
  })

  return NextResponse.json({ apiKey: apiKey.slice(0, 8) + '...', wsUrl, authResult: result })
}
