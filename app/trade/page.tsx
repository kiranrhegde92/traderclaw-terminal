'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Topbar from '@/components/layout/Topbar'
import TerminalCard from '@/components/ui/TerminalCard'
import Spinner from '@/components/ui/Spinner'
import GTTOrderList from '@/components/trade/GTTOrderList'
import QuickOrderModal from '@/components/trade/QuickOrderModal'
import HotkeyLegend from '@/components/common/HotkeyLegend'
import { X, RefreshCw, TrendingUp, BookOpen, Bell, Zap } from 'lucide-react'
import { openOrderModal } from '@/components/trade/OrderModal'
import { useHotkeys } from '@/hooks/useHotkeys'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'var(--amber)',
  OPEN:      'var(--amber)',
  COMPLETE:  'var(--green)',
  EXECUTED:  'var(--green)',
  REJECTED:  'var(--red)',
  CANCELLED: 'var(--text-dim)',
  UNKNOWN:   'var(--text-muted)',
}

const BROKER_COLOR: Record<string, string> = {
  angelone: 'var(--cyan)',
  zerodha:  'var(--amber)',
  paper:    'var(--text-muted)',
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase()
  const color = STATUS_COLOR[s] ?? 'var(--text-muted)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      fontFamily: 'JetBrains Mono', letterSpacing: 1,
    }}>{s}</span>
  )
}

function BrokerTag({ broker }: { broker: string }) {
  const color = BROKER_COLOR[broker] ?? 'var(--text-dim)'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      textTransform: 'uppercase', letterSpacing: 1,
    }}>{broker}</span>
  )
}

async function cancelOrder(orderId: string, broker: string) {
  await fetch(`/api/trade/order/${orderId}?broker=${broker}`, { method: 'DELETE' })
}

export default function TradePage() {
  const [tab, setTab] = useState<'orders' | 'trades' | 'gtt'>('orders')
  const [quickOrderOpen, setQuickOrderOpen] = useState(false)
  const [quickOrderSide, setQuickOrderSide] = useState<'BUY' | 'SELL'>('BUY')

  const {
    data: ordData, mutate: mutateOrders, isLoading: ordLoading,
  } = useSWR('/api/trade/orders', fetcher, { refreshInterval: 5000 })

  const {
    data: trdData, mutate: mutTrades, isLoading: trdLoading,
  } = useSWR('/api/trade/trades', fetcher, { refreshInterval: 5000 })

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

  const orders = ordData?.orders ?? []
  const trades = trdData?.trades ?? []

  const liveOrders  = orders.filter((o: any) => o.broker !== 'paper')
  const paperOrders = orders.filter((o: any) => o.broker === 'paper')
  const liveTrades  = trades.filter((t: any) => t.broker !== 'paper')
  const paperTrades = trades.filter((t: any) => t.broker === 'paper')

  const isPending = (s: string) => ['PENDING', 'OPEN', 'TRIGGER PENDING'].includes(s?.toUpperCase())

  const handleCancel = async (orderId: string, broker: string) => {
    if (!confirm(`Cancel order #${orderId}?`)) return
    await cancelOrder(orderId, broker)
    mutateOrders()
  }

  const cell: React.CSSProperties = {
    padding: '6px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'JetBrains Mono',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }
  const hcell: React.CSSProperties = {
    ...cell, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase',
  }

  function OrderTable({ rows, showCancel }: { rows: any[]; showCancel?: boolean }) {
    if (!rows.length) return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
        No orders found
      </div>
    )
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol','Type','Qty','Price','Avg','Status','Broker','Time', showCancel ? '' : null]
                .filter(Boolean)
                .map(h => <th key={h} style={{ ...hcell, textAlign: 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((o: any) => (
              <tr key={o.orderId} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...cell, color: o.txnType === 'BUY' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {o.symbol}
                </td>
                <td style={{ ...cell, color: o.txnType === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                  {o.txnType}
                </td>
                <td style={cell}>{o.qty} <span style={{ color: 'var(--text-dim)' }}>/ {o.filledQty}</span></td>
                <td style={cell}>{o.price > 0 ? `₹${o.price.toFixed(2)}` : 'MKT'}</td>
                <td style={cell}>{o.avgPrice > 0 ? `₹${o.avgPrice.toFixed(2)}` : '—'}</td>
                <td style={cell}><StatusBadge status={o.status} /></td>
                <td style={cell}><BrokerTag broker={o.broker} /></td>
                <td style={{ ...cell, color: 'var(--text-dim)', fontSize: 11 }}>
                  {o.time ? new Date(o.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                </td>
                {showCancel && (
                  <td style={cell}>
                    {isPending(o.status) && (
                      <button onClick={() => handleCancel(o.orderId, o.broker)}
                        style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44',
                          borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
                        <X size={10} style={{ display: 'inline', marginRight: 2 }} />Cancel
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function TradeTable({ rows }: { rows: any[] }) {
    if (!rows.length) return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
        No trades found
      </div>
    )
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol','Type','Qty','Trade Price','Value','Broker','Time']
                .map(h => <th key={h} style={{ ...hcell, textAlign: 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => (
              <tr key={t.tradeId}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...cell, color: t.txnType === 'BUY' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                  {t.symbol}
                </td>
                <td style={{ ...cell, color: t.txnType === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                  {t.txnType}
                </td>
                <td style={cell}>{t.qty}</td>
                <td style={cell}>₹{t.tradePrice.toFixed(2)}</td>
                <td style={cell}>₹{t.value.toFixed(0)}</td>
                <td style={cell}><BrokerTag broker={t.broker} /></td>
                <td style={{ ...cell, color: 'var(--text-dim)', fontSize: 11 }}>
                  {t.time ? new Date(t.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <Topbar title="Orders & Trades" />
      <div className="page-content space-y-4">

        {/* Quick Order Modal */}
        <QuickOrderModal
          open={quickOrderOpen}
          onClose={() => setQuickOrderOpen(false)}
          side={quickOrderSide}
          onSuccess={() => {
            mutateOrders()
            mutTrades()
          }}
        />

        {/* Tab bar + Quick Order Buttons */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0, alignItems: 'center' }}>
          {(['orders', 'trades', 'gtt'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: 'transparent', border: 'none', fontFamily: 'JetBrains Mono',
                letterSpacing: 1, textTransform: 'uppercase',
                color: tab === t ? 'var(--cyan)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
              }}>
              {t === 'orders' ? <><BookOpen size={12} style={{ display: 'inline', marginRight: 5 }} />Order Book</> :
               t === 'trades' ? <><TrendingUp size={12} style={{ display: 'inline', marginRight: 5 }} />Trade Book</> :
               <><Bell size={12} style={{ display: 'inline', marginRight: 5 }} />GTT Orders</>}
            </button>
          ))}

          {/* Spacer */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Quick Buy/Sell Buttons */}
            <button onClick={() => { setQuickOrderSide('BUY'); setQuickOrderOpen(true) }}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: '#00ff4122', border: '1px solid #00ff4144',
                borderRadius: 4, color: '#00ff41', fontFamily: 'JetBrains Mono',
                letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#00ff4144')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00ff4122')}
              title="F1 or Ctrl+B">
              <TrendingUp size={11} style={{ display: 'inline', marginRight: 4 }} />
              BUY
            </button>
            <button onClick={() => { setQuickOrderSide('SELL'); setQuickOrderOpen(true) }}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: '#ff004022', border: '1px solid #ff004044',
                borderRadius: 4, color: '#ff0040', fontFamily: 'JetBrains Mono',
                letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ff004044')}
              onMouseLeave={e => (e.currentTarget.style.background = '#ff004022')}
              title="F2 or Ctrl+S">
              <TrendingUp size={11} style={{ display: 'inline', marginRight: 4, transform: 'rotate(180deg)' }} />
              SELL
            </button>

            {/* Refresh */}
            <button onClick={() => { mutateOrders(); mutTrades() }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '8px 12px' }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {tab === 'orders' && (
          <>
            {ordLoading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
              <>
                {/* Live orders */}
                {liveOrders.length > 0 && (
                  <TerminalCard title={`Live Orders (${ordData?.broker?.toUpperCase() ?? 'BROKER'})`} accent="cyan">
                    <OrderTable rows={liveOrders} showCancel />
                  </TerminalCard>
                )}
                {/* Paper orders */}
                <TerminalCard title="Paper Orders" accent="amber">
                  <OrderTable rows={paperOrders} showCancel />
                </TerminalCard>
              </>
            )}
          </>
        )}

        {tab === 'trades' && (
          <>
            {trdLoading ? <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div> : (
              <>
                {liveTrades.length > 0 && (
                  <TerminalCard title={`Live Trades (${trdData?.broker?.toUpperCase() ?? 'BROKER'})`} accent="cyan">
                    <TradeTable rows={liveTrades} />
                  </TerminalCard>
                )}
                <TerminalCard title="Paper Trades" accent="amber">
                  <TradeTable rows={paperTrades} />
                </TerminalCard>
              </>
            )}
          </>
        )}

        {tab === 'gtt' && <GTTOrderList />}

        {/* Hotkey Legend Footer */}
        <HotkeyLegend collapsed={true} />
      </div>
    </>
  )
}
