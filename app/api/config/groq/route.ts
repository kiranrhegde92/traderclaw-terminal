import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

const CONFIG_KEY = 'groq_api_key'

export async function GET() {
  try {
    const db  = getDb()
    const row = db.prepare(`SELECT value FROM app_config WHERE key = ? LIMIT 1`).get(CONFIG_KEY) as any
    return NextResponse.json({ configured: !!row?.value })
  } catch (err: any) {
    return NextResponse.json({ configured: false, error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json()
    if (!apiKey?.trim()) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 })
    }

    // Quick validation — list models endpoint
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: res.status === 401 ? 'Invalid API key' : `Groq error: ${res.status}` },
        { status: 400 }
      )
    }

    const db        = getDb()
    const encrypted = encrypt(apiKey.trim())
    db.prepare(
      `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    ).run(CONFIG_KEY, encrypted)

    return NextResponse.json({ success: true, configured: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    getDb().prepare(`DELETE FROM app_config WHERE key = ?`).run(CONFIG_KEY)
    return NextResponse.json({ success: true, configured: false })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Failed to remove' }, { status: 500 })
  }
}

