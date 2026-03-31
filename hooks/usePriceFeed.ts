/**
 * usePriceFeed — React hook for real-time price data via SSE
 *
 * Usage:
 *   const prices = usePriceFeed(['NIFTY:NSE', 'BANKNIFTY:NSE', 'RELIANCE:NSE'])
 *   prices['NIFTY:NSE']?.ltp   // 24100.50
 */

'use client'

import { useEffect, useRef, useState } from 'react'

export interface PriceTick {
  symbol:    string
  exchange:  string
  ltp:       number
  open:      number
  high:      number
  low:       number
  close:     number
  volume:    number
  change:    number
  changePct: number
  timestamp: number
}

export type PriceMap = Record<string, PriceTick>  // key = "SYMBOL:EXCHANGE"

export function usePriceFeed(symbols: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({})
  const esRef               = useRef<EventSource | null>(null)
  const symKey              = symbols.slice().sort().join(',')

  useEffect(() => {
    if (!symbols.length) return

    // Close existing connection
    esRef.current?.close()

    const url = `/api/prices/stream?symbols=${encodeURIComponent(symKey)}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const tick: PriceTick = JSON.parse(e.data)
        if (!tick.symbol || !tick.exchange) return
        const key = `${tick.symbol}:${tick.exchange}`
        setPrices(prev => ({ ...prev, [key]: tick }))
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      // EventSource auto-reconnects on error
    }

    return () => {
      es.close()
      esRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symKey])

  return prices
}

// ─── Convenience: single symbol ───────────────────────────────────────────────

export function usePrice(symbol: string, exchange = 'NSE'): PriceTick | null {
  const key    = `${symbol.toUpperCase()}:${exchange.toUpperCase()}`
  const prices = usePriceFeed([key])
  return prices[key] ?? null
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatLTP(ltp: number | undefined): string {
  if (ltp === undefined || ltp === 0) return '—'
  return ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatChange(change: number, changePct: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`
}
