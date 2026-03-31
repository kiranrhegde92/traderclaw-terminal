import { NextResponse } from 'next/server'
import { getMarketBreadth } from '@/lib/nse/client'

export async function GET() {
  try {
    const data = await getMarketBreadth()
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
