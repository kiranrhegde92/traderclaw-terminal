'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Topbar from '@/components/layout/Topbar'
import TerminalCard from '@/components/ui/TerminalCard'
import Spinner from '@/components/ui/Spinner'
import { Plus, X, Play, Trash2, RefreshCw } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface OrderLeg {
  symbol:    string
  txnType:   'BUY' | 'SELL'
  qty:       number
  orderType: 'MARKET' | 'LIMIT'
  price:     number
  exchange:  string
}

function emptyLeg(): OrderLeg {
  return { symbol: '', txnType: 'BUY', qty: 1, orderType: 'MARKET', price: 0, exchange: 'NSE' }
}

const BROKERS = [
  { value: 'angelone', label: 'Angel One' },
  { value: 'zerodha',  label: 'Zerodha' },
  { value: 'paper',    label: 'Paper Trade' },
]

export default function BasketPage() {
  const { data, mutate, isLoading } = useSWR('/api/trade/basket', fetcher)

  const [newName, setNewName]       = useState('')
  const [legs, setLegs]             = useState<OrderLeg[]>([emptyLeg()])
  const [broker, setBroker]         = useState('paper')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [execResults, setExecResults] = useState<{ id: number; results: any[] } | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const baskets: any[] = data?.baskets ?? []

  const estimatedValue = legs.reduce((sum, l) => sum + (l.qty * (l.price || 0)), 0)

  const addLeg = () => setLegs(l => [...l, emptyLeg()])
  const removeLeg = (i: number) => setLegs(l => l.filter((_, idx) => idx !== i))
  const updateLeg = (i: number, field: keyof OrderLeg, val: any) =>
    setLegs(l => l.map((leg, idx) => idx === i ? { ...leg, [field]: val } : leg))

  const handleSave = async () => {
    if (!newName.trim()) { setError('Enter basket name'); return }
    const validLegs = legs.filter(l => l.symbol.trim())
    if (!validLegs.length) { setError('Add at least one leg'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/trade/basket', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName, orders: validLegs, execute: false }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      setNewName(''); setLegs([emptyLeg()]); setShowNewForm(false)
      mutate()
    } catch (err: any) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  const handleExecute = async (basket: any) => {
    if (!confirm(`Execute basket "${basket.name}" with ${basket.orders.length} orders via ${broker}?`)) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/trade/basket', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: basket.name, orders: basket.orders, execute: true, broker }),
      })
      const json = await res.json()
      setExecResults({ id: basket.id, results: json.results ?? [] })
    } catch (err: any) { alert(`Execute failed: ${err.message}`) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this basket?')) return
    await fetch(`/api/trade/basket?id=${id}`, { method: 'DELETE' })
    mutate()
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
    padding: '5px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'JetBrains Mono', outline: 'none',
  }
  const cell: React.CSSProperties = {
    padding: '6px 10px', fontSize: 12, color: 'var(--text)',
    fontFamily: 'JetBrains Mono', borderBottom: '1px solid var(--border)',
  }
  const hcell: React.CSSProperties = {
    ...cell, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
  }

  return (
    <>
      <Topbar title="Basket Orders" />
      <div className="page-content space-y-4">

        {/* Broker selector + New Basket */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>BROKER:</span>
            {BROKERS.map(b => (
              <button key={b.value} onClick={() => setBroker(b.value)}
                style={{
                  padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer', fontFamily: 'JetBrains Mono',
                  background: broker === b.value ? 'var(--cyan)22' : 'var(--surface)',
                  border: `1px solid ${broker === b.value ? 'var(--cyan)' : 'var(--border)'}`,
                  color: broker === b.value ? 'var(--cyan)' : 'var(--text-muted)',
                }}>
                {b.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowNewForm(v => !v)}
            style={{ marginLeft: 'auto', background: 'var(--green)22', border: '1px solid var(--green)44',
              color: 'var(--green)', borderRadius: 4, padding: '5px 14px', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> New Basket
          </button>
        </div>

        {/* New Basket Form */}
        {showNewForm && (
          <TerminalCard title="Create Basket" accent="green">
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>BASKET NAME</label>
              <input style={{ ...inputStyle, width: 260 }} placeholder="e.g. Nifty Hedge" value={newName}
                onChange={e => setNewName(e.target.value)} />
            </div>

            {/* Legs */}
            <div style={{ overflowX: 'auto', marginBottom: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Symbol','Exch','B/S','Qty','Type','Price (₹)',''].map(h => (
                      <th key={h} style={{ ...hcell, textAlign: 'left', padding: '5px 8px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 4px' }}>
                        <input style={{ ...inputStyle, width: 110 }} placeholder="RELIANCE" value={leg.symbol}
                          onChange={e => updateLeg(i, 'symbol', e.target.value.toUpperCase())} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select style={{ ...inputStyle, width: 70 }} value={leg.exchange}
                          onChange={e => updateLeg(i, 'exchange', e.target.value)}>
                          <option>NSE</option><option>BSE</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select style={{
                          ...inputStyle, width: 70,
                          color: leg.txnType === 'BUY' ? 'var(--green)' : 'var(--red)',
                        }} value={leg.txnType}
                          onChange={e => updateLeg(i, 'txnType', e.target.value as any)}>
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input style={{ ...inputStyle, width: 70 }} type="number" min="1" value={leg.qty}
                          onChange={e => updateLeg(i, 'qty', Number(e.target.value))} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <select style={{ ...inputStyle, width: 90 }} value={leg.orderType}
                          onChange={e => updateLeg(i, 'orderType', e.target.value as any)}>
                          <option value="MARKET">MARKET</option>
                          <option value="LIMIT">LIMIT</option>
                        </select>
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <input style={{ ...inputStyle, width: 90 }} type="number" step="0.05"
                          disabled={leg.orderType === 'MARKET'} value={leg.price}
                          onChange={e => updateLeg(i, 'price', Number(e.target.value))} />
                      </td>
                      <td style={{ padding: '4px 4px' }}>
                        <button onClick={() => removeLeg(i)} disabled={legs.length === 1}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={addLeg}
                style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)',
                  borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
                <Plus size={11} style={{ display: 'inline', marginRight: 3 }} /> Add Row
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                Est. Value: <strong style={{ color: 'var(--cyan)' }}>₹{estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
              </span>
              {error && <span style={{ color: 'var(--red)', fontSize: 11 }}>{error}</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={handleSave} disabled={submitting}
                  style={{ background: 'var(--green)22', border: '1px solid var(--green)44', color: 'var(--green)',
                    borderRadius: 4, padding: '5px 16px', cursor: 'pointer', fontSize: 12 }}>
                  Save Template
                </button>
                <button onClick={() => { setShowNewForm(false); setError('') }}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                    borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            </div>
          </TerminalCard>
        )}

        {/* Saved Baskets */}
        <TerminalCard title="Saved Baskets" accent="cyan"
          action={
            <button onClick={() => mutate()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
              <RefreshCw size={13} />
            </button>
          }>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
          ) : baskets.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              No saved baskets. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {baskets.map((basket: any) => (
                <div key={basket.id}
                  style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {/* Basket header */}
                  <div style={{ padding: '8px 12px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', fontFamily: 'JetBrains Mono' }}>
                      {basket.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{basket.orders.length} legs</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                      {new Date(basket.createdAt).toLocaleDateString('en-IN')}
                    </span>
                    <button onClick={() => handleExecute(basket)} disabled={submitting}
                      style={{ background: 'var(--green)22', border: '1px solid var(--green)44', color: 'var(--green)',
                        borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Play size={11} /> Execute
                    </button>
                    <button onClick={() => handleDelete(basket.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {/* Legs table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Symbol','Type','Qty','Order Type','Price'].map(h => (
                          <th key={h} style={{ ...hcell, padding: '4px 12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {basket.orders.map((o: any, j: number) => (
                        <tr key={j}>
                          <td style={{ ...cell, fontWeight: 700 }}>{o.symbol}</td>
                          <td style={{ ...cell, color: o.txnType === 'BUY' ? 'var(--green)' : 'var(--red)' }}>{o.txnType}</td>
                          <td style={cell}>{o.qty}</td>
                          <td style={cell}>{o.orderType}</td>
                          <td style={cell}>{o.price > 0 ? `₹${o.price}` : 'MKT'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Execute results */}
                  {execResults?.id === basket.id && execResults != null && (
                    <div style={{ padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>EXECUTION RESULTS</div>
                      {execResults.results.map((r: any, i: number) => (
                        <div key={i} style={{
                          fontSize: 11, padding: '2px 0',
                          color: r.success ? 'var(--green)' : 'var(--red)',
                          fontFamily: 'JetBrains Mono',
                        }}>
                          {r.success ? '✓' : '✗'} {r.txnType} {r.symbol} x{r.qty}
                          {r.orderId ? ` — #${r.orderId}` : ''}
                          {r.error ? ` — ${r.error}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TerminalCard>
      </div>
    </>
  )
}
