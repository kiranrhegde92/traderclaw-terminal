import { NextRequest, NextResponse } from 'next/server'
import { fetchAllNews } from '@/lib/news/rss-parser'
import { getDb } from '@/lib/db'
import { log } from '@/lib/utils/logger'

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams
  const limit  = parseInt(sp.get('limit') ?? '50')
  const offset = parseInt(sp.get('offset') ?? '0')
  const source = sp.get('source') ?? ''

  try {
    const db = getDb()

    // Try to return cached news from DB first
    let dbQuery = source
      ? `SELECT * FROM news_items WHERE source = ? ORDER BY published_at DESC LIMIT ? OFFSET ?`
      : `SELECT * FROM news_items ORDER BY published_at DESC LIMIT ? OFFSET ?`

    const args = source ? [source, limit, offset] : [limit, offset]
    const cached = db.prepare(dbQuery).all(...args) as any[]

    // If cache is fresh (< 2 min old), return it
    if (cached.length > 0) {
      const newest = new Date(cached[0].fetched_at ?? 0).getTime()
      if (Date.now() - newest < 120_000) {
        return NextResponse.json({
          data: cached.map(n => ({
            ...n,
            affectedStocks: n.affected_symbols_json ? JSON.parse(n.affected_symbols_json) : [],
          }))
        })
      }
    }

    // Fetch fresh news
    log.info('news', 'Fetching fresh news from RSS feeds...')
    const items = await fetchAllNews(100)

    // Upsert into DB
    const upsert = db.prepare(`
      INSERT OR IGNORE INTO news_items (title, url, source, summary, published_at, sentiment, affected_symbols_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    type NewsItem = (typeof items)[number]
    const insertMany = db.transaction((items: NewsItem[]) => {
      for (const item of items) {
        upsert.run(
          item.title, item.url, item.source, item.summary ?? null,
          item.publishedAt, item.sentiment ?? null,
          item.affectedStocks.length ? JSON.stringify(item.affectedStocks) : null
        )
      }
    })
    insertMany(items)

    log.info('news', `Stored ${items.length} news items`)

    // Return from DB
    const fresh = db.prepare(
      source
        ? `SELECT * FROM news_items WHERE source = ? ORDER BY published_at DESC LIMIT ? OFFSET ?`
        : `SELECT * FROM news_items ORDER BY published_at DESC LIMIT ? OFFSET ?`
    ).all(...args) as any[]

    return NextResponse.json({
      data: fresh.map(n => ({
        ...n,
        affectedStocks: n.affected_symbols_json ? JSON.parse(n.affected_symbols_json) : [],
      }))
    })
  } catch (err: any) {
    log.error('news', `Feed fetch failed: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
