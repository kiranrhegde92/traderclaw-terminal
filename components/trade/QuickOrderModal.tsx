'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store'
import { X, Zap, TrendingUp, TrendingDown } from 'lucide-react'

interface QuickOrderModalProps {
  open: boolean
  onClose: () => void
  symbol?: string
  side?: 'BUY' | 'SELL'
  onSuccess?: (orderId: string) => void
}

export default function QuickOrderModal({
  open,
  onClose,
  symbol = '',
  side = 'BUY',
  onSuccess,
}: QuickOrderModalProps) {
  const { isConnected } = useAuthStore()
  const [qty, setQty] = useState('1')
  const [broker, setBroker] = useState<'paper' | 'angelone' | 'zerodha'>('paper')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeBroker, setActiveBroker] = useState<'angelone' | 'zerodha' | 'paper'>('paper')
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect active broker
  useEffect(() => {
    fetch('/api/market/source')
      .then((r) => r.json())
      .then((d) => {
        if (d.broker === 'zerodha') setActiveBroker('zerodha')
        else if (d.broker === 'angelone') setActiveBroker('angelone')
        else setActiveBroker('paper')
      })
      .catch(() => {})
  }, [isConnected])

  useEffect(() => {
    setBroker(activeBroker)
  }, [activeBroker])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQty('1')
      setResult(null)
    }
  }, [open, symbol, side])

  // Listen for Ctrl+Enter to confirm
  useEffect(() => {
    if (!open) return

    function onConfirm(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    }

    window.addEventListener('keydown', onConfirm)
    return () => window.removeEventListener('keydown', onConfirm)
  }, [open, qty, symbol, side, broker])

  const handleSubmit = useCallback(async () => {
    if (!symbol.trim()) {
      setResult({ success: false, message: 'Symbol is required' })
      return
    }
    if (!qty || Number(qty) <= 0) {
      setResult({ success: false, message: 'Quantity must be > 0' })
      return
    }

    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker,
          symbol: symbol.toUpperCase(),
          exchange: 'NSE',
          txnType: side,
          orderType: 'MARKET',
          productType: 'MIS',
          qty: Number(qty),
          price: 0,
          variety: 'NORMAL',
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Order failed')

      setResult({
        success: true,
        message: `${side} order placed #${json.orderId}`,
      })

      onSuccess?.(json.orderId)
      setTimeout(() => onClose(), 1500)
    } catch (err: any) {
      setResult({ success: false, message: err.message })
    } finally {
      setSubmitting(false)
    }
  }, [symbol, side, qty, broker, onClose, onSuccess])

  if (!open) return null

  const isBuy = side === 'BUY'
  const accent = isBuy ? '#00ff41' : '#ff0040'

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          background: '#0d0d0d',
          border: `1px solid ${accent}44`,
          borderRadius: 8,
          width: 360,
          maxWidth: '95vw',
          boxShadow: `0 0 40px ${accent}22`,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #1a1a1a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: accent }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: accent,
                letterSpacing: '0.06em',
              }}
            >
              QUICK ORDER
            </span>
            <span
              style={{
                fontSize: 9,
                color: '#444',
                letterSpacing: '0.05em',
              }}
            >
              {side}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#555',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          style={{ padding: 16 }}
        >
          {/* Symbol Display */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 9,
                color: '#555',
                marginBottom: 3,
                letterSpacing: '0.06em',
              }}
            >
              SYMBOL
            </label>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: accent,
                letterSpacing: '0.08em',
                padding: '10px',
                background: '#111',
                borderRadius: 4,
                border: `1px solid ${accent}44`,
              }}
            >
              {symbol || 'N/A'}
            </div>
          </div>

          {/* Quantity Input */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 9,
                color: '#555',
                marginBottom: 3,
                letterSpacing: '0.06em',
              }}
            >
              QUANTITY (1-100)
            </label>
            <input
              ref={inputRef}
              type="number"
              min="1"
              max="100"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid #222',
                borderRadius: 4,
                padding: '8px 10px',
                color: '#eee',
                fontSize: 13,
                fontFamily: 'JetBrains Mono',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="range"
              min="1"
              max="100"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{
                width: '100%',
                marginTop: 6,
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Broker Selector */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                fontSize: 9,
                color: '#555',
                marginBottom: 3,
                letterSpacing: '0.06em',
              }}
            >
              BROKER
            </label>
            <select
              value={broker}
              onChange={(e) => setBroker(e.target.value as any)}
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid #222',
                borderRadius: 4,
                padding: '7px 10px',
                color: '#eee',
                fontSize: 12,
                fontFamily: 'JetBrains Mono',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            >
              <option value="paper">Paper Trading</option>
              <option value="angelone">Angel One</option>
              <option value="zerodha">Zerodha</option>
            </select>
          </div>

          {/* Result Message */}
          {result && (
            <div
              style={{
                marginBottom: 14,
                padding: 10,
                borderRadius: 4,
                fontSize: 12,
                background: result.success ? '#00ff4111' : '#ff004011',
                border: `1px solid ${result.success ? '#00ff4144' : '#ff004144'}`,
                color: result.success ? '#00ff41' : '#ff0040',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {result.message}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                letterSpacing: '0.08em',
                border: 'none',
                borderRadius: 4,
                cursor: submitting ? 'not-allowed' : 'pointer',
                color: '#000',
                background: accent,
                opacity: submitting ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {side === 'BUY' ? (
                <TrendingUp size={12} style={{ display: 'inline', marginRight: 6 }} />
              ) : (
                <TrendingDown size={12} style={{ display: 'inline', marginRight: 6 }} />
              )}
              {submitting ? 'Placing...' : 'Execute at Market'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono',
                letterSpacing: '0.08em',
                border: '1px solid #333',
                borderRadius: 4,
                cursor: 'pointer',
                background: '#111',
                color: '#999',
                transition: 'all 0.15s',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Keyboard Hint */}
          <div
            style={{
              marginTop: 12,
              padding: '8px 10px',
              borderRadius: 4,
              background: '#0a0a0a',
              border: '1px solid #1a1a1a',
              fontSize: 10,
              color: '#666',
              fontFamily: 'JetBrains Mono',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}
          >
            Ctrl+Enter to Execute | Esc to Cancel
          </div>
        </form>
      </div>
    </div>
  )
}
