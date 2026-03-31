import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { extractAffectedStocks, detectSentiment } from '@/lib/news/impact-analyzer'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    const db = getDb()
    const item = db.prepare(`SELECT * FROM news_items WHERE id = ?`).get(id) as any
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const affectedStocks = extractAffectedStocks(item.title, item.summary ?? '')
    const sentiment = detectSentiment(`${item.title} ${item.summary ?? ''}`)

    return NextResponse.json({
      data: {
        id: item.id,
        title: item.title,
        sentiment,
        affectedStocks,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
