import { RSS_SOURCES } from './sources'
import { detectSentiment, extractAffectedStocks } from './impact-analyzer'
import type { NewsItem } from '@/types/news'

interface RawItem {
  title?:   string
  link?:    string
  pubDate?: string
  contentSnippet?: string
  content?: string
}

/** Load enabled custom RSS sources from DB */
function loadCustomSources(): Array<{ id: string; name: string; url: string }> {
  try {
    const { getDb } = require('@/lib/db') as typeof import('@/lib/db')
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_rss_sources (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        url        TEXT NOT NULL UNIQUE,
        color      TEXT NOT NULL DEFAULT '#00ff41',
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    const rows = db.prepare(`SELECT id, name, url FROM custom_rss_sources WHERE enabled = 1`).all() as any[]
    return rows.map(r => ({ id: `custom_${r.id}`, name: r.name, url: r.url }))
  } catch { return [] }
}

/** Parse a single RSS feed */
async function parseFeed(source: { id: string; name: string; url: string }) {
  try {
    const { default: Parser } = await import('rss-parser')
    const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'OpenClaw/1.0' } })
    const feed   = await parser.parseURL(source.url)
    return (feed.items ?? []).map((item: RawItem) => ({ item, sourceId: source.id }))
  } catch (err) {
    console.error(`[RSS] Failed to parse ${source.id}:`, err)
    return []
  }
}

/** Fetch and parse all news feeds (built-in + enabled custom) */
export async function fetchAllNews(limit = 50): Promise<Omit<NewsItem, 'id' | 'isRead'>[]> {
  const allSources = [...RSS_SOURCES, ...loadCustomSources()]
  const results = await Promise.allSettled(allSources.map(s => parseFeed(s)))

  const allItems: Array<{ item: RawItem; sourceId: string }> = []
  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value)
  }

  // Sort by published date descending
  allItems.sort((a, b) => {
    const da = new Date(a.item.pubDate ?? 0).getTime()
    const db = new Date(b.item.pubDate ?? 0).getTime()
    return db - da
  })

  return allItems.slice(0, limit).map(({ item, sourceId }) => {
    const title   = item.title?.trim() ?? ''
    const summary = item.contentSnippet?.trim() ?? item.content?.replace(/<[^>]+>/g, '').trim() ?? ''
    const text    = `${title} ${summary}`

    return {
      title,
      url:            item.link ?? '',
      source:         sourceId,
      summary:        summary.slice(0, 400),
      publishedAt:    item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      fetchedAt:      new Date().toISOString(),
      sentiment:      detectSentiment(text),
      affectedStocks: extractAffectedStocks(title, summary),
    }
  })
}
