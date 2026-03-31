import { NextRequest, NextResponse } from 'next/server'
import { getGainersLosers } from '@/lib/nse/client'

export async function GET(req: NextRequest) {
  const index = req.nextUrl.searchParams.get('index') ?? 'NIFTY 50'
  try {
    const data = await getGainersLosers(index)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
