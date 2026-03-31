import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    getDb().prepare('SELECT 1').get()
    return NextResponse.json({
      status:    'ok',
      db:        'connected',
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? '1.0.0',
    })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    )
  }
}
