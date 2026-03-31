import { NextResponse } from 'next/server'
import { STRATEGY_TEMPLATES } from '@/lib/options/strategies'

export async function GET() {
  return NextResponse.json({ data: STRATEGY_TEMPLATES })
}
