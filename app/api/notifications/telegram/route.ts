import { NextRequest, NextResponse } from 'next/server'
import {
  sendTelegram,
  saveTelegramConfig,
  deleteTelegramConfig,
  getTelegramConfigMasked,
} from '@/lib/notifications/telegram'
import { z } from 'zod'

const ConfigSchema = z.object({
  token:  z.string().min(10),
  chatId: z.string().min(1),
  test:   z.boolean().optional().default(false),
})

export async function GET() {
  try {
    const config = getTelegramConfigMasked()
    return NextResponse.json({ config })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = ConfigSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.errors }, { status: 400 })
    }
    const { token, chatId, test } = parsed.data

    saveTelegramConfig(token, chatId)

    if (test) {
      // Temporarily use the provided credentials to test
      const url = `https://api.telegram.org/bot${token}/sendMessage`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🚀 *TraderClaw connected!*\nYour Telegram alerts are now active.',
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        return NextResponse.json(
          { error: 'Telegram test failed', details: errBody },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true, message: 'Test message sent!' })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    deleteTelegramConfig()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
