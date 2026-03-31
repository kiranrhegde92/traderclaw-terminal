export type LogLevel = 'info' | 'warn' | 'error' | 'trade' | 'signal' | 'system'

export interface LogEntry {
  id:       string
  level:    LogLevel
  source:   string
  message:  string
  metadata?: Record<string, unknown>
  timestamp: string
}

type LogListener = (entry: LogEntry) => void
const listeners: LogListener[] = []
const buffer: LogEntry[] = []
const MAX_BUFFER = 500

export function addLogListener(fn: LogListener): () => void {
  listeners.push(fn)
  return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1) }
}

export function getLogBuffer(): LogEntry[] {
  return [...buffer]
}

function emit(level: LogLevel, source: string, message: string, metadata?: Record<string, unknown>) {
  const entry: LogEntry = {
    id:        Math.random().toString(36).slice(2),
    level,
    source,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  }
  buffer.push(entry)
  if (buffer.length > MAX_BUFFER) buffer.shift()
  listeners.forEach(fn => fn(entry))

  // Also write to server-side DB if we're on the server
  if (typeof window === 'undefined') {
    try {
      const { getDb } = require('../db')
      const db = getDb()
      db.prepare(
        `INSERT OR IGNORE INTO console_logs (level, source, message, metadata_json)
         VALUES (?, ?, ?, ?)`
      ).run(level, source, message, metadata ? JSON.stringify(metadata) : null)
    } catch { /* DB may not be initialized yet */ }
  }
}

export const log = {
  info:   (src: string, msg: string, meta?: Record<string,unknown>) => emit('info',   src, msg, meta),
  warn:   (src: string, msg: string, meta?: Record<string,unknown>) => emit('warn',   src, msg, meta),
  error:  (src: string, msg: string, meta?: Record<string,unknown>) => emit('error',  src, msg, meta),
  trade:  (src: string, msg: string, meta?: Record<string,unknown>) => emit('trade',  src, msg, meta),
  signal: (src: string, msg: string, meta?: Record<string,unknown>) => emit('signal', src, msg, meta),
  system: (src: string, msg: string, meta?: Record<string,unknown>) => emit('system', src, msg, meta),
}
