import { NextRequest, NextResponse } from 'next/server'
import { createOrder, getOrders, cancelOrder, updateOrderStatus } from '@/lib/db/queries/paper-trades'
import { upsertPosition, updateBalance, recordTrade } from '@/lib/db/queries/paper-trades'
import { getLTP } from '@/lib/data/yfinance-proxy'
import { log } from '@/lib/utils/logger'
import { z } from 'zod'

const OrderSchema = z.object({
  accountId:       z.number().int().positive().default(1),
  symbol:          z.string().min(1).max(50),
  exchange:        z.string().optional(),
  segment:         z.string().optional(),
  transactionType: z.enum(['BUY', 'SELL']),
  orderType:       z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M']),
  productType:     z.string().optional(),
  quantity:        z.number().int().positive().max(100000),
  price:           z.number().min(0).optional().nullable(),
  triggerPrice:    z.number().min(0).optional().nullable(),
  strategyId:      z.number().int().positive().optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
  optionType:      z.string().optional().nullable(),
  strikePrice:     z.number().optional().nullable(),
  expiryDate:      z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const status    = req.nextUrl.searchParams.get('status') as any
  const data      = getOrders(accountId, status)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = OrderSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }
    const body      = parsed.data
    const accountId = body.accountId

    // Create the order
    const orderId = createOrder({
      accountId,
      symbol:          body.symbol,
      exchange:        body.exchange ?? 'NSE',
      segment:         (body.segment ?? 'EQ') as 'EQ' | 'FO',
      orderType:       body.orderType as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
      transactionType: body.transactionType,
      productType:     (body.productType ?? 'MIS') as 'CNC' | 'MIS' | 'NRML',
      quantity:        body.quantity,
      price:           body.price ?? null,
      triggerPrice:    body.triggerPrice ?? null,
      status:          'PENDING',
      optionType:      (body.optionType ?? null) as 'CE' | 'PE' | null,
      strikePrice:     body.strikePrice ?? null,
      expiryDate:      body.expiryDate ?? null,
      strategyId:      body.strategyId ?? null,
      notes:           body.notes ?? null,
    })

    // Immediately execute MARKET orders
    if (body.orderType === 'MARKET') {
      const ltp = await getLTP(body.symbol) ?? body.price ?? 0
      await executeOrder(orderId, accountId, body, ltp)
    }

    log.trade('paper', `Order placed: ${body.transactionType} ${body.symbol} x${body.quantity} [${body.orderType}] #${orderId}`)
    return NextResponse.json({ success: true, orderId })
  } catch (err: any) {
    log.error('paper', `Order failed: ${err.message}`)
    return NextResponse.json({ error: 'Order failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (body?.id) {
    // Cancel single order
    cancelOrder(body.id)
    log.trade('paper', `Order #${body.id} cancelled`)
  } else {
    // Clear all orders for account (reset)
    const accountId = parseInt(new URL(req.url).searchParams.get('accountId') ?? '1')
    const { getDb } = await import('@/lib/db')
    getDb().prepare('DELETE FROM paper_orders WHERE account_id = ?').run(accountId)
    log.trade('paper', 'All orders cleared')
  }
  return NextResponse.json({ success: true })
}

async function executeOrder(orderId: number, accountId: number, body: any, fillPrice: number) {
  const qty  = body.quantity
  const isBuy = body.transactionType === 'BUY'
  const cost  = fillPrice * qty

  updateOrderStatus(orderId, 'EXECUTED', fillPrice, qty)

  // Adjust balance
  updateBalance(accountId, isBuy ? -cost : cost)

  // Update position
  upsertPosition({
    accountId,
    symbol:       body.symbol,
    exchange:     body.exchange ?? 'NSE',
    segment:      body.segment ?? 'EQ',
    quantity:     isBuy ? qty : -qty,
    averagePrice: fillPrice,
    currentPrice: fillPrice,
    productType:  body.productType ?? 'MIS',
    optionType:   body.optionType ?? null,
    strikePrice:  body.strikePrice ?? null,
    expiryDate:   body.expiryDate ?? null,
    realizedPnl:  0,
  })

  // Record trade
  recordTrade({
    accountId,
    orderId,
    symbol:          body.symbol,
    exchange:        body.exchange ?? 'NSE',
    segment:         body.segment ?? 'EQ',
    transactionType: body.transactionType,
    quantity:        qty,
    price:           fillPrice,
    optionType:      body.optionType ?? null,
    strikePrice:     body.strikePrice ?? null,
    expiryDate:      body.expiryDate ?? null,
    pnl:             null,
    executedAt:      new Date().toISOString(),
  })

  log.trade('paper', `✓ Executed: ${body.transactionType} ${body.symbol} x${qty} @ ₹${fillPrice.toFixed(2)}`)
}
