import { getDb } from '../index'

export function getWatchlist(id = 1) {
  const db = getDb()
  const list = db.prepare('SELECT * FROM watchlists WHERE id = ?').get(id)
  const symbols = db.prepare(
    'SELECT * FROM watchlist_symbols WHERE watchlist_id = ? ORDER BY sort_order, added_at'
  ).all(id)
  return { list, symbols }
}

export function getAllWatchlists() {
  return getDb().prepare('SELECT * FROM watchlists ORDER BY id').all()
}

export function addSymbol(watchlistId: number, symbol: string, exchange = 'NSE', token?: string) {
  const db = getDb()
  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as m FROM watchlist_symbols WHERE watchlist_id = ?'
  ).get(watchlistId) as { m: number | null }).m ?? -1
  return db.prepare(
    `INSERT OR IGNORE INTO watchlist_symbols (watchlist_id, symbol, exchange, token, sort_order)
     VALUES (?, ?, ?, ?, ?)`
  ).run(watchlistId, symbol.toUpperCase(), exchange, token ?? null, maxOrder + 1)
}

export function removeSymbol(watchlistId: number, symbol: string) {
  return getDb().prepare(
    'DELETE FROM watchlist_symbols WHERE watchlist_id = ? AND symbol = ?'
  ).run(watchlistId, symbol.toUpperCase())
}

export function getWatchlistSymbols(watchlistId = 1): string[] {
  const rows = getDb().prepare(
    'SELECT symbol FROM watchlist_symbols WHERE watchlist_id = ? ORDER BY sort_order'
  ).all(watchlistId) as { symbol: string }[]
  return rows.map(r => r.symbol)
}
