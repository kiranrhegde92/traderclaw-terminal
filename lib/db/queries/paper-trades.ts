import { getDb, toCamel, toCamelAll } from '../index'
import type { PaperOrder, PaperPosition, PaperTrade, PaperAccount, OrderStatus } from '@/types/paper-trade'

/* ---------- ACCOUNTS ---------- */
export function getAccount(id = 1): PaperAccount | null {
  const row = getDb().prepare('SELECT * FROM paper_accounts WHERE id = ?').get(id)
  return row ? toCamel<PaperAccount>(row) : null
}

export function updateBalance(accountId: number, delta: number) {
  getDb().prepare(
    'UPDATE paper_accounts SET current_balance = current_balance + ? WHERE id = ?'
  ).run(delta, accountId)
}

/* ---------- ORDERS ---------- */
export function createOrder(order: Omit<PaperOrder, 'id' | 'filledPrice' | 'filledQty' | 'filledAt' | 'createdAt'>): number {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO paper_orders
      (account_id, symbol, exchange, segment, order_type, transaction_type, product_type,
       quantity, price, trigger_price, status, option_type, strike_price, expiry_date, strategy_id, notes)
    VALUES
      (@accountId, @symbol, @exchange, @segment, @orderType, @transactionType, @productType,
       @quantity, @price, @triggerPrice, @status, @optionType, @strikePrice, @expiryDate, @strategyId, @notes)
  `).run({
    ...order,
    status: order.status ?? 'PENDING',
  })
  return result.lastInsertRowid as number
}

export function updateOrderStatus(id: number, status: OrderStatus, filledPrice?: number, filledQty?: number) {
  getDb().prepare(`
    UPDATE paper_orders
    SET status = ?, filled_price = ?, filled_quantity = ?, filled_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(status, filledPrice ?? null, filledQty ?? 0, id)
}

export function getOrders(accountId: number, status?: OrderStatus): PaperOrder[] {
  const db = getDb()
  const rows = status
    ? db.prepare('SELECT * FROM paper_orders WHERE account_id = ? AND status = ? ORDER BY created_at DESC').all(accountId, status)
    : db.prepare('SELECT * FROM paper_orders WHERE account_id = ? ORDER BY created_at DESC').all(accountId)
  return toCamelAll<PaperOrder>(rows)
}

export function getOpenOrders(accountId: number): PaperOrder[] {
  const rows = getDb().prepare(
    `SELECT * FROM paper_orders WHERE account_id = ? AND status IN ('PENDING','OPEN') ORDER BY created_at DESC`
  ).all(accountId)
  return toCamelAll<PaperOrder>(rows)
}

export function cancelOrder(id: number) {
  getDb().prepare(`UPDATE paper_orders SET status='CANCELLED', updated_at=datetime('now') WHERE id=?`).run(id)
}

/* ---------- POSITIONS ---------- */
export function getPositions(accountId: number): PaperPosition[] {
  const rows = getDb().prepare(
    'SELECT * FROM paper_positions WHERE account_id = ? AND quantity != 0 ORDER BY created_at DESC'
  ).all(accountId)
  return toCamelAll<PaperPosition>(rows)
}

export function upsertPosition(pos: Omit<PaperPosition, 'id' | 'unrealizedPnl' | 'pnlPct'>) {
  const db = getDb()
  const rawExisting = db.prepare(`
    SELECT * FROM paper_positions
    WHERE account_id=? AND symbol=? AND exchange=? AND segment=?
      AND product_type=? AND COALESCE(option_type,'')=? AND COALESCE(strike_price,-1)=? AND COALESCE(expiry_date,'')=?
  `).get(
    pos.accountId, pos.symbol, pos.exchange, pos.segment,
    pos.productType,
    pos.optionType ?? '',
    pos.strikePrice ?? -1,
    pos.expiryDate ?? ''
  )
  const existing = rawExisting ? toCamel<PaperPosition>(rawExisting) : undefined

  if (!existing) {
    db.prepare(`
      INSERT INTO paper_positions
        (account_id, symbol, exchange, segment, quantity, average_price, current_price, product_type,
         option_type, strike_price, expiry_date, realized_pnl)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      pos.accountId, pos.symbol, pos.exchange, pos.segment,
      pos.quantity, pos.averagePrice, pos.currentPrice ?? null,
      pos.productType, pos.optionType ?? null, pos.strikePrice ?? null,
      pos.expiryDate ?? null, pos.realizedPnl ?? 0
    )
  } else {
    // Recalculate average
    const oldQty = existing.quantity
    const newQty = oldQty + pos.quantity
    let newAvg = existing.averagePrice
    if (newQty !== 0) {
      newAvg = Math.abs(oldQty * existing.averagePrice + pos.quantity * pos.averagePrice) / Math.abs(newQty)
    }
    db.prepare(`
      UPDATE paper_positions
      SET quantity=?, average_price=?, current_price=?, realized_pnl=realized_pnl+?, updated_at=datetime('now')
      WHERE id=?
    `).run(newQty, newAvg, pos.currentPrice ?? null, pos.realizedPnl ?? 0, existing.id)
  }
}

/* ---------- TRADES ---------- */
export function recordTrade(trade: Omit<PaperTrade, 'id'>): number {
  const result = getDb().prepare(`
    INSERT INTO paper_trades
      (account_id, order_id, symbol, exchange, segment, transaction_type,
       quantity, price, option_type, strike_price, expiry_date, pnl)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    trade.accountId, trade.orderId, trade.symbol, trade.exchange,
    trade.segment, trade.transactionType, trade.quantity, trade.price,
    trade.optionType ?? null, trade.strikePrice ?? null, trade.expiryDate ?? null,
    trade.pnl ?? null
  )
  return result.lastInsertRowid as number
}

export function getTradeHistory(accountId: number, limit = 100): PaperTrade[] {
  const rows = getDb().prepare(
    'SELECT * FROM paper_trades WHERE account_id = ? ORDER BY executed_at DESC LIMIT ?'
  ).all(accountId, limit)
  return toCamelAll<PaperTrade>(rows)
}
