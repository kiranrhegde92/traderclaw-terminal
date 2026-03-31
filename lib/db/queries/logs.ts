import { getDb } from '../index'
import type { LogLevel, LogEntry } from '@/lib/utils/logger'

export function getRecentLogs(limit = 200, level?: LogLevel) {
  const db = getDb()
  if (level) {
    return db.prepare(
      'SELECT * FROM console_logs WHERE level = ? ORDER BY created_at DESC LIMIT ?'
    ).all(level, limit)
  }
  return db.prepare(
    'SELECT * FROM console_logs ORDER BY created_at DESC LIMIT ?'
  ).all(limit)
}

export function insertLog(level: LogLevel, source: string, message: string, metadata?: Record<string, unknown>) {
  getDb().prepare(
    'INSERT INTO console_logs (level, source, message, metadata_json) VALUES (?,?,?,?)'
  ).run(level, source, message, metadata ? JSON.stringify(metadata) : null)
}

export function clearOldLogs(keepDays = 7) {
  getDb().prepare(
    `DELETE FROM console_logs WHERE created_at < datetime('now', '-${keepDays} days')`
  ).run()
}
