import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { CREATE_TABLES, SEED_DATA, SCHEMA_VERSION } from './schema'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = process.env.DB_PATH ?? './data/openclaw.db'
  const dir    = path.dirname(dbPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Run schema creation
  db.exec(CREATE_TABLES)

  // Safe column-level migrations (idempotent — SQLite throws on duplicate column)
  const columnMigrations = [
    `ALTER TABLE strategies ADD COLUMN config_json TEXT`,
    `ALTER TABLE strategies ADD COLUMN trail_high_pnl REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE strategies ADD COLUMN exit_triggered INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE paper_positions ADD COLUMN trail_high_price REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE paper_positions ADD COLUMN re_entry_count INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE paper_orders ADD COLUMN re_entry_count INTEGER NOT NULL DEFAULT 0`,
  ]
  for (const sql of columnMigrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // Table migrations (idempotent — CREATE TABLE IF NOT EXISTS)
  db.exec(`CREATE TABLE IF NOT EXISTS saved_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
  // Add alert_enabled column if not present
  try { db.exec(`ALTER TABLE saved_scans ADD COLUMN alert_enabled INTEGER NOT NULL DEFAULT 0`) } catch { /* already exists */ }

  // Alert log table for Feature 48
  db.exec(`CREATE TABLE IF NOT EXISTS alert_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT NOT NULL,
    alert_type    TEXT NOT NULL,
    trigger_price REAL,
    message       TEXT,
    triggered_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  // News keyword alerts table (Feature 41)
  db.exec(`CREATE TABLE IF NOT EXISTS news_keywords (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword    TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  // Check if we need to seed
  const version = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined

  if (!version) {
    db.exec(SEED_DATA)
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION)
    console.log(`[DB] Schema v${SCHEMA_VERSION} initialized with seed data`)
  }

  return db
}

export type DB = Database.Database

/** Convert a snake_case DB row object to camelCase */
export function toCamel<T = any>(row: any): T {
  if (!row || typeof row !== 'object') return row
  const out: any = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = row[key]
  }
  return out as T
}

/** Convert an array of snake_case DB rows to camelCase */
export function toCamelAll<T = any>(rows: any[]): T[] {
  return rows.map(r => toCamel<T>(r))
}
