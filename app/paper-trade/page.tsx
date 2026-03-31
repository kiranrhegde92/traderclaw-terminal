'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Tabs from '@/components/ui/Tabs'
import Spinner from '@/components/ui/Spinner'
import QuickOrderModal from '@/components/trade/QuickOrderModal'
import HotkeyLegend from '@/components/common/HotkeyLegend'
import { formatINR, formatPct } from '@/lib/utils/format'
import { BookOpen, TrendingUp, TrendingDown, X, RefreshCw, ChevronDown, ChevronRight, GitBranch, Trash2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useHotkeys } from '@/hooks/useHotkeys'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PaperTradePage() {
  const [quickOrderOpen, setQuickOrderOpen] = useState(false)
  const [quickOrderSide, setQuickOrderSide] = useState<'BUY' | 'SELL'>('BUY')

  const { data: balData, mutate: mutateBal } = useSWR('/api/paper-trade/balance?accountId=1',   fetcher, { refreshInterval: 30000 })
  const { data: posData, mutate: mutatePOS } = useSWR('/api/paper-trade/positions?accountId=1', fetcher, { refreshInterval: 15000 })
  const { data: ordData, mutate: mutateORD } = useSWR('/api/paper-trade/orders?accountId=1',    fetcher, { refreshInterval: 15000 })
  const { data: hstData, mutate: mutateHST } = useSWR('/api/paper-trade/history?accountId=1',  fetcher)
  const { data: pnlData }                    = useSWR('/api/paper-trade/pnl-history?accountId=1', fetcher, { refreshInterval: 60000 })

  // Setup hotkeys
  useHotkeys({
    onBuy: () => {
      setQuickOrderSide('BUY')
      setQuickOrderOpen(true)
    },
    onSell: () => {
      setQuickOrderSide('SELL')
      setQuickOrderOpen(true)
    },
    onClose: () => setQuickOrderOpen(false),
  })

  // Strategy monitor — polls every 15s, auto-exits on SL/target/time
  const { data: monData } = useSWR(
    '/api/paper-trade/monitor?accountId=1',
    async (url) => {
      const r = await fetch(url)
      const d = await r.json()
      // Refresh if any strategy was auto-exited OR any leg was individually exited
      const hasExits = d.data?.some((s: any) => s.exited || s.legTriggers?.length > 0)
      if (hasExits) {
        mutateBal(); mutatePOS(); mutateORD(); mutateHST()
      }
      return d
    },
    { refreshInterval: 15000 }
  )
  const monitorMap = useMemo(() => {
    const m = new Map<number, any>()
    for (const s of monData?.data ?? []) m.set(s.strategyId, s)
    return m
  }, [monData])

  const balance   = balData?.data
  const positions = posData?.data ?? []
  const orders    = ordData?.data ?? []
  const history   = hstData?.data ?? []
  const pnlHistory = pnlData?.data ?? []

  function refresh() { mutateBal(); mutatePOS(); mutateORD(); mutateHST() }

  async function resetAccount() {
    if (!confirm('Reset paper trading account? This will clear all positions, orders, trade history and restore balance to ₹10,00,000.')) return
    await Promise.all([
      fetch('/api/paper-trade/positions?accountId=1', { method: 'DELETE' }),
      fetch('/api/paper-trade/history?accountId=1',   { method: 'DELETE' }),
      fetch('/api/paper-trade/orders?accountId=1',    { method: 'DELETE' }),
      fetch('/api/paper-trade/balance?accountId=1',   { method: 'DELETE' }),
    ])
    refresh()
  }

  async function clearPositions() {
    if (!confirm('Clear all open positions?')) return
    await fetch('/api/paper-trade/positions?accountId=1', { method: 'DELETE' })
    mutatePOS(); mutateBal()
  }

  async function clearHistory() {
    if (!confirm('Clear all trade history?')) return
    await fetch('/api/paper-trade/history?accountId=1', { method: 'DELETE' })
    mutateHST()
  }

  return (
    <>
      <Topbar title="Paper Trade" />
      <div className="page-content space-y-4">

        {/* Quick Order Modal */}
        <QuickOrderModal
          open={quickOrderOpen}
          onClose={() => setQuickOrderOpen(false)}
          side={quickOrderSide}
          onSuccess={() => {
            mutateBal()
            mutateORD()
            mutateHST()
          }}
        />

        {/* Balance Bar — Feature 3: Realized vs Unrealized P&L Split */}
        {balance && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <BalancePill label="Available"       value={formatINR(balance.availableMargin ?? balance.currentBalance)} color="var(--green)" />
            <BalancePill label="Realized P&L"    value={formatINR(balance.realizedPnl ?? 0)}   color={(balance.realizedPnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
            <BalancePill label="Unrealized P&L"  value={formatINR(balance.unrealizedPnl ?? 0)} color={(balance.unrealizedPnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
            <BalancePill label="Total P&L"       value={formatINR(balance.totalPnl ?? 0)}      color={(balance.totalPnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* Order Form */}
          <div className="col-span-12 lg:col-span-4">
            <OrderForm onOrder={refresh} availableBalance={balance?.availableMargin ?? balance?.currentBalance ?? 0} />
          </div>

          {/* Tabs: Positions / Orders / History / P&L Chart */}
          <div className="col-span-12 lg:col-span-8">
            <TerminalCard
              title="Trading Console"
              icon={<BookOpen size={12}/>}
              accent="green"
              noPadding
              action={
                <div className="flex items-center gap-1">
                  <button onClick={refresh} className="btn btn-sm btn-ghost" title="Refresh"><RefreshCw size={11}/></button>
                  <button onClick={resetAccount} className="btn btn-sm btn-ghost" title="Reset account"
                    style={{ color: 'var(--red)' }}><RotateCcw size={11}/></button>
                </div>
              }
            >
              <Tabs
                tabs={[
                  {
                    id: 'positions', label: 'Positions', badge: positions.filter((p:any) => p.quantity !== 0).length,
                    content: <PositionsTable positions={positions} orders={orders} monitorMap={monitorMap} onMutate={refresh} onClear={clearPositions} />,
                  },
                  {
                    id: 'orders', label: 'Orders', badge: orders.filter((o:any) => ['PENDING','OPEN'].includes(o.status)).length,
                    content: <OrdersTable orders={orders} onMutate={refresh} />,
                  },
                  {
                    id: 'history', label: 'History',
                    content: <HistoryTable trades={history} onClear={clearHistory} />,
                  },
                  {
                    id: 'pnlchart', label: 'P&L Chart',
                    content: <PnlChart data={pnlHistory} />,
                  },
                ]}
              />
            </TerminalCard>
          </div>
        </div>

        {/* Hotkey Legend Footer */}
        <HotkeyLegend collapsed={true} />
      </div>
    </>
  )
}

function BalancePill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="term-card p-3">
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-bold mt-1" style={{ color, fontFamily: 'JetBrains Mono' }}>{value}</div>
    </div>
  )
}

/* ─── Feature 1: P&L Equity Curve Chart ─────────────────────────────────── */

function PnlChart({ data }: { data: Array<{ date: string; dailyPnl: number; cumulativePnl: number }> }) {
  const W = 600
  const H = 200
  const PAD = { top: 24, right: 16, bottom: 32, left: 72 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
        No trade history yet
      </div>
    )
  }

  const values = data.map(d => d.cumulativePnl)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(0, ...values)
  const range  = maxVal - minVal || 1

  function xPos(i: number) {
    return PAD.left + (i / Math.max(data.length - 1, 1)) * chartW
  }
  function yPos(v: number) {
    return PAD.top + chartH - ((v - minVal) / range) * chartH
  }

  const zeroY = yPos(0)

  // Build SVG polyline points
  const points = data.map((d, i) => `${xPos(i)},${yPos(d.cumulativePnl)}`).join(' ')

  // Split path into green (>=0) and red (<0) segments for coloring
  // We use a single path with a gradient approach via stroke color per segment
  const segments: Array<{ points: string; color: string }> = []
  for (let i = 0; i < data.length - 1; i++) {
    const x1 = xPos(i);    const y1 = yPos(data[i].cumulativePnl)
    const x2 = xPos(i+1);  const y2 = yPos(data[i+1].cumulativePnl)
    const avgVal = (data[i].cumulativePnl + data[i+1].cumulativePnl) / 2
    segments.push({ points: `${x1},${y1} ${x2},${y2}`, color: avgVal >= 0 ? '#00ff41' : '#ff0040' })
  }

  const lastVal = values[values.length - 1]
  const firstVal = values[0]

  // X-axis labels: show up to 5 evenly spaced dates
  const labelCount = Math.min(5, data.length)
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round(i * (data.length - 1) / Math.max(labelCount - 1, 1))
  )

  // Y-axis labels: 3 ticks
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal]

  return (
    <div className="p-4">
      {/* Current cumulative P&L header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Cumulative P&L</span>
        <span style={{
          color: lastVal >= 0 ? 'var(--green)' : 'var(--red)',
          fontFamily: 'JetBrains Mono',
          fontSize: 18,
          fontWeight: 700,
        }}>
          {lastVal >= 0 ? '+' : ''}{formatINR(lastVal)}
        </span>
      </div>

      {/* SVG Chart */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 200, display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH}
            fill="rgba(255,255,255,0.02)" rx={2} />

          {/* Y-axis gridlines and labels */}
          {yTicks.map((v, i) => {
            const y = yPos(v)
            const isZero = v === 0
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                  stroke={isZero ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isZero ? 1 : 0.5}
                  strokeDasharray={isZero ? '4,3' : undefined}
                />
                <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                  fontSize={9} fill="rgba(224,224,224,0.5)" fontFamily="JetBrains Mono">
                  {v >= 1000 || v <= -1000
                    ? `${v >= 0 ? '' : '-'}₹${Math.abs(v/1000).toFixed(0)}k`
                    : `₹${v.toFixed(0)}`}
                </text>
              </g>
            )
          })}

          {/* Zero line label */}
          {minVal < 0 && maxVal > 0 && (
            <text x={PAD.left - 4} y={zeroY + 4} textAnchor="end"
              fontSize={9} fill="rgba(224,224,224,0.7)" fontFamily="JetBrains Mono">
              ₹0
            </text>
          )}

          {/* Shaded area under curve */}
          {data.length > 1 && (
            <polygon
              points={`${xPos(0)},${zeroY} ${points} ${xPos(data.length-1)},${zeroY}`}
              fill={lastVal >= 0 ? 'rgba(0,255,65,0.07)' : 'rgba(255,0,64,0.07)'}
            />
          )}

          {/* Colored line segments */}
          {segments.map((seg, i) => (
            <polyline key={i} points={seg.points}
              fill="none" stroke={seg.color} strokeWidth={1.5} strokeLinejoin="round" />
          ))}

          {/* Start label */}
          {data.length > 0 && (
            <text x={xPos(0)} y={yPos(firstVal) - 6} textAnchor="middle"
              fontSize={9} fill={firstVal >= 0 ? '#00ff41' : '#ff0040'} fontFamily="JetBrains Mono">
              {firstVal >= 0 ? '▲' : '▼'}
            </text>
          )}

          {/* End label */}
          {data.length > 1 && (
            <text x={xPos(data.length-1)} y={yPos(lastVal) - 6} textAnchor="middle"
              fontSize={9} fill={lastVal >= 0 ? '#00ff41' : '#ff0040'} fontFamily="JetBrains Mono">
              {lastVal >= 0 ? '▲' : '▼'}
            </text>
          )}

          {/* X-axis labels */}
          {labelIndices.map(i => (
            <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle"
              fontSize={9} fill="rgba(224,224,224,0.45)" fontFamily="JetBrains Mono">
              {data[i].date.slice(5)} {/* MM-DD */}
            </text>
          ))}

          {/* Dot at last point */}
          {data.length > 0 && (
            <circle cx={xPos(data.length-1)} cy={yPos(lastVal)} r={3}
              fill={lastVal >= 0 ? '#00ff41' : '#ff0040'} />
          )}
        </svg>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 mt-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{data.length} trading day{data.length !== 1 ? 's' : ''}</span>
        <span style={{ color: 'var(--green)' }}>
          Best: +{formatINR(Math.max(...data.map(d => d.dailyPnl)))}
        </span>
        <span style={{ color: 'var(--red)' }}>
          Worst: {formatINR(Math.min(...data.map(d => d.dailyPnl)))}
        </span>
      </div>
    </div>
  )
}

/* ─── Feature 2: Margin Calculator ──────────────────────────────────────── */

function calcMargin(price: number, qty: number, segment: string, productType: string): number {
  const fullValue = price * qty
  if (segment === 'EQ') {
    return productType === 'MIS' ? fullValue * 0.20 : fullValue
  }
  // FO
  if (productType === 'MIS') return fullValue * 0.06
  return fullValue * 0.12  // NRML / CNC
}

function OrderForm({ onOrder, availableBalance }: { onOrder: () => void; availableBalance: number }) {
  const [form, setForm] = useState({
    symbol: '', exchange: 'NSE', segment: 'EQ',
    orderType: 'MARKET', transactionType: 'BUY',
    productType: 'MIS', quantity: 1, price: '',
    triggerPrice: '', optionType: '', strikePrice: '',
    expiryDate: '',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [estMargin, setEstMargin] = useState<number | null>(null)

  // Feature 2: Live margin calculation
  useEffect(() => {
    const qty   = form.quantity
    const price = parseFloat(form.price) || 0
    if (qty > 0 && price > 0) {
      setEstMargin(calcMargin(price, qty, form.segment, form.productType))
    } else {
      setEstMargin(null)
    }
  }, [form.quantity, form.price, form.segment, form.productType])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    try {
      const body: any = {
        ...form,
        quantity: +form.quantity,
        price:         form.price         ? +form.price         : null,
        triggerPrice:  form.triggerPrice  ? +form.triggerPrice  : null,
        strikePrice:   form.strikePrice   ? +form.strikePrice   : null,
        optionType:    form.optionType    || null,
        expiryDate:    form.expiryDate    || null,
        accountId: 1,
      }
      const res  = await fetch('/api/paper-trade/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg('✓ Order placed successfully')
      onOrder()
    } catch (err: any) {
      setMsg(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const isFO = form.segment === 'FO'
  const hasSufficientBalance = estMargin !== null ? availableBalance >= estMargin : true

  return (
    <TerminalCard title="Place Order" icon={<BookOpen size={12}/>} accent="green">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Symbol</label>
          <input type="text" placeholder="RELIANCE" value={form.symbol}
            onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
            className="term-input mt-1" required />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Exchange</label>
            <select value={form.exchange} onChange={e => setForm(f => ({ ...f, exchange: e.target.value }))} className="term-select mt-1 w-full">
              <option>NSE</option><option>BSE</option>
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Segment</label>
            <select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} className="term-select mt-1 w-full">
              <option value="EQ">Equity</option>
              <option value="FO">F&O</option>
            </select>
          </div>
        </div>

        {isFO && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Type</label>
              <select value={form.optionType} onChange={e => setForm(f => ({ ...f, optionType: e.target.value }))} className="term-select mt-1 w-full">
                <option value="">FUT</option>
                <option value="CE">CE</option>
                <option value="PE">PE</option>
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Strike</label>
              <input type="number" placeholder="24000" value={form.strikePrice}
                onChange={e => setForm(f => ({ ...f, strikePrice: e.target.value }))}
                className="term-input mt-1" />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Expiry</label>
              <input type="date" value={form.expiryDate}
                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                className="term-input mt-1" />
            </div>
          </div>
        )}

        {/* BUY / SELL toggle */}
        <div className="flex gap-2">
          {['BUY','SELL'].map(t => (
            <button key={t} type="button"
              onClick={() => setForm(f => ({ ...f, transactionType: t }))}
              className={`btn flex-1 ${form.transactionType === t ? (t === 'BUY' ? 'btn-green' : 'btn-red') : 'btn-ghost'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Order Type</label>
            <select value={form.orderType} onChange={e => setForm(f => ({ ...f, orderType: e.target.value }))} className="term-select mt-1 w-full">
              <option>MARKET</option><option>LIMIT</option><option>SL</option><option value="SL-M">SL-M</option>
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Product</label>
            <select value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} className="term-select mt-1 w-full">
              <option>MIS</option><option>CNC</option><option>NRML</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Quantity</label>
            <input type="number" min={1} value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
              className="term-input mt-1" required />
          </div>
          {form.orderType !== 'MARKET' && (
            <div>
              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Price</label>
              <input type="number" step="0.05" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="term-input mt-1" />
            </div>
          )}
          {(form.orderType === 'SL' || form.orderType === 'SL-M') && (
            <div>
              <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Trigger</label>
              <input type="number" step="0.05" value={form.triggerPrice}
                onChange={e => setForm(f => ({ ...f, triggerPrice: e.target.value }))}
                className="term-input mt-1" />
            </div>
          )}
        </div>

        {/* Feature 2: Margin display */}
        {estMargin !== null && (
          <div className="flex items-center justify-between px-1">
            <span style={{ color: 'var(--cyan)', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
              Est. Margin: {formatINR(estMargin)}
            </span>
            <span style={{ fontSize: 11 }}>
              {hasSufficientBalance
                ? <span style={{ color: 'var(--green)' }}>✓ Sufficient</span>
                : <span style={{ color: 'var(--red)' }}>✗ Insufficient</span>
              }
            </span>
          </div>
        )}

        {msg && (
          <div className="text-xs p-2 rounded" style={{
            color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
            background: msg.startsWith('✓') ? 'rgba(0,255,65,0.08)' : 'rgba(255,0,64,0.08)',
          }}>{msg}</div>
        )}

        <button type="submit" disabled={loading}
          className={`btn w-full ${form.transactionType === 'BUY' ? 'btn-green' : 'btn-red'}`}>
          {loading ? <Spinner size={13}/> : null}
          {form.transactionType === 'BUY' ? 'Place Buy Order' : 'Place Sell Order'}
        </button>
      </form>
    </TerminalCard>
  )
}

function PositionRow({ p, onMutate, legConfig }: { p: any; onMutate: () => void; legConfig?: any }) {
  const [exiting, setExiting] = useState(false)
  const pnl    = p.unrealizedPnl ?? 0
  const pnlPct = p.pnlPct ?? 0
  const optType  = p.option_type ?? p.optionType
  const strike   = p.strike_price ?? p.strikePrice
  const expiry   = p.expiry_date ?? p.expiryDate
  const qty      = p.quantity ?? 0
  const label    = optType
    ? `${p.symbol} ${strike} ${optType} ${expiry ?? ''}`
    : p.symbol

  // Per-leg config badges
  const legSLBadge  = legConfig?.legSLValue  > 0 ? `SL ${legConfig.legSLValue}${legConfig.legSLType  === 'percent' ? '%' : 'p'}` : null
  const legTgtBadge = legConfig?.legTgtValue > 0 ? `T ${legConfig.legTgtValue}${legConfig.legTgtType === 'percent' ? '%' : 'p'}` : null
  const legTrlBadge = legConfig?.trailSL && legConfig.trailValue > 0 ? `Tr ${legConfig.trailValue}%` : null
  const reEntryBadge = legConfig?.reEntry > 0 ? `Re×${legConfig.reEntry}` : null

  async function exit() {
    if (qty === 0) return
    setExiting(true)
    try {
      const res = await fetch('/api/paper-trade/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId:       p.accountId ?? 1,
          symbol:          p.symbol,
          exchange:        p.exchange ?? 'NSE',
          segment:         p.segment  ?? 'EQ',
          orderType:       'MARKET',
          transactionType: qty > 0 ? 'SELL' : 'BUY',
          productType:     p.productType ?? 'MIS',
          quantity:        Math.abs(qty),
          price:           p.currentPrice ?? p.averagePrice ?? 0,
          optionType:      optType ?? null,
          strikePrice:     strike  ?? null,
          expiryDate:      expiry  ?? null,
        }),
      })
      if (!res.ok) { const j = await res.json(); alert(`Exit failed: ${j.error}`); return }
      onMutate()
    } catch (err: any) {
      alert(`Exit failed: ${err.message}`)
    } finally {
      setExiting(false)
    }
  }

  if (qty === 0) return null  // zero-qty positions hidden

  return (
    <tr>
      <td className="font-bold" style={{ color: qty > 0 ? 'var(--green)' : 'var(--red)', paddingLeft: '1.5rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Link href={`/monitor?symbol=${p.symbol}`} style={{ color: 'inherit', textDecoration: 'none' }}>{label}</Link>
          {legSLBadge  && <span className="badge badge-red"   style={{ fontSize: '8px' }}>{legSLBadge}</span>}
          {legTgtBadge && <span className="badge badge-green" style={{ fontSize: '8px' }}>{legTgtBadge}</span>}
          {legTrlBadge && <span className="badge badge-amber" style={{ fontSize: '8px' }}>{legTrlBadge}</span>}
          {reEntryBadge && <span className="badge badge-dim" style={{ fontSize: '8px' }}>{reEntryBadge}</span>}
        </span>
      </td>
      <td style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>{qty > 0 ? `+${qty}` : qty}</td>
      <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>₹{p.averagePrice?.toFixed(2)}</td>
      <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>₹{p.currentPrice?.toFixed(2) ?? '—'}</td>
      <td className="col-right" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'JetBrains Mono' }}>
        {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
      </td>
      <td className="col-right" style={{ color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {formatPct(pnlPct)}
      </td>
      <td>
        <button onClick={exit} disabled={exiting} className="btn btn-sm btn-red">
          {exiting ? <Spinner size={11}/> : 'Exit'}
        </button>
      </td>
    </tr>
  )
}

function PositionsTable({ positions, orders, monitorMap, onMutate, onClear }: {
  positions: any[]; orders: any[]; monitorMap: Map<number, any>; onMutate: () => void; onClear: () => void
}) {
  // Build lookup: posKey → { strategyId, strategyName } from orders
  const orderMap = useMemo(() => {
    const m = new Map<string, { strategyId: number; strategyName: string }>()
    for (const o of orders) {
      if (!o.strategy_id && !o.strategyId) continue
      const sid  = o.strategy_id  ?? o.strategyId
      const name = o.notes ?? `Strategy #${sid}`
      const key  = `${o.symbol}|${o.option_type ?? o.optionType ?? ''}|${o.strike_price ?? o.strikePrice ?? ''}|${o.expiry_date ?? o.expiryDate ?? ''}`
      if (!m.has(key)) m.set(key, { strategyId: sid, strategyName: name })
    }
    return m
  }, [orders])

  // Enrich positions with strategy info
  const enriched = useMemo(() => positions.map(p => {
    const key = `${p.symbol}|${p.option_type ?? p.optionType ?? ''}|${p.strike_price ?? p.strikePrice ?? ''}|${p.expiry_date ?? p.expiryDate ?? ''}`
    const info = orderMap.get(key)
    return { ...p, strategyId: info?.strategyId ?? null, strategyName: info?.strategyName ?? null }
  }), [positions, orderMap])

  // Group: strategyId → positions; null = standalone
  const groups = useMemo(() => {
    const g = new Map<string, { name: string; legs: any[] }>()
    for (const p of enriched) {
      const gid = p.strategyId != null ? String(p.strategyId) : '__standalone__'
      const gname = p.strategyName ?? 'Standalone'
      if (!g.has(gid)) g.set(gid, { name: gname, legs: [] })
      g.get(gid)!.legs.push(p)
    }
    return g
  }, [enriched])

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['__standalone__']))

  function toggle(gid: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })
  }

  if (positions.length === 0) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No open positions</div>
    )
  }

  return (
    <div className="overflow-auto p-2">
      <div className="flex justify-end mb-2">
        <button onClick={onClear} className="btn btn-sm btn-ghost" style={{ color: 'var(--red)', fontSize: '11px' }}>
          <Trash2 size={11}/> Clear All
        </button>
      </div>
      <table className="term-table">
        <thead>
          <tr>
            <th>Symbol / Strategy</th><th>Qty</th><th className="col-right">Avg</th>
            <th className="col-right">LTP</th><th className="col-right">P&L</th><th className="col-right">P&L%</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groups.entries()).map(([gid, group]) => {
            const isStandalone = gid === '__standalone__'
            const open = expanded.has(gid)
            const totalPnl = group.legs.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0)
            const totalQty = group.legs.reduce((s, p) => s + Math.abs(p.quantity ?? 0), 0)

            if (isStandalone) {
              return group.legs.map((p: any) => <PositionRow key={p.id} p={p} onMutate={onMutate} />)
            }

            return [
              // Strategy header row
              (() => {
                const mon    = monitorMap.get(Number(gid))
                const cfg    = mon?.config
                const slBadge    = cfg?.slValue    > 0 ? `SL ${cfg.slValue}${cfg.slType    === 'percent' ? '%' : 'p'}` : null
                const tgtBadge   = cfg?.targetValue > 0 ? `TGT ${cfg.targetValue}${cfg.targetType === 'percent' ? '%' : 'p'}` : null
                const timeBadge  = cfg?.exitTime ? `Exit ${cfg.exitTime}` : null
                const trailBadge = cfg?.trailingSL ? `Trail ${cfg.trailStep}p` : null
                return (
                <tr key={`hdr-${gid}`} style={{ background: 'rgba(0,212,255,0.06)', cursor: 'pointer' }}
                    onClick={() => toggle(gid)}>
                  <td colSpan={2} style={{ color: 'var(--cyan)', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {open ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                      <GitBranch size={12} style={{ opacity: 0.7 }}/>
                      {group.name}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>
                        ({group.legs.length} legs)
                      </span>
                      {slBadge    && <span className="badge badge-red"    style={{ fontSize: '9px' }}>{slBadge}</span>}
                      {tgtBadge   && <span className="badge badge-green"  style={{ fontSize: '9px' }}>{tgtBadge}</span>}
                      {trailBadge && <span className="badge badge-amber"  style={{ fontSize: '9px' }}>{trailBadge}</span>}
                      {timeBadge  && <span className="badge badge-dim"    style={{ fontSize: '9px' }}>{timeBadge}</span>}
                    </span>
                  </td>
                <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: '11px' }}>—</td>
                <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)', fontSize: '11px' }}>—</td>
                <td className="col-right" style={{ fontFamily: 'JetBrains Mono', fontWeight: 700,
                    color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalPnl >= 0 ? '+' : ''}{formatINR(totalPnl)}
                </td>
                <td className="col-right" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  {totalQty} qty
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <ExitAllLegs legs={group.legs} onMutate={onMutate} />
                </td>
              </tr>
              )
              })(),
              // Leg rows (when expanded)
              ...(open ? group.legs.map((p: any) => {
                // Find matching leg config for per-leg badges
                const mon = monitorMap.get(Number(gid))
                const legCfgs: any[] = mon?.legs ?? []
                const optT = p.option_type ?? p.optionType ?? ''
                const strk = p.strike_price ?? p.strikePrice ?? -1
                const exp  = p.expiry_date ?? p.expiryDate ?? ''
                const legCfg = legCfgs.find((l: any) => {
                  const lOpt = l.type !== 'FUT' ? (l.type ?? '') : ''
                  return lOpt === optT && Number(l.strikePrice ?? l.strike ?? -1) === Number(strk) && (l.expiryDate ?? l.expiry ?? '') === exp
                })
                return <PositionRow key={p.id} p={p} onMutate={onMutate} legConfig={legCfg} />
              }) : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExitAllLegs({ legs, onMutate }: { legs: any[]; onMutate: () => void }) {
  const [loading, setLoading] = useState(false)

  async function exitAll() {
    setLoading(true)
    try {
      await Promise.all(legs.filter(p => (p.quantity ?? 0) !== 0).map(p => {
        const qty    = p.quantity ?? 0
        const optType = p.option_type ?? p.optionType
        const strike  = p.strike_price ?? p.strikePrice
        const expiry  = p.expiry_date ?? p.expiryDate
        return fetch('/api/paper-trade/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId:       p.accountId ?? 1,
            symbol:          p.symbol,
            exchange:        p.exchange ?? 'NSE',
            segment:         p.segment  ?? 'EQ',
            orderType:       'MARKET',
            transactionType: qty > 0 ? 'SELL' : 'BUY',
            productType:     p.productType ?? 'NRML',
            quantity:        Math.abs(qty),
            price:           p.currentPrice ?? p.averagePrice ?? 0,
            optionType:      optType ?? null,
            strikePrice:     strike  ?? null,
            expiryDate:      expiry  ?? null,
          }),
        })
      }))
      onMutate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={exitAll} disabled={loading} className="btn btn-sm btn-red">
      {loading ? <Spinner size={11}/> : 'Exit All'}
    </button>
  )
}

function OrdersTable({ orders, onMutate }: { orders: any[]; onMutate: () => void }) {
  async function cancel(id: number) {
    await fetch('/api/paper-trade/orders', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    })
    onMutate()
  }

  return (
    <div className="overflow-auto p-2">
      <table className="term-table">
        <thead>
          <tr>
            <th>Symbol</th><th>Type</th><th>Side</th><th className="col-right">Qty</th>
            <th className="col-right">Price</th><th>Status</th><th>Time</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 50).map((o: any) => (
            <tr key={o.id}>
              <td className="font-bold" style={{ color: 'var(--text)' }}>{o.symbol}</td>
              <td><span className="badge badge-dim">{o.order_type ?? o.orderType}</span></td>
              <td><span className={`badge badge-${(o.transaction_type ?? o.transactionType) === 'BUY' ? 'green' : 'red'}`}>
                {o.transaction_type ?? o.transactionType}
              </span></td>
              <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>{o.quantity}</td>
              <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>
                {o.filled_price ? `₹${o.filled_price.toFixed(2)}` : o.price ? `₹${o.price.toFixed(2)}` : 'MKT'}
              </td>
              <td>
                <span className={`badge badge-${o.status === 'EXECUTED' ? 'green' : o.status === 'CANCELLED' ? 'dim' : o.status === 'REJECTED' ? 'red' : 'amber'}`}>
                  {o.status}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                {new Date((o.createdAt ?? o.created_at ?? '').replace(' ', 'T')).toLocaleTimeString('en-IN')}
              </td>
              <td>
                {['PENDING','OPEN'].includes(o.status) && (
                  <button onClick={() => cancel(o.id)} className="btn btn-sm btn-red"><X size={11}/></button>
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No orders</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function HistoryTable({ trades, onClear }: { trades: any[]; onClear: () => void }) {
  return (
    <div className="overflow-auto p-2">
      {trades.length > 0 && (
        <div className="flex justify-end mb-2">
          <button onClick={onClear} className="btn btn-sm btn-ghost" style={{ color: 'var(--red)', fontSize: '11px' }}>
            <Trash2 size={11}/> Clear History
          </button>
        </div>
      )}
      <table className="term-table">
        <thead>
          <tr>
            <th>Time</th><th>Symbol</th><th>Side</th><th className="col-right">Qty</th>
            <th className="col-right">Price</th><th className="col-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {trades.slice(0,100).map((t: any) => (
            <tr key={t.id}>
              <td style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                {new Date((t.executedAt ?? t.executed_at ?? '').replace(' ', 'T')).toLocaleString('en-IN')}
              </td>
              <td className="font-bold">{t.symbol}</td>
              <td><span className={`badge badge-${(t.transaction_type ?? t.transactionType) === 'BUY' ? 'green' : 'red'}`}>
                {t.transaction_type ?? t.transactionType}
              </span></td>
              <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>{t.quantity}</td>
              <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>₹{t.price?.toFixed(2)}</td>
              <td className="col-right" style={{ color: (t.pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {t.pnl != null ? formatINR(t.pnl) : '—'}
              </td>
            </tr>
          ))}
          {trades.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No trade history</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
