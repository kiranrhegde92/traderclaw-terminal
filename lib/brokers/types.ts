/**
 * Broker data source interface
 * Any connected broker must implement this to serve as primary market data source
 */
import type { IndexData, OHLCV } from '@/types/market'

export interface BrokerDataSource {
  readonly name: string

  /** Fetch key indices. Returns [] if unavailable. */
  getIndices(): Promise<IndexData[]>

  /** Fetch last traded price for a symbol. Returns null if unavailable. */
  getLTP(symbol: string): Promise<number | null>

  /** Fetch OHLCV candles for a symbol. Returns [] if unavailable. */
  getHistorical(symbol: string, interval: string, period?: string): Promise<OHLCV[]>
}
