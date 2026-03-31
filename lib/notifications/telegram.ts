import { getDb } from '@/lib/db'

function ensureTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS telegram_config (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    token_enc  TEXT NOT NULL,
    chat_id    TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
}

function getConfig(): { token: string; chatId: string } | null {
  ensureTable()
  const row = getDb().prepare('SELECT token_enc, chat_id FROM telegram_config WHERE id = 1').get() as any
  if (!row) return null
  // Simple base64 "encryption" — keeps token out of plain text in DB
  try {
    const token = Buffer.from(row.token_enc, 'base64').toString('utf8')
    return { token, chatId: row.chat_id }
  } catch {
    return null
  }
}

export async function sendTelegram(message: string): Promise<boolean> {
  const config = getConfig()
  if (!config) return false

  const url = `https://api.telegram.org/bot${config.token}/sendMessage`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export function saveTelegramConfig(token: string, chatId: string) {
  ensureTable()
  const tokenEnc = Buffer.from(token).toString('base64')
  getDb().prepare(
    `INSERT OR REPLACE INTO telegram_config (id, token_enc, chat_id, updated_at)
     VALUES (1, ?, ?, datetime('now'))`
  ).run(tokenEnc, chatId)
}

export function deleteTelegramConfig() {
  ensureTable()
  getDb().prepare('DELETE FROM telegram_config WHERE id = 1').run()
}

export function getTelegramConfigMasked(): { chatId: string; tokenMasked: string } | null {
  const config = getConfig()
  if (!config) return null
  const masked = config.token.length > 8
    ? config.token.slice(0, 5) + '***' + config.token.slice(-3)
    : '***'
  return { chatId: config.chatId, tokenMasked: masked }
}
