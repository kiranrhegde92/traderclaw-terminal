import { NextResponse } from 'next/server'

/* Mock 30-day NIFTY 50 history — percentage returns from a base date */
function generateNiftyHistory() {
  const today = new Date()
  const points: { date: string; close: number }[] = []

  // Simulated NIFTY trajectory over 30 days (realistic-ish)
  const deltas = [
    0, 0.45, -0.32, 0.78, 0.15, -0.55, 0.92, 0.28, -0.18, 0.63,
    -0.41, 0.35, 0.71, -0.60, 0.48, 0.22, -0.30, 0.85, 0.16, -0.44,
    0.57, 0.33, -0.21, 0.69, -0.38, 0.52, 0.19, 0.74, -0.26, 0.41,
  ]

  let cumulative = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayIndex = 29 - i
    cumulative += deltas[dayIndex] ?? 0
    points.push({
      date: d.toISOString().slice(0, 10),
      close: parseFloat(cumulative.toFixed(4)),
    })
  }

  return points
}

export async function GET() {
  const history = generateNiftyHistory()
  return NextResponse.json({ symbol: 'NIFTY', data: history })
}
