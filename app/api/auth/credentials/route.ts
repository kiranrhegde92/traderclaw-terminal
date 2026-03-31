import { NextRequest, NextResponse } from 'next/server'
import { encrypt, decrypt } from '@/lib/crypto'
import { getDb } from '@/lib/db'

function ensureTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS broker_credentials (
    broker       TEXT PRIMARY KEY,
    encrypted_data TEXT NOT NULL,
    updated_at   TEXT DEFAULT (datetime('now'))
  )`)
  return db
}

/**
 * GET /api/auth/credentials?broker=angelone
 * Returns saved field names (values masked) so the UI knows what's pre-filled.
 * Without ?broker, returns list of saved broker IDs.
 */
export async function GET(req: NextRequest) {
  try {
    const broker = req.nextUrl.searchParams.get('broker')
    const db = ensureTable()

    if (!broker) {
      const rows = db
        .prepare(`SELECT broker FROM broker_credentials`)
        .all() as { broker: string }[]
      return NextResponse.json({ brokers: rows.map(r => r.broker) })
    }

    const row = db
      .prepare(`SELECT encrypted_data FROM broker_credentials WHERE broker = ?`)
      .get(broker) as { encrypted_data: string } | undefined

    if (!row) return NextResponse.json({ saved: false })

    const data: Record<string, string> = JSON.parse(decrypt(row.encrypted_data))
    // Return field presence — expose clientCode plainly, mask everything else
    const fields: Record<string, string> = {}
    for (const key of Object.keys(data)) {
      fields[key] = key === 'clientCode' ? data[key] : '••••'
    }
    return NextResponse.json({ saved: true, fields })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/auth/credentials
 * Body: { broker: string, ...credentialFields }
 * Encrypts and upserts credentials for the broker.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { broker, ...fields } = body as Record<string, string>

    if (!broker) {
      return NextResponse.json({ error: 'broker required' }, { status: 400 })
    }

    const db = ensureTable()
    const encrypted = encrypt(JSON.stringify(fields))
    db.prepare(`
      INSERT OR REPLACE INTO broker_credentials (broker, encrypted_data, updated_at)
      VALUES (?, ?, datetime('now'))
    `).run(broker, encrypted)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/auth/credentials?broker=angelone
 * Removes saved credentials for a broker.
 */
export async function DELETE(req: NextRequest) {
  try {
    const broker = req.nextUrl.searchParams.get('broker')
    if (!broker) {
      return NextResponse.json({ error: 'broker required' }, { status: 400 })
    }
    const db = ensureTable()
    db.prepare(`DELETE FROM broker_credentials WHERE broker = ?`).run(broker)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
