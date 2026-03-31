import { NextRequest, NextResponse } from 'next/server'

interface Snapshot { time: string; pnl: number; invested: number }

// In-memory store: date (YYYY-MM-DD IST) → sorted snapshots
const store = new Map<string, Snapshot[]>()

function istNow() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const iso  = now.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) } // HH:MM
}

export async function GET() {
  const { date } = istNow()
  return NextResponse.json({ data: store.get(date) ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pnl      = Number(body.pnl      ?? 0)
  const invested = Number(body.invested  ?? 0)
  if (!isFinite(pnl)) return NextResponse.json({ ok: false })

  const { date, time } = istNow()
  if (!store.has(date)) {
    // Purge old dates when a new day starts
    store.clear()
    store.set(date, [])
  }
  const snaps = store.get(date)!

  // Deduplicate by minute — only one snapshot per minute
  const last = snaps[snaps.length - 1]
  if (!last || last.time !== time) {
    snaps.push({ time, pnl, invested })
  } else {
    // Update last snapshot with latest value
    last.pnl      = pnl
    last.invested = invested
  }

  return NextResponse.json({ ok: true, count: snaps.length })
}
