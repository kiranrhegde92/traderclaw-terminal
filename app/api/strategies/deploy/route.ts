import { NextRequest, NextResponse } from 'next/server'
import { getStrategy, getStrategies, createStrategy, updateStrategyStatus, updateStrategyConfig } from '@/lib/db/queries/strategies'
import {
  createOrder, updateOrderStatus,
  upsertPosition, updateBalance, recordTrade,
} from '@/lib/db/queries/paper-trades'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { log } from '@/lib/utils/logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { target, accountId = 1 } = body

    if (!target) return NextResponse.json({ error: 'target required' }, { status: 400 })

    let legs: any[]
    let underlying: string
    let strategyName: string
    let strategyId: number
    let config: any = null

    if (body.strategyId) {
      // Deploy a previously-saved strategy by ID
      const strategy = getStrategy(body.strategyId)
      if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
      legs         = strategy.legs
      underlying   = strategy.underlying
      strategyName = strategy.name
      strategyId   = body.strategyId
      config       = strategy.config ?? null
      // If caller also sent config (re-deploy with new config), update it
      if (body.config) {
        config = body.config
        updateStrategyConfig(strategyId, config)
      }
    } else if (body.legs?.length && body.underlying) {
      // Deploy inline — legs passed directly from strategy builder
      legs         = body.legs
      underlying   = body.underlying
      strategyName = body.name ?? `${underlying} Strategy`
      config       = body.config ?? null
      const firstExpiry = body.legs[0]?.expiryDate ?? body.legs[0]?.expiry
                        ?? new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }).replace(/ /g,'-')
      strategyId   = createStrategy({
        name:          strategyName,
        underlying,
        legs,
        config,
        status:        'DRAFT',
        expiryDate:    firstExpiry,
        templateId:    null,
        targetPnl:     null,
        stopLossPnl:   null,
        paperAccountId: null,
        notes:         null,
      })
    } else {
      return NextResponse.json({ error: 'strategyId OR legs+underlying required' }, { status: 400 })
    }

    /* ── Entry time validation ── */
    if (config?.entryTime && target === 'paper') {
      const now   = new Date()
      const [h, m] = config.entryTime.split(':').map(Number)
      const entryMs = h * 60 + m
      const nowMs   = now.getHours() * 60 + now.getMinutes()
      if (nowMs < entryMs) {
        log.warn('strategy', `"${strategyName}" deployed before entry time ${config.entryTime} (current: ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')})`)
        // Allow deploy but log warning — paper trading can be tested any time
      }
    }

    /* ── Paper Trading ── */
    if (target === 'paper') {
      const underlyingLTP = await getLTP(underlying) ?? 0

      for (const leg of legs) {
        const strike  = leg.strikePrice  ?? leg.strike  ?? null
        const expiry  = leg.expiryDate   ?? leg.expiry   ?? null
        // Respect leg's lots and lotSize from builder
        const lots    = leg.lots ?? 1
        const lotSize = leg.lotSize ?? 75
        const qty     = lots * lotSize
        const price   = leg.premium > 0 ? leg.premium
                      : leg.type === 'FUT' ? underlyingLTP
                      : 0
        const isBuy   = (leg.action ?? 'BUY') === 'BUY'

        // 1. Create order
        // Map entryType to DB enum: SLM → SL-M
        const orderType = leg.entryType === 'SLM' ? 'SL-M'
                        : leg.entryType === 'LIMIT' ? 'LIMIT'
                        : 'MARKET'

        const orderId = createOrder({
          accountId,
          symbol:          underlying,
          exchange:        'NFO',
          segment:         'FO',
          orderType,
          transactionType: leg.action ?? 'BUY',
          productType:     'NRML',
          quantity:        qty,
          price,
          triggerPrice:    null,
          status:          'PENDING',
          optionType:      leg.type !== 'FUT' ? (leg.type ?? null) : null,
          strikePrice:     strike,
          expiryDate:      expiry,
          strategyId,
          notes:           strategyName,
        })

        // 2. Execute at premium price
        updateOrderStatus(orderId, 'EXECUTED', price, qty)

        // 3. Balance adjustment
        const cost = price * qty
        updateBalance(accountId, isBuy ? -cost : cost)

        // 4. Position
        upsertPosition({
          accountId,
          symbol:       underlying,
          exchange:     'NFO',
          segment:      'FO',
          quantity:     isBuy ? qty : -qty,
          averagePrice: price,
          currentPrice: price,
          productType:  'NRML',
          optionType:   leg.type !== 'FUT' ? (leg.type ?? null) : null,
          strikePrice:  strike,
          expiryDate:   expiry,
          realizedPnl:  0,
        })

        // 5. Trade record
        recordTrade({
          accountId,
          orderId,
          symbol:          underlying,
          exchange:        'NFO',
          segment:         'FO',
          transactionType: leg.action ?? 'BUY',
          quantity:        qty,
          price,
          optionType:      leg.type !== 'FUT' ? (leg.type ?? null) : null,
          strikePrice:     strike,
          expiryDate:      expiry,
          pnl:             null,
          executedAt:      new Date().toISOString(),
        })
      }

      updateStrategyStatus(strategyId, 'PAPER')
      log.trade('strategy', `"${strategyName}" deployed to paper trading (${legs.length} legs)${config ? ` | SL: ${config.slValue}${config.slType === 'percent' ? '%' : 'pts'} | Target: ${config.targetValue}${config.targetType === 'percent' ? '%' : 'pts'}` : ''}`)
      return NextResponse.json({ success: true, target: 'paper', strategyId })
    }

    /* ── Live Trading ── */
    if (target === 'live') {
      updateStrategyStatus(strategyId, 'LIVE')
      log.trade('strategy', `"${strategyName}" deployed LIVE (${legs.length} legs)`)
      return NextResponse.json({ success: true, target: 'live', strategyId, note: 'Requires broker connection' })
    }

    return NextResponse.json({ error: 'target must be paper or live' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
