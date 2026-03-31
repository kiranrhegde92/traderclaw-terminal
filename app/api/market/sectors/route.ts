import { NextResponse } from 'next/server'
import { getSectorData } from '@/lib/nse/client'

export async function GET() {
  try {
    const data = await getSectorData()
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
