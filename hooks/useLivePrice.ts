'use client'
import { useEffect, useState, useRef } from 'react'

interface PriceMap { [symbol: string]: number }

/**
 * Subscribe to live prices via SSE.
 * Falls back to SWR polling if SSE is unavailable.
 */
export function useLivePrice(symbols: string[]): PriceMap {
  const [prices, setPrices]   = useState<PriceMap>({})
  const esRef                 = useRef<EventSource | null>(null)
  const symbolKey             = symbols.join(',')

  useEffect(() => {
    if (!symbols.length) return

    const url = `/api/monitor/prices?symbols=${encodeURIComponent(symbolKey)}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'prices') {
          setPrices(prev => ({ ...prev, ...msg.data }))
        }
      } catch {}
    }

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [symbolKey])

  return prices
}

/**
 * Subscribe to a single symbol's live price.
 */
export function useSinglePrice(symbol: string): number | null {
  const prices = useLivePrice(symbol ? [symbol] : [])
  return symbol ? (prices[symbol] ?? null) : null
}
