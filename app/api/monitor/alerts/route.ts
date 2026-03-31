import { NextRequest, NextResponse } from 'next/server'
import { getAlerts, createAlert, deleteAlert } from '@/lib/db/queries/alerts'
import { z } from 'zod'

const AlertSchema = z.object({
  symbol:    z.string().min(1).max(50),
  alertType: z.string().min(1).max(50),
  condition: z.record(z.unknown()).optional(),
  exchange:  z.string().optional(),
  value:     z.number().optional(),
})

export async function GET() {
  const data = getAlerts()
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = AlertSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.errors },
      { status: 400 }
    )
  }
  const { symbol, alertType, condition, exchange } = parsed.data
  const id = createAlert(symbol, alertType, condition ?? {}, exchange)
  return NextResponse.json({ success: true, id })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  deleteAlert(id)
  return NextResponse.json({ success: true })
}
