/**
 * Finnhub API Key Configuration Endpoints
 * GET: Check if configured
 * POST: Add/update API key (validates before storing)
 * DELETE: Remove API key
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

/**
 * Validate Finnhub API key by making a test API call
 */
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' }
  }

  try {
    const url = `${FINNHUB_BASE}/quote?symbol=INFY&token=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: 'Invalid API key (401 Unauthorized)' }
      }
      if (res.status === 429) {
        return { valid: false, error: 'Rate limited. Wait a moment and try again.' }
      }
      return { valid: false, error: `API Error: ${res.status}` }
    }

    const json = await res.json()

    // Check if response has quote data
    if (!json || typeof json !== 'object' || json.error) {
      return { valid: false, error: 'Invalid API key or quota exceeded' }
    }

    return { valid: true }
  } catch (err: any) {
    const message = err.message || 'Unknown error'
    if (message.includes('timeout')) {
      return { valid: false, error: 'Request timeout. Check your internet connection.' }
    }
    if (message.includes('ECONNREFUSED') || message.includes('EHOSTUNREACH')) {
      return { valid: false, error: 'Cannot reach Finnhub. Check internet connection.' }
    }
    return { valid: false, error: `Validation failed: ${message}` }
  }
}

/**
 * GET /api/config/finnhub
 * Returns whether Finnhub is configured
 */
export async function GET() {
  try {
    const db = getDb()
    const config = db
      .prepare(`SELECT value FROM app_config WHERE key = 'finnhub_api_key' LIMIT 1`)
      .get() as any

    const configured = !!config?.value

    return NextResponse.json({
      configured,
      status: configured ? '✓ Configured' : '✗ Not Configured',
    })
  } catch (err: any) {
    console.error('Error checking Finnhub config:', err)
    return NextResponse.json(
      { configured: false, error: 'Database error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/config/finnhub
 * Store Finnhub API key (validates before storing)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Validate API key
    const validation = await validateApiKey(apiKey)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Encrypt and store
    const db = getDb()
    const encrypted = encrypt(apiKey.trim())

    db.prepare(
      `INSERT OR REPLACE INTO app_config (key, value, updated_at)
       VALUES ('finnhub_api_key', ?, datetime('now'))`
    ).run(encrypted)

    console.log('[Finnhub] API key configured successfully')

    return NextResponse.json({
      success: true,
      message: 'Finnhub API key saved successfully',
      configured: true,
    })
  } catch (err: any) {
    console.error('Error storing Finnhub config:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save API key' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/config/finnhub
 * Remove Finnhub API key
 */
export async function DELETE() {
  try {
    const db = getDb()
    db.prepare(`DELETE FROM app_config WHERE key = 'finnhub_api_key'`).run()

    console.log('[Finnhub] API key removed')

    return NextResponse.json({
      success: true,
      message: 'Finnhub API key removed',
      configured: false,
    })
  } catch (err: any) {
    console.error('Error removing Finnhub config:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to remove API key' },
      { status: 500 }
    )
  }
}
