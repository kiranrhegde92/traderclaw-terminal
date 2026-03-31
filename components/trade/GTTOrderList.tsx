'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { Plus, X, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'
import TerminalCard from '@/components/ui/TerminalCard'
import Spinner from '@/components/ui/Spinner'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface GTTForm {
  symbol:       string
  exchange:     string
  condition:    'above' | 'below'
  triggerPrice: string
  orderQty:     string
  orderPrice:   string
  orderType:    string
}

const DEFAULT_FORM: GTTForm = {
  symbol: '', exchange: 'NSE', condition: 'above',
  triggerPrice: '', orderQty: '', orderPrice: '', orderType: 'LIMIT',
}

export default function GTTOrderList() {
  const { data, mutate, isLoading } = useSWR('/api/trade/gtt', fetcher, { refreshInterval: 30000 })
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState<GTTForm>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const gttList: any[] = data?.gtt ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/trade/gtt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          symbol:       form.symbol.toUpperCase(),
          exchange:     form.exchange,
          condition:    form.condition,
          triggerPrice: Number(form.triggerPrice),
          orderQty:     Number(form.orderQty),
          orderPrice:   Number(form.orderPrice),
          orderType:    form.orderType,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      setForm(DEFAULT_FORM)
      setShowForm(false)
      mutate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm('Cancel this GTT order?')) return
    await fetch(`/api/trade/gtt?id=${id}`, { method: 'DELETE' })
    mutate()
  }

  const cell: React.CSSProperties = {
    padding: '7px 10px', fontSize: 12, color: 'var(--text)',
    fontFamily: 'JetBrains Mono', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }
  const hcell: React.CSSProperties = {
    ...cell, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase',
  }
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
    padding: '5px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'JetBrains Mono',
    outline: 'none', width: '100%',
  }

  return (
    <TerminalCard
      title="GTT Orders"
      accent="amber"
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => mutate()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setShowForm(v => !v)}
            style={{ background: 'var(--amber)22', border: '1px solid var(--amber)44', color: 'var(--amber)',
              borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> Add GTT
          </button>
        </div>
      }
    >
      {/* Add GTT Form */}
      {showForm && (
        <form onSubmit={handleSubmit}
          style={{ padding: 12, background: 'var(--surface)', borderRadius: 6,
            border: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>SYMBOL</label>
              <input style={inputStyle} placeholder="RELIANCE" value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>EXCHANGE</label>
              <select style={inputStyle} value={form.exchange}
                onChange={e => setForm(f => ({ ...f, exchange: e.target.value }))}>
                <option>NSE</option><option>BSE</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>CONDITION</label>
              <select style={inputStyle} value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition: e.target.value as any }))}>
                <option value="above">▲ Above</option>
                <option value="below">▼ Below</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>TRIGGER ₹</label>
              <input style={inputStyle} type="number" step="0.05" placeholder="0.00" value={form.triggerPrice}
                onChange={e => setForm(f => ({ ...f, triggerPrice: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>QTY</label>
              <input style={inputStyle} type="number" placeholder="1" value={form.orderQty}
                onChange={e => setForm(f => ({ ...f, orderQty: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>ORDER ₹</label>
              <input style={inputStyle} type="number" step="0.05" placeholder="0.00" value={form.orderPrice}
                onChange={e => setForm(f => ({ ...f, orderPrice: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>ORDER TYPE</label>
              <select style={inputStyle} value={form.orderType}
                onChange={e => setForm(f => ({ ...f, orderType: e.target.value }))}>
                <option>LIMIT</option><option>MARKET</option>
              </select>
            </div>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={submitting}
              style={{ background: 'var(--amber)22', border: '1px solid var(--amber)44', color: 'var(--amber)',
                borderRadius: 4, padding: '5px 16px', cursor: 'pointer', fontSize: 12 }}>
              {submitting ? 'Creating…' : 'Create GTT'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM) }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
                borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* GTT Table */}
      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>
      ) : gttList.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          No active GTT orders. Click "Add GTT" to create one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Symbol','Condition','Trigger','Order Price','Qty','Type','Status','Broker','Created',''].map(h => (
                  <th key={h} style={{ ...hcell, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gttList.map((g: any) => (
                <tr key={g.id}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...cell, fontWeight: 700 }}>{g.symbol}</td>
                  <td style={{ ...cell }}>
                    {g.condition === 'above'
                      ? <span style={{ color: 'var(--green)' }}><ChevronUp size={12} style={{ display: 'inline' }} /> Above</span>
                      : <span style={{ color: 'var(--red)' }}><ChevronDown size={12} style={{ display: 'inline' }} /> Below</span>
                    }
                  </td>
                  <td style={{ ...cell, color: 'var(--amber)' }}>₹{Number(g.triggerPrice).toFixed(2)}</td>
                  <td style={cell}>₹{Number(g.orderPrice).toFixed(2)}</td>
                  <td style={cell}>{g.orderQty}</td>
                  <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{g.orderType}</td>
                  <td style={cell}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: g.status === 'ACTIVE' ? 'var(--green)22' : 'var(--text-dim)18',
                      color: g.status === 'ACTIVE' ? 'var(--green)' : 'var(--text-dim)',
                      border: `1px solid ${g.status === 'ACTIVE' ? 'var(--green)44' : 'var(--border)'}`,
                    }}>{g.status}</span>
                  </td>
                  <td style={{ ...cell, fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{g.broker}</td>
                  <td style={{ ...cell, fontSize: 11, color: 'var(--text-dim)' }}>
                    {g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={cell}>
                    <button onClick={() => handleDelete(g.id)}
                      style={{ background: 'var(--red)22', color: 'var(--red)', border: '1px solid var(--red)44',
                        borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>
                      <X size={10} style={{ display: 'inline', marginRight: 2 }} />Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TerminalCard>
  )
}
