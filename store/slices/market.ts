import { create } from 'zustand'
import type { Ticker, IndexData } from '@/types/market'

interface MarketState {
  prices:    Record<string, Ticker>  // symbol -> ticker
  indices:   IndexData[]
  lastUpdate: number

  updatePrice:   (ticker: Ticker) => void
  updatePrices:  (tickers: Ticker[]) => void
  setIndices:    (indices: IndexData[]) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  prices:    {},
  indices:   [],
  lastUpdate: 0,

  updatePrice: (ticker) => set(s => ({
    prices:    { ...s.prices, [ticker.symbol]: ticker },
    lastUpdate: Date.now(),
  })),

  updatePrices: (tickers) => set(s => {
    const updated = { ...s.prices }
    for (const t of tickers) updated[t.symbol] = t
    return { prices: updated, lastUpdate: Date.now() }
  }),

  setIndices: (indices) => set({ indices }),
}))
