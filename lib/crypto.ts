import crypto from 'crypto'
import { getDb } from '@/lib/db'

const ALGO = 'aes-256-gcm'

function getOrCreateKey(): string {
  const db = getDb()
  // app_config table is guaranteed by db init; use INSERT OR IGNORE to avoid dup
  const row = db
    .prepare(`SELECT value FROM app_config WHERE key = 'enc_key'`)
    .get() as { value: string } | undefined
  if (row) return row.value

  const newKey = crypto.randomBytes(32).toString('hex')
  db.prepare(`INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('enc_key', ?, datetime('now'))`).run(newKey)
  // Re-read in case a concurrent request already inserted
  const row2 = db
    .prepare(`SELECT value FROM app_config WHERE key = 'enc_key'`)
    .get() as { value: string }
  return row2.value
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns "ivHex:tagHex:ciphertextHex"
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(getOrCreateKey(), 'hex')
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(getOrCreateKey(), 'hex')
  const [ivHex, tagHex, dataHex] = ciphertext.split(':')
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
