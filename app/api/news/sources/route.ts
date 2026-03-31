/**
 * Custom RSS feed sources — CRUD
 * GET    /api/news/sources          → list all (built-in + custom)
 * POST   /api/news/sources          → add custom feed { name, url, color? }
 * PATCH  /api/news/sources          → toggle enabled { id, enabled }
 * DELETE /api/news/sources?id=N     → remove custom feed
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RSS_SOURCES } from '@/lib/news/sources'

function ensureTable() {
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
  return db
}

export async function GET() {
  try {
    const db      = ensureTable()
    const custom  = db.prepare('SELECT * FROM custom_rss_sources ORDER BY created_at ASC').all() as any[]
    return NextResponse.json({
      builtIn: RSS_SOURCES,
      custom:  custom.map(r => ({ ...r, enabled: r.enabled === 1 })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, url, color } = await req.json()
    if (!name?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
    }
    // Basic URL validation
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    const db  = ensureTable()
    const res = db.prepare(
      `INSERT INTO custom_rss_sources (name, url, color) VALUES (?, ?, ?)`
    ).run(name.trim(), url.trim(), color?.trim() || '#00ff41')
    return NextResponse.json({ id: res.lastInsertRowid })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Feed URL already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, enabled } = await req.json()
    if (id == null || enabled == null) {
      return NextResponse.json({ error: 'id and enabled are required' }, { status: 400 })
    }
    const db = ensureTable()
    db.prepare(`UPDATE custom_rss_sources SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = ensureTable()
    db.prepare(`DELETE FROM custom_rss_sources WHERE id = ?`).run(Number(id))
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
