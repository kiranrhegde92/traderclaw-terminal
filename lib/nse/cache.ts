interface CacheEntry<T> {
  data:      T
  expiresAt: number
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlMs })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null }
    return entry.data as T
  }

  del(key: string) { this.store.delete(key) }

  clear() { this.store.clear() }

  size() { return this.store.size }
}

export const cache = new TTLCache()

// TTL constants (ms)
export const TTL = {
  LIVE:        10_000,   // 10s  – live prices
  CHAIN:       30_000,   // 30s  – option chain
  MARKET:      15_000,   // 15s  – gainers/losers
  INDICES:     10_000,   // 10s  – index data
  HISTORY:     300_000,  // 5min – historical OHLCV
  FII_DII:     3_600_000,// 1h   – FII/DII data
  SECTORS:     60_000,   // 1min – sector data
  SYMBOLS:     86_400_000,//1day – symbol search
  FUNDAMENTAL: 21_600_000, // 6h – fundamental data (slow-changing)
}
