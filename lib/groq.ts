import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export function getGroqApiKey(): string | null {
  try {
    const row = getDb()
      .prepare(`SELECT value FROM app_config WHERE key = 'groq_api_key' LIMIT 1`)
      .get() as { value: string } | undefined
    return row?.value ? decrypt(row.value) : null
  } catch {
    return null
  }
}
