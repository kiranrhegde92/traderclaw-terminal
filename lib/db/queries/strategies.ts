import { getDb, toCamel } from '../index'
import type { Strategy, StrategyTemplate } from '@/types/strategy'
import type { StrategyLeg } from '@/types/options'

export function getTemplates(): StrategyTemplate[] {
  const rows = getDb().prepare('SELECT * FROM strategy_templates ORDER BY category, name').all() as any[]
  return rows.map(r => {
    const c = toCamel(r)
    return { ...c, legs: JSON.parse(r.legs_json ?? r.legs ?? '[]'), isBuiltin: Boolean(r.is_builtin) }
  })
}

export function getStrategies(): Strategy[] {
  const rows = getDb().prepare('SELECT * FROM strategies ORDER BY created_at DESC').all() as any[]
  return rows.map(r => {
    const c = toCamel(r)
    return {
      ...c,
      legs:   JSON.parse(r.legs_json   ?? r.legs   ?? '[]'),
      config: r.config_json ? JSON.parse(r.config_json) : null,
    }
  })
}

export function getStrategy(id: number): Strategy | null {
  const r = getDb().prepare('SELECT * FROM strategies WHERE id = ?').get(id) as any
  if (!r) return null
  const c = toCamel(r)
  return {
    ...c,
    legs:   JSON.parse(r.legs_json   ?? '[]'),
    config: r.config_json ? JSON.parse(r.config_json) : null,
  }
}

export function createStrategy(s: Omit<Strategy, 'id' | 'createdAt'> & { config?: any }): number {
  const result = getDb().prepare(`
    INSERT INTO strategies
      (template_id, name, underlying, expiry_date, legs_json, target_pnl, stop_loss_pnl,
       config_json, status, paper_account_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    s.templateId ?? null, s.name, s.underlying, s.expiryDate,
    JSON.stringify(s.legs),
    s.targetPnl   ?? null,
    s.stopLossPnl ?? null,
    s.config      ? JSON.stringify(s.config) : null,
    s.status ?? 'DRAFT',
    s.paperAccountId ?? null,
    s.notes ?? null
  )
  return result.lastInsertRowid as number
}

export function updateStrategyConfig(id: number, config: any) {
  getDb().prepare(
    `UPDATE strategies SET config_json=?, updated_at=datetime('now') WHERE id=?`
  ).run(JSON.stringify(config), id)
}

export function updateStrategyLegs(id: number, legs: StrategyLeg[]) {
  getDb().prepare(
    `UPDATE strategies SET legs_json=?, updated_at=datetime('now') WHERE id=?`
  ).run(JSON.stringify(legs), id)
}

export function updateStrategyStatus(id: number, status: string) {
  getDb().prepare(
    `UPDATE strategies SET status=?, updated_at=datetime('now') WHERE id=?`
  ).run(status, id)
}

export function updateStrategyTrailHigh(id: number, pnl: number) {
  getDb().prepare(
    `UPDATE strategies SET trail_high_pnl=?, updated_at=datetime('now') WHERE id=? AND trail_high_pnl < ?`
  ).run(pnl, id, pnl)
}

export function markStrategyExitTriggered(id: number) {
  getDb().prepare(
    `UPDATE strategies SET exit_triggered=1, updated_at=datetime('now') WHERE id=?`
  ).run(id)
}

export function deleteStrategy(id: number) {
  getDb().prepare('DELETE FROM strategies WHERE id = ?').run(id)
}
