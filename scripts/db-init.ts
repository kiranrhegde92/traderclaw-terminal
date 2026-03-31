/**
 * scripts/db-init.ts
 * Initialize the SQLite database with schema + seed data
 * Run: npx tsx scripts/db-init.ts
 */
import { getDb } from '../lib/db'

async function main() {
  console.log('Initializing database...')
  const db = getDb()

  // Seed a default paper account if none exists
  const existing = db.prepare('SELECT id FROM paper_accounts WHERE id = 1').get()
  if (!existing) {
    db.prepare(`
      INSERT INTO paper_accounts (id, name, balance, initial_balance)
      VALUES (1, 'Main Paper Account', 1000000, 1000000)
    `).run()
    console.log('✓ Created default paper account (₹10,00,000)')
  } else {
    console.log('✓ Paper account already exists')
  }

  // Seed default watchlist
  const wl = db.prepare(`SELECT id FROM watchlists WHERE name = 'Default'`).get() as any
  if (!wl) {
    const result = db.prepare(`
      INSERT INTO watchlists (name, description) VALUES ('Default', 'Default watchlist')
    `).run()
    const wlId = result.lastInsertRowid

    const defaultSymbols = ['NIFTY 50', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK']
    for (const symbol of defaultSymbols) {
      db.prepare(`
        INSERT OR IGNORE INTO watchlist_symbols (watchlist_id, symbol, exchange)
        VALUES (?, ?, 'NSE')
      `).run(wlId, symbol)
    }
    console.log(`✓ Created default watchlist with ${defaultSymbols.length} symbols`)
  } else {
    console.log('✓ Default watchlist already exists')
  }

  console.log('\n✅ Database initialized successfully!')
  console.log(`   Location: ${process.cwd()}/openclaw.db`)
}

main().catch(console.error)
