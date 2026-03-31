import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { z } from 'zod'

const ScanSchema = z.object({
  name:   z.string().min(1).max(100),
  config: z.record(z.unknown()),
})

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM saved_scans ORDER BY created_at DESC').all()
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = ScanSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.errors },
      { status: 400 }
    )
  }
  const { name, config } = parsed.data
  const db = getDb()
  try {
    const stmt = db.prepare('INSERT INTO saved_scans (name, config_json) VALUES (?, ?)')
    const result = stmt.run(name.trim(), JSON.stringify(config))
    return NextResponse.json({ success: true, id: result.lastInsertRowid })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      db.prepare('UPDATE saved_scans SET config_json=? WHERE name=?').run(JSON.stringify(config), name.trim())
      return NextResponse.json({ success: true, updated: true })
    }
    return NextResponse.json({ error: 'Failed to save scan' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { id, alert_enabled } = await req.json()
  if (id == null || alert_enabled == null) {
    return NextResponse.json({ error: 'id and alert_enabled required' }, { status: 400 })
  }
  const db = getDb()
  db.prepare('UPDATE saved_scans SET alert_enabled=? WHERE id=?').run(alert_enabled ? 1 : 0, id)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  db.prepare('DELETE FROM saved_scans WHERE id=?').run(parseInt(id))
  return NextResponse.json({ success: true })
}
