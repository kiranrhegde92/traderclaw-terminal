'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store'
import { X, TrendingUp, TrendingDown, Zap, AlertCircle } from 'lucide-react'

/* ── Symbol list (top F&O stocks + indices) ─────────────────────────── */
const QUICK_SYMBOLS = [
  'NIFTY','BANKNIFTY','FINNIFTY',
  'RELIANCE','TCS','HDFCBANK','INFOSYS','ICICIBANK','WIPRO','AXISBANK',
  'TATAMOTORS','SBIN','LT','BAJFINANCE','KOTAKBANK','MARUTI','SUNPHARMA',
  'ADANIENT','TATASTEEL','JSWSTEEL','HINDALCO','NTPC','POWERGRID','ONGC',
  'BHARTIARTL','ITC','HINDUNILVR','NESTLEIND','TITAN','ASIANPAINT',
]

const ORDER_TYPES = ['MARKET', 'LIMIT', 'SL', 'SL-M'] as const
type OrderType = typeof ORDER_TYPES[number]

const PRODUCT_TYPES = [
  { value: 'MIS',  label: 'MIS',  desc: 'Intraday' },
  { value: 'CNC',  label: 'CNC',  desc: 'Delivery' },
  { value: 'NRML', label: 'NRML', desc: 'Overnight' },
]

const EXCHANGES = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']

interface OrderForm {
  symbol:       string
  exchange:     string
  txnType:      'BUY' | 'SELL'
  orderType:    OrderType
  productType:  string
  qty:          string
  price:        string
  triggerPrice: string
  broker:       string
}

const DEFAULT_FORM: OrderForm = {
  symbol: '', exchange: 'NSE', txnType: 'BUY',
  orderType: 'MARKET', productType: 'MIS',
  qty: '', price: '', triggerPrice: '', broker: 'paper',
}

/* ── Global event system ─────────────────────────────────────────────── */
export function openOrderModal(opts?: { symbol?: string; txnType?: 'BUY' | 'SELL' }) {
  window.dispatchEvent(new CustomEvent('traderclaw:order:open', { detail: opts ?? {} }))
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function OrderModal() {
  const { isConnected, profile } = useAuthStore()
  const [open,       setOpen]       = useState(false)
  const [form,       setForm]       = useState<OrderForm>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<{ success: boolean; message: string } | null>(null)
  const [symQuery,   setSymQuery]   = useState('')
  const [symFocus,   setSymFocus]   = useState(false)
  const symRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  // Detect available broker from session
  const [activeBroker, setActiveBroker] = useState<'angelone' | 'zerodha' | 'paper'>('paper')

  useEffect(() => {
    fetch('/api/market/source').then(r => r.json()).then(d => {
      if (d.broker === 'zerodha')  setActiveBroker('zerodha')
      else if (d.broker === 'angelone') setActiveBroker('angelone')
      else setActiveBroker('paper')
    }).catch(() => {})
  }, [isConnected])

  useEffect(() => {
    setForm(f => ({ ...f, broker: activeBroker }))
  }, [activeBroker])

  /* ── Keyboard shortcut + custom event ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F9' || (e.ctrlKey && e.key === 'o')) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    function onEvent(e: Event) {
      const detail = (e as CustomEvent).detail ?? {}
      setForm(f => ({
        ...DEFAULT_FORM,
        broker: activeBroker,
        symbol:  detail.symbol  ?? f.symbol,
        txnType: detail.txnType ?? 'BUY',
      }))
      setSymQuery(detail.symbol ?? '')
      setResult(null)
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('traderclaw:order:open', onEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('traderclaw:order:open', onEvent)
    }
  }, [activeBroker])

  useEffect(() => {
    if (open) setTimeout(() => (form.symbol ? qtyRef.current?.focus() : symRef.current?.focus()), 50)
  }, [open])

  const set = (key: keyof OrderForm, val: string) => setForm(f => ({ ...f, [key]: val }))

  const filteredSymbols = symQuery.length >= 1
    ? QUICK_SYMBOLS.filter(s => s.startsWith(symQuery.toUpperCase())).slice(0, 8)
    : []

  const needsPrice   = form.orderType === 'LIMIT' || form.orderType === 'SL'
  const needsTrigger = form.orderType === 'SL'    || form.orderType === 'SL-M'

  const estimatedValue = form.qty && form.price
    ? Number(form.qty) * Number(form.price)
    : form.qty && form.orderType === 'MARKET' ? null : null

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.symbol.trim()) { setResult({ success: false, message: 'Symbol is required' }); return }
    if (!form.qty || Number(form.qty) <= 0) { setResult({ success: false, message: 'Quantity must be > 0' }); return }
    if (needsPrice && (!form.price || Number(form.price) <= 0)) { setResult({ success: false, message: 'Price required for this order type' }); return }
    if (needsTrigger && (!form.triggerPrice || Number(form.triggerPrice) <= 0)) { setResult({ success: false, message: 'Trigger price required' }); return }

    setSubmitting(true); setResult(null)
    try {
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker:       form.broker,
          symbol:       form.symbol.toUpperCase(),
          exchange:     form.exchange,
          txnType:      form.txnType,
          orderType:    form.orderType === 'SL-M' ? 'STOPLOSS_MARKET' : form.orderType,
          productType:  form.productType,
          qty:          Number(form.qty),
          price:        needsPrice    ? Number(form.price)        : 0,
          triggerPrice: needsTrigger  ? Number(form.triggerPrice) : undefined,
          variety:      form.orderType.startsWith('SL') ? 'STOPLOSS' : 'NORMAL',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Order failed')
      setResult({ success: true, message: `${form.txnType} order placed #${json.orderId}` })
      setTimeout(() => setOpen(false), 1800)
    } catch (err: any) {
      setResult({ success: false, message: err.message })
    } finally {
      setSubmitting(false)
    }
  }, [form, needsPrice, needsTrigger])

  if (!open) return null

  const isBuy  = form.txnType === 'BUY'
  const accent = isBuy ? '#00ff41' : '#ff0040'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: '#0d0d0d', border: `1px solid ${accent}44`,
        borderRadius: 8, width: 420, maxWidth: '95vw',
        boxShadow: `0 0 40px ${accent}22`,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: accent, letterSpacing: '0.06em' }}>
              ORDER ENTRY
            </span>
            <span style={{ fontSize: 9, color: '#444', letterSpacing: '0.05em' }}>F9</span>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16 }}>

          {/* BUY / SELL tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 6, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
            {(['BUY', 'SELL'] as const).map(side => (
              <button key={side} type="button"
                onClick={() => set('txnType', side)}
                style={{
                  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', border: 'none',
                  color:      form.txnType === side ? '#000' : side === 'BUY' ? '#00ff4188' : '#ff004088',
                  background: form.txnType === side ? (side === 'BUY' ? '#00ff41' : '#ff0040') : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {side === 'BUY' ? <TrendingUp size={12} style={{ display: 'inline', marginRight: 5 }} /> : <TrendingDown size={12} style={{ display: 'inline', marginRight: 5 }} />}
                {side}
              </button>
            ))}
          </div>

          {/* Symbol + Exchange row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, position: 'relative' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>SYMBOL</label>
              <input ref={symRef} value={symQuery} autoComplete="off"
                onChange={e => { setSymQuery(e.target.value.toUpperCase()); set('symbol', e.target.value.toUpperCase()) }}
                onFocus={() => setSymFocus(true)}
                onBlur={() => setTimeout(() => setSymFocus(false), 150)}
                placeholder="RELIANCE"
                style={{ width: '100%', background: '#111', border: `1px solid ${form.symbol ? '#333' : '#222'}`,
                  borderRadius: 4, padding: '7px 10px', color: '#eee', fontSize: 13, fontFamily: 'JetBrains Mono',
                  outline: 'none', textTransform: 'uppercase', boxSizing: 'border-box' }}
              />
              {symFocus && filteredSymbols.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#111', border: '1px solid #222', borderRadius: 4, marginTop: 2 }}>
                  {filteredSymbols.map(s => (
                    <button key={s} type="button"
                      onMouseDown={() => { set('symbol', s); setSymQuery(s); setSymFocus(false); qtyRef.current?.focus() }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                        fontSize: 12, color: '#ccc', background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'JetBrains Mono' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ width: 80 }}>
              <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>EXCH</label>
              <select value={form.exchange} onChange={e => set('exchange', e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4,
                  padding: '7px 6px', color: '#eee', fontSize: 12, fontFamily: 'JetBrains Mono', outline: 'none' }}>
                {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
          </div>

          {/* Order type + Product type */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>ORDER TYPE</label>
              <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden', border: '1px solid #222' }}>
                {ORDER_TYPES.map(ot => (
                  <button key={ot} type="button" onClick={() => set('orderType', ot)}
                    style={{ flex: 1, padding: '6px 0', fontSize: 10, cursor: 'pointer', fontFamily: 'JetBrains Mono',
                      border: 'none', letterSpacing: '0.04em',
                      color:      form.orderType === ot ? accent      : '#555',
                      background: form.orderType === ot ? `${accent}22` : 'transparent',
                    }}
                  >{ot}</button>
                ))}
              </div>
            </div>
            <div style={{ width: 110 }}>
              <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>PRODUCT</label>
              <select value={form.productType} onChange={e => set('productType', e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4,
                  padding: '7px 6px', color: '#eee', fontSize: 12, fontFamily: 'JetBrains Mono', outline: 'none' }}>
                {PRODUCT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label} — {pt.desc}</option>)}
              </select>
            </div>
          </div>

          {/* Qty + Price + Trigger */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>QTY</label>
              <input ref={qtyRef} type="number" min="1" value={form.qty}
                onChange={e => set('qty', e.target.value)}
                placeholder="1"
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4,
                  padding: '7px 10px', color: '#eee', fontSize: 13, fontFamily: 'JetBrains Mono',
                  outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {needsPrice && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>PRICE</label>
                <input type="number" step="0.05" min="0" value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4,
                    padding: '7px 10px', color: '#eee', fontSize: 13, fontFamily: 'JetBrains Mono',
                    outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
            {needsTrigger && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>TRIGGER</label>
                <input type="number" step="0.05" min="0" value={form.triggerPrice}
                  onChange={e => set('triggerPrice', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 4,
                    padding: '7px 10px', color: '#eee', fontSize: 13, fontFamily: 'JetBrains Mono',
                    outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          {/* Broker selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 9, color: '#555', marginBottom: 3, letterSpacing: '0.06em' }}>BROKER</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { value: 'angelone', label: 'Angel One', color: '#00e5ff'  },
                { value: 'zerodha',  label: 'Zerodha',   color: '#387ed1'  },
                { value: 'paper',    label: 'Paper',     color: '#888'     },
              ].map(b => (
                <button key={b.value} type="button"
                  onClick={() => set('broker', b.value)}
                  style={{ flex: 1, padding: '5px 0', fontSize: 10, fontFamily: 'JetBrains Mono',
                    cursor: 'pointer', borderRadius: 4, letterSpacing: '0.04em',
                    color:      form.broker === b.value ? b.color        : '#444',
                    background: form.broker === b.value ? `${b.color}18` : 'transparent',
                    border:    `1px solid ${form.broker === b.value ? `${b.color}44` : '#1e1e1e'}`,
                  }}
                >{b.label}</button>
              ))}
            </div>
          </div>

          {/* Estimated value & charges */}
          {form.qty && form.price && (
            <div style={{ marginBottom: 12, padding: '8px 10px', background: '#111', borderRadius: 4, border: '1px solid #1a1a1a', fontSize: 10, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>
                Value: <span style={{ color: accent, fontWeight: 700, marginLeft: 6 }}>
                  ₹{(Number(form.qty) * Number(form.price)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              {form.broker === 'angelone' && (
                <>
                  <div style={{ marginBottom: 3 }}>
                    Brokerage (0.03%): <span style={{ color: '#888', marginLeft: 6 }}>
                      ₹{((Number(form.qty) * Number(form.price)) * 0.0003).toFixed(2)}
                    </span>
                  </div>
                  {form.productType === 'MIS' && (
                    <div>
                      Margin req (20%): <span style={{ color: '#888', marginLeft: 6 }}>
                        ₹{((Number(form.qty) * Number(form.price)) * 0.20).toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {form.broker === 'zerodha' && (
                <>
                  <div style={{ marginBottom: 3 }}>
                    Brokerage (0.04%): <span style={{ color: '#888', marginLeft: 6 }}>
                      ₹{((Number(form.qty) * Number(form.price)) * 0.0004).toFixed(2)}
                    </span>
                  </div>
                  {form.productType === 'MIS' && (
                    <div>
                      Margin req (20%): <span style={{ color: '#888', marginLeft: 6 }}>
                        ₹{((Number(form.qty) * Number(form.price)) * 0.20).toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Broker not connected warning */}
          {form.broker !== 'paper' && !isConnected && (
            <div style={{ marginBottom: 10, padding: '7px 10px', background: 'rgba(255,183,0,0.08)',
              border: '1px solid rgba(255,183,0,0.3)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <AlertCircle size={12} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <span style={{ color: 'var(--amber)' }}>Not connected to {form.broker === 'angelone' ? 'Angel One' : 'Zerodha'}. Order will be rejected.</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ marginBottom: 10, padding: '7px 10px',
              background: result.success ? 'rgba(0,255,65,0.08)' : 'rgba(255,0,64,0.08)',
              border: `1px solid ${result.success ? 'rgba(0,255,65,0.3)' : 'rgba(255,0,64,0.3)'}`,
              borderRadius: 4, fontSize: 12,
              color: result.success ? 'var(--green)' : 'var(--red)' }}>
              {result.message}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting}
            style={{
              width: '100%', padding: '11px 0', fontSize: 13, fontWeight: 700,
              fontFamily: 'JetBrains Mono', letterSpacing: '0.08em', cursor: submitting ? 'wait' : 'pointer',
              borderRadius: 5, border: 'none',
              color: '#000',
              background: submitting ? '#333' : accent,
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {submitting ? 'PLACING…' : `${form.txnType} ${form.symbol || '—'}`}
          </button>
          <p style={{ textAlign: 'center', fontSize: 9, color: '#333', marginTop: 8, letterSpacing: '0.05em' }}>
            F9 to open · ESC to close · {form.broker === 'paper' ? 'PAPER TRADE' : 'LIVE ORDER'}
          </p>
        </form>
      </div>
    </div>
  )
}
