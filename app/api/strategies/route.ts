import { NextRequest, NextResponse } from 'next/server'
import { getStrategies, createStrategy, updateStrategyLegs, deleteStrategy } from '@/lib/db/queries/strategies'

export async function GET() {
  const data = getStrategies()
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body   = await req.json()
  const id     = createStrategy(body)
  return NextResponse.json({ success: true, id })
}

export async function PUT(req: NextRequest) {
  const { id, legs } = await req.json()
  updateStrategyLegs(id, legs)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  deleteStrategy(id)
  return NextResponse.json({ success: true })
}
