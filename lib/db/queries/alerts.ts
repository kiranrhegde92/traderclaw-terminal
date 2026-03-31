import { getDb, toCamel, toCamelAll } from '../index'

export interface Alert {
  id:            number
  symbol:        string
  exchange:      string
  alertType:     string
  conditionJson: string
  isActive:      boolean
  triggeredAt:   string | null
  createdAt:     string
}

export function getAlerts(activeOnly = false): Alert[] {
  const db = getDb()
  const rows = activeOnly
    ? db.prepare('SELECT * FROM alerts WHERE is_active = 1 ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all()
  return toCamelAll<Alert>(rows)
}

export function createAlert(
  symbol: string, alertType: string, condition: Record<string, unknown>, exchange = 'NSE'
): number {
  const result = getDb().prepare(
    'INSERT INTO alerts (symbol, exchange, alert_type, condition_json) VALUES (?,?,?,?)'
  ).run(symbol.toUpperCase(), exchange, alertType, JSON.stringify(condition))
  return result.lastInsertRowid as number
}

export function triggerAlert(id: number) {
  getDb().prepare(
    `UPDATE alerts SET triggered_at = datetime('now'), is_active = 0 WHERE id = ?`
  ).run(id)
}

export function deleteAlert(id: number) {
  getDb().prepare('DELETE FROM alerts WHERE id = ?').run(id)
}

export function getAlertsForSymbol(symbol: string): Alert[] {
  const rows = getDb().prepare(
    'SELECT * FROM alerts WHERE symbol = ? AND is_active = 1'
  ).all(symbol.toUpperCase())
  return toCamelAll<Alert>(rows)
}
