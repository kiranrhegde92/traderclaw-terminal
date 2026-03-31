/**
 * Paper Trade Strategy Monitor
 * Checks every active PAPER strategy against:
 *   - Per-leg: SL, Target, Trailing SL, Re-entry
 *   - Strategy-level: SL, Target, Trailing SL, Exit time, Max daily loss/profit
 * Auto-exits legs when a condition is triggered.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  getStrategy, getStrategies,
  updateStrategyStatus, updateStrategyTrailHigh, markStrategyExitTriggered,
} from '@/lib/db/queries/strategies'
import {
  createOrder, updateOrderStatus,
  updateBalance, upsertPosition, recordTrade,
} from '@/lib/db/queries/paper-trades'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { log } from '@/lib/utils/logger'

interface MonitorResult {
  strategyId:  number
  name:        string
  totalPnl:    number
  totalPct:    number
  trigger:     string | null
  exited:      boolean
  legTriggers: { symbol: string; optType: string; strike: any; trigger: string }[]
  config:      any
  legs:        any[]   // leg configs for per-leg badges in UI
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Exit a single position leg (not the whole strategy) */
async function exitSingleLeg(
  pos:          any,
  accountId:    number,
  strategyId:   number,
  strategyName: string,
  reason:       string,
): Promise<number> {
  const db     = getDb()
  const qty    = Math.abs(pos.quantity)
  const isBuy  = pos.quantity > 0
  const txType = isBuy ? 'SELL' : 'BUY'
  const fillPx = pos.current_price ?? pos.average_price

  const orderId = createOrder({
    accountId,
    symbol:          pos.symbol,
    exchange:        pos.exchange,
    segment:         pos.segment,
    orderType:       'MARKET',
    transactionType: txType,
    productType:     pos.product_type ?? 'NRML',
    quantity:        qty,
    price:           fillPx,
    triggerPrice:    null,
    status:          'PENDING',
    optionType:      pos.option_type ?? null,
    strikePrice:     pos.strike_price ?? null,
    expiryDate:      pos.expiry_date ?? null,
    strategyId,
    notes:           `Leg exit: ${reason}`,
  })

  updateOrderStatus(orderId, 'EXECUTED', fillPx, qty)

  const realizedPnl = isBuy
    ? (fillPx - pos.average_price) * qty
    : (pos.average_price - fillPx) * qty

  updateBalance(accountId, fillPx * qty)   // credit proceeds

  upsertPosition({
    accountId,
    symbol:       pos.symbol,
    exchange:     pos.exchange,
    segment:      pos.segment,
    quantity:     isBuy ? -qty : qty,
    averagePrice: fillPx,
    currentPrice: fillPx,
    productType:  pos.product_type ?? 'NRML',
    optionType:   pos.option_type ?? null,
    strikePrice:  pos.strike_price ?? null,
    expiryDate:   pos.expiry_date ?? null,
    realizedPnl,
  })

  recordTrade({
    accountId,
    orderId,
    symbol:          pos.symbol,
    exchange:        pos.exchange,
    segment:         pos.segment,
    transactionType: txType,
    quantity:        qty,
    price:           fillPx,
    optionType:      pos.option_type ?? null,
    strikePrice:     pos.strike_price ?? null,
    expiryDate:      pos.expiry_date ?? null,
    pnl:             realizedPnl,
    executedAt:      new Date().toISOString(),
  })

  log.trade('strategy',
    `  ↳ Leg exit ${txType} ${pos.symbol} ${pos.option_type ?? 'FUT'} ${pos.strike_price ?? ''} ` +
    `x${qty} @ ₹${fillPx?.toFixed(2) ?? 0} | PnL: ₹${realizedPnl.toFixed(2)} | ${reason}`
  )

  return realizedPnl
}

/** Re-enter a leg after it was exited (re-entry logic) */
async function reEnterLeg(
  pos:          any,
  legConfig:    any,
  accountId:    number,
  strategyId:   number,
  strategyName: string,
  reEntryNum:   number,
) {
  const db  = getDb()
  const ltp = await getLTP(pos.symbol) ?? pos.average_price
  const qty = (legConfig.lots ?? 1) * (legConfig.lotSize ?? 75)

  // Determine original transaction type from first order for this leg
  const origOrder = db.prepare(`
    SELECT transaction_type FROM paper_orders
    WHERE strategy_id=? AND COALESCE(option_type,'')=?
      AND COALESCE(strike_price,-1)=? AND COALESCE(expiry_date,'')=?
      AND notes NOT LIKE 'Leg exit%' AND notes NOT LIKE 'Re-entry%'
    ORDER BY id ASC LIMIT 1
  `).get(
    strategyId,
    pos.option_type ?? '',
    pos.strike_price ?? -1,
    pos.expiry_date ?? '',
  ) as any

  if (!origOrder) return
  const txType = origOrder.transaction_type as 'BUY' | 'SELL'
  const isBuy  = txType === 'BUY'
  const price  = ltp

  const orderId = createOrder({
    accountId,
    symbol:          pos.symbol,
    exchange:        pos.exchange,
    segment:         pos.segment,
    orderType:       'MARKET',
    transactionType: txType,
    productType:     pos.product_type ?? 'NRML',
    quantity:        qty,
    price,
    triggerPrice:    null,
    status:          'PENDING',
    optionType:      pos.option_type ?? null,
    strikePrice:     pos.strike_price ?? null,
    expiryDate:      pos.expiry_date ?? null,
    strategyId,
    notes:           `Re-entry #${reEntryNum}: ${strategyName}`,
  })

  updateOrderStatus(orderId, 'EXECUTED', price, qty)
  updateBalance(accountId, isBuy ? -price * qty : price * qty)

  upsertPosition({
    accountId,
    symbol:       pos.symbol,
    exchange:     pos.exchange,
    segment:      pos.segment,
    quantity:     isBuy ? qty : -qty,
    averagePrice: price,
    currentPrice: price,
    productType:  pos.product_type ?? 'NRML',
    optionType:   pos.option_type ?? null,
    strikePrice:  pos.strike_price ?? null,
    expiryDate:   pos.expiry_date ?? null,
    realizedPnl:  0,
  })

  // Reset trail_high_price and increment re_entry_count on position
  db.prepare(`
    UPDATE paper_positions
    SET trail_high_price=0, re_entry_count=?, updated_at=datetime('now')
    WHERE account_id=? AND symbol=?
      AND COALESCE(option_type,'')=? AND COALESCE(strike_price,-1)=?
      AND COALESCE(expiry_date,'')=?
  `).run(
    reEntryNum, accountId, pos.symbol,
    pos.option_type ?? '', pos.strike_price ?? -1, pos.expiry_date ?? '',
  )

  recordTrade({
    accountId,
    orderId,
    symbol:          pos.symbol,
    exchange:        pos.exchange,
    segment:         pos.segment,
    transactionType: txType,
    quantity:        qty,
    price,
    optionType:      pos.option_type ?? null,
    strikePrice:     pos.strike_price ?? null,
    expiryDate:      pos.expiry_date ?? null,
    pnl:             null,
    executedAt:      new Date().toISOString(),
  })

  log.trade('strategy',
    `  ↳ Re-entry #${reEntryNum} ${txType} ${pos.symbol} ${pos.option_type ?? 'FUT'} ` +
    `${pos.strike_price ?? ''} x${qty} @ ₹${price?.toFixed(2) ?? 0}`
  )
}

/** Exit ALL open legs of a strategy */
async function exitStrategyLegs(
  strategyId:   number,
  accountId:    number,
  strategyName: string,
  reason:       string,
) {
  const db = getDb()
  const orders = db.prepare(
    `SELECT * FROM paper_orders WHERE strategy_id = ? AND status = 'EXECUTED'`
  ).all(strategyId) as any[]

  if (orders.length === 0) return

  log.trade('strategy', `Auto-exit "${strategyName}" — reason: ${reason}`)

  for (const o of orders) {
    const pos = db.prepare(`
      SELECT * FROM paper_positions
      WHERE account_id=? AND symbol=? AND exchange=? AND segment=?
        AND product_type=? AND COALESCE(option_type,'')=?
        AND COALESCE(strike_price,-1)=? AND COALESCE(expiry_date,'')=?
        AND quantity != 0
    `).get(
      accountId, o.symbol, o.exchange, o.segment,
      o.product_type ?? 'NRML',
      o.option_type ?? '', o.strike_price ?? -1, o.expiry_date ?? '',
    ) as any

    if (!pos) continue
    await exitSingleLeg(pos, accountId, strategyId, strategyName, reason)
  }

  updateStrategyStatus(strategyId, 'CLOSED')
  markStrategyExitTriggered(strategyId)
}

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const strategies = getStrategies().filter(s => s.status === 'PAPER')
  const results: MonitorResult[] = []
  const db      = getDb()
  const nowMins = nowMinutes()

  for (const strategy of strategies) {
    const config = strategy.config
    const sid    = strategy.id!
    const name   = strategy.name

    const raw = db.prepare(
      'SELECT exit_triggered, trail_high_pnl FROM strategies WHERE id=?'
    ).get(sid) as any
    if (raw?.exit_triggered) continue

    const orders = db.prepare(
      `SELECT * FROM paper_orders WHERE strategy_id = ? AND status = 'EXECUTED'`
    ).all(sid) as any[]

    if (orders.length === 0) continue

    // Full strategy object to get per-leg configs
    const fullStrategy = getStrategy(sid)
    const legConfigs: any[] = fullStrategy?.legs ?? []

    // Deduplicate open positions for this strategy
    const seen      = new Set<string>()
    const positions: any[] = []
    for (const o of orders) {
      const key = `${o.symbol}|${o.exchange}|${o.segment}|${o.product_type ?? 'NRML'}|${o.option_type ?? ''}|${o.strike_price ?? -1}|${o.expiry_date ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)

      const pos = db.prepare(`
        SELECT * FROM paper_positions
        WHERE account_id=? AND symbol=? AND exchange=? AND segment=?
          AND product_type=? AND COALESCE(option_type,'')=?
          AND COALESCE(strike_price,-1)=? AND COALESCE(expiry_date,'')=?
      `).get(
        accountId, o.symbol, o.exchange, o.segment,
        o.product_type ?? 'NRML',
        o.option_type ?? '', o.strike_price ?? -1, o.expiry_date ?? '',
      ) as any
      if (pos && pos.quantity !== 0) positions.push(pos)
    }

    if (positions.length === 0) continue

    // ── Per-leg checks ──────────────────────────────────────────────
    const legTriggers: MonitorResult['legTriggers'] = []
    const exitedLegKeys = new Set<string>()

    for (const pos of positions) {
      const ltp = await getLTP(pos.symbol) ?? pos.current_price ?? pos.average_price

      // Update current_price
      db.prepare(`UPDATE paper_positions SET current_price=?, updated_at=datetime('now') WHERE id=?`)
        .run(ltp, pos.id)

      // Match leg config by (optionType, strikePrice, expiryDate)
      const legConfig = legConfigs.find(l => {
        const lOptType = l.type !== 'FUT' ? (l.type ?? '') : ''
        const lStrike  = l.strikePrice ?? l.strike ?? -1
        const lExpiry  = l.expiryDate  ?? l.expiry  ?? ''
        return (
          lOptType === (pos.option_type ?? '') &&
          Number(lStrike) === Number(pos.strike_price ?? -1) &&
          lExpiry === (pos.expiry_date ?? '')
        )
      })

      if (!legConfig) continue

      const isBuy  = pos.quantity > 0
      const avgPx  = pos.average_price
      let legTrigger: string | null = null

      // Leg SL
      if (!legTrigger && (legConfig.legSLValue ?? 0) > 0) {
        const change = legConfig.legSLType === 'percent'
          ? (isBuy ? (avgPx - ltp) / avgPx * 100 : (ltp - avgPx) / avgPx * 100)
          : (isBuy ? avgPx - ltp : ltp - avgPx)
        if (change >= legConfig.legSLValue) {
          legTrigger = `Leg SL hit (${legConfig.legSLValue}${legConfig.legSLType === 'percent' ? '%' : 'pts'})`
        }
      }

      // Leg Target
      if (!legTrigger && (legConfig.legTgtValue ?? 0) > 0) {
        const change = legConfig.legTgtType === 'percent'
          ? (isBuy ? (ltp - avgPx) / avgPx * 100 : (avgPx - ltp) / avgPx * 100)
          : (isBuy ? ltp - avgPx : avgPx - ltp)
        if (change >= legConfig.legTgtValue) {
          legTrigger = `Leg Target hit (${legConfig.legTgtValue}${legConfig.legTgtType === 'percent' ? '%' : 'pts'})`
        }
      }

      // Leg Trailing SL
      if (!legTrigger && legConfig.trailSL && (legConfig.trailValue ?? 0) > 0) {
        const profitPct  = isBuy
          ? (ltp - avgPx) / avgPx * 100
          : (avgPx - ltp) / avgPx * 100
        const trailHigh  = pos.trail_high_price ?? 0

        if (profitPct > trailHigh) {
          db.prepare(`UPDATE paper_positions SET trail_high_price=? WHERE id=?`)
            .run(profitPct, pos.id)
        } else if (trailHigh > 0 && trailHigh - profitPct >= legConfig.trailValue) {
          legTrigger = `Leg Trail SL (high: ${trailHigh.toFixed(1)}%, step: ${legConfig.trailValue}%)`
        }
      }

      if (legTrigger) {
        await exitSingleLeg(pos, accountId, sid, name, legTrigger)
        legTriggers.push({
          symbol:  pos.symbol,
          optType: pos.option_type ?? 'FUT',
          strike:  pos.strike_price,
          trigger: legTrigger,
        })

        const posKey = `${pos.symbol}|${pos.option_type ?? ''}|${pos.strike_price ?? -1}|${pos.expiry_date ?? ''}`
        exitedLegKeys.add(posKey)

        // Re-entry
        const reEntryMax   = legConfig.reEntry ?? 0
        const reEntryCount = pos.re_entry_count ?? 0
        if (reEntryMax > 0 && reEntryCount < reEntryMax) {
          const isSLTrigger  = legTrigger.includes('SL')
          const isTgtTrigger = legTrigger.includes('Target')
          const shouldReEnter =
            (legConfig.reEntryType === 'onSL'     && isSLTrigger)  ||
            (legConfig.reEntryType === 'onTarget'  && isTgtTrigger) ||
            (!legConfig.reEntryType)
          if (shouldReEnter) {
            await reEnterLeg(pos, legConfig, accountId, sid, name, reEntryCount + 1)
          }
        }
      }
    }

    // ── Recalculate strategy-level P&L (skip just-exited legs) ─────
    let totalPnl      = 0
    let totalInvested = 0
    for (const pos of positions) {
      const posKey = `${pos.symbol}|${pos.option_type ?? ''}|${pos.strike_price ?? -1}|${pos.expiry_date ?? ''}`
      if (exitedLegKeys.has(posKey)) continue   // already exited above

      const ltp    = pos.current_price ?? pos.average_price
      const legPnl = (ltp - pos.average_price) * pos.quantity
      totalPnl     += legPnl
      totalInvested += Math.abs(pos.average_price * pos.quantity)
    }
    const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

    // ── Strategy-level checks ───────────────────────────────────────
    let trigger: string | null = null

    if (config) {
      if (config.exitTime && nowMins >= timeToMinutes(config.exitTime)) {
        trigger = `Exit time reached (${config.exitTime})`
      }
      if (!trigger && config.maxProfitDay > 0 && totalPnl >= config.maxProfitDay) {
        trigger = `Max daily profit hit (₹${config.maxProfitDay})`
      }
      if (!trigger && config.maxLossDay > 0 && totalPnl <= -config.maxLossDay) {
        trigger = `Max daily loss hit (₹${config.maxLossDay})`
      }
      if (!trigger && config.targetValue > 0) {
        const hit = config.targetType === 'percent'
          ? totalPct >= config.targetValue
          : totalPnl >= config.targetValue
        if (hit) trigger = `Target hit (${config.targetValue}${config.targetType === 'percent' ? '%' : 'pts'})`
      }
      if (!trigger && config.slValue > 0) {
        const hit = config.slType === 'percent'
          ? totalPct <= -config.slValue
          : totalPnl <= -config.slValue
        if (hit) trigger = `Stop loss hit (${config.slValue}${config.slType === 'percent' ? '%' : 'pts'})`
      }
      if (!trigger && config.trailingSL && config.trailStep > 0) {
        const trailHigh = raw?.trail_high_pnl ?? 0
        if (totalPnl > trailHigh) {
          updateStrategyTrailHigh(sid, totalPnl)
        } else if (trailHigh > 0 && totalPnl < trailHigh - config.trailStep) {
          trigger = `Trailing SL hit (high: ₹${trailHigh.toFixed(0)}, step: ₹${config.trailStep})`
        }
      }
    }

    let exited = false
    if (trigger) {
      await exitStrategyLegs(sid, accountId, name, trigger)
      exited = true
    }

    results.push({ strategyId: sid, name, totalPnl, totalPct, trigger, exited, legTriggers, config, legs: legConfigs })
  }

  return NextResponse.json({ data: results })
}
