import { NextResponse } from 'next/server'
import { getIndices } from '@/lib/nse/client'

export const revalidate = 10  // Next.js: revalidate every 10s

export async function GET() {
  try {
    const data = await getIndices()
    return NextResponse.json({ data }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
