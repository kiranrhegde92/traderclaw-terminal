import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(`SELECT * FROM news_keywords ORDER BY created_at DESC`).all()
    return NextResponse.json({ data: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json()
    if (!keyword?.trim()) return NextResponse.json({ error: 'keyword required' }, { status: 400 })
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO news_keywords (keyword) VALUES (?) ON CONFLICT(keyword) DO NOTHING`
    ).run(keyword.trim().toLowerCase())
    const row = db.prepare(`SELECT * FROM news_keywords WHERE keyword = ?`).get(keyword.trim().toLowerCase())
    return NextResponse.json({ data: row })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = getDb()
    db.prepare(`DELETE FROM news_keywords WHERE id = ?`).run(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
