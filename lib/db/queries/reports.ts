import { getDb, toCamel, toCamelAll } from '../index'

export interface DailyReport {
  id?: number
  accountId: number
  reportDate: string
  openValue: number
  closedValue: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalReturn: number
  tradesExecuted: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  topGainers?: Array<{ symbol: string; qty: number; pnl: number; return: number }>
  topLosers?: Array<{ symbol: string; qty: number; pnl: number; return: number }>
  createdAt?: string
}

export interface ReportSubscription {
  id?: number
  accountId: number
  email: string
  frequency: 'daily' | 'weekly'
  enableEmail: boolean
  lastSentAt?: string
  createdAt?: string
  updatedAt?: string
}

export function createOrUpdateReport(report: DailyReport): number {
  const db = getDb()
  const existing = db.prepare(
    'SELECT id FROM reports WHERE account_id = ? AND report_date = ?'
  ).get(report.accountId, report.reportDate) as { id: number } | undefined

  if (existing) {
    db.prepare(`
      UPDATE reports
      SET open_value = ?, closed_value = ?, realized_pnl = ?, unrealized_pnl = ?,
          total_pnl = ?, total_return = ?, trades_executed = ?, win_rate = ?,
          avg_win = ?, avg_loss = ?, profit_factor = ?,
          top_gainers_json = ?, top_losers_json = ?
      WHERE id = ?
    `).run(
      report.openValue,
      report.closedValue,
      report.realizedPnl,
      report.unrealizedPnl,
      report.totalPnl,
      report.totalReturn,
      report.tradesExecuted,
      report.winRate,
      report.avgWin,
      report.avgLoss,
      report.profitFactor,
      report.topGainers ? JSON.stringify(report.topGainers) : null,
      report.topLosers ? JSON.stringify(report.topLosers) : null,
      existing.id
    )
    return existing.id
  }

  const result = db.prepare(`
    INSERT INTO reports
    (account_id, report_date, open_value, closed_value, realized_pnl, unrealized_pnl,
     total_pnl, total_return, trades_executed, win_rate, avg_win, avg_loss,
     profit_factor, top_gainers_json, top_losers_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.accountId,
    report.reportDate,
    report.openValue,
    report.closedValue,
    report.realizedPnl,
    report.unrealizedPnl,
    report.totalPnl,
    report.totalReturn,
    report.tradesExecuted,
    report.winRate,
    report.avgWin,
    report.avgLoss,
    report.profitFactor,
    report.topGainers ? JSON.stringify(report.topGainers) : null,
    report.topLosers ? JSON.stringify(report.topLosers) : null
  )

  return result.lastInsertRowid as number
}

export function getReport(accountId: number, reportDate: string): DailyReport | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM reports WHERE account_id = ? AND report_date = ?'
  ).get(accountId, reportDate) as any

  if (!row) return null

  const report = toCamel<DailyReport>(row)
  if (row.top_gainers_json) report.topGainers = JSON.parse(row.top_gainers_json)
  if (row.top_losers_json) report.topLosers = JSON.parse(row.top_losers_json)

  return report
}

export function getLatestReport(accountId: number): DailyReport | null {
  const db = getDb()
  const row = db.prepare(
    'SELECT * FROM reports WHERE account_id = ? ORDER BY report_date DESC LIMIT 1'
  ).get(accountId) as any

  if (!row) return null

  const report = toCamel<DailyReport>(row)
  if (row.top_gainers_json) report.topGainers = JSON.parse(row.top_gainers_json)
  if (row.top_losers_json) report.topLosers = JSON.parse(row.top_losers_json)

  return report
}

export function getReportsByDateRange(
  accountId: number,
  startDate: string,
  endDate: string
): DailyReport[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM reports WHERE account_id = ? AND report_date BETWEEN ? AND ? ORDER BY report_date DESC'
  ).all(accountId, startDate, endDate) as any[]

  return rows.map(row => {
    const report = toCamel<DailyReport>(row)
    if (row.top_gainers_json) report.topGainers = JSON.parse(row.top_gainers_json)
    if (row.top_losers_json) report.topLosers = JSON.parse(row.top_losers_json)
    return report
  })
}

export function createOrUpdateSubscription(
  subscription: ReportSubscription
): number {
  const db = getDb()
  const existing = db.prepare(
    'SELECT id FROM report_subscriptions WHERE account_id = ? AND email = ?'
  ).get(subscription.accountId, subscription.email) as { id: number } | undefined

  if (existing) {
    db.prepare(`
      UPDATE report_subscriptions
      SET frequency = ?, enable_email = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(subscription.frequency, subscription.enableEmail ? 1 : 0, existing.id)
    return existing.id
  }

  const result = db.prepare(`
    INSERT INTO report_subscriptions (account_id, email, frequency, enable_email)
    VALUES (?, ?, ?, ?)
  `).run(
    subscription.accountId,
    subscription.email,
    subscription.frequency,
    subscription.enableEmail ? 1 : 0
  )

  return result.lastInsertRowid as number
}

export function getSubscription(
  accountId: number,
  email?: string
): ReportSubscription | null {
  const db = getDb()
  let row: any

  if (email) {
    row = db.prepare(
      'SELECT * FROM report_subscriptions WHERE account_id = ? AND email = ? LIMIT 1'
    ).get(accountId, email)
  } else {
    row = db.prepare(
      'SELECT * FROM report_subscriptions WHERE account_id = ? LIMIT 1'
    ).get(accountId)
  }

  if (!row) return null

  const sub = toCamel<ReportSubscription>(row)
  sub.enableEmail = !!row.enable_email
  return sub
}

export function getActiveSubscriptions(): ReportSubscription[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM report_subscriptions WHERE enable_email = 1'
  ).all() as any[]

  return rows.map(row => {
    const sub = toCamel<ReportSubscription>(row)
    sub.enableEmail = !!row.enable_email
    return sub
  })
}

export function updateSubscriptionLastSent(subscriptionId: number) {
  const db = getDb()
  db.prepare(
    "UPDATE report_subscriptions SET last_sent_at = datetime('now') WHERE id = ?"
  ).run(subscriptionId)
}
