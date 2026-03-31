/**
 * Broker registry — returns the first currently-connected broker
 * Add new brokers here as they are integrated (Zerodha, Upstox, etc.)
 *
 * Usage:
 *   const broker = await getActiveBroker()
 *   if (broker) {
 *     const ltp = await broker.getLTP('RELIANCE')
 *   }
 */
import type { BrokerDataSource } from './types'

/**
 * Returns the first connected broker, or null if none are connected.
 * Brokers are tried in priority order — first connected one wins.
 */
export async function getActiveBroker(): Promise<BrokerDataSource | null> {
  // ── Angel One ──
  try {
    const { createAngelOneBroker } = await import('@/lib/angelone/market')
    const broker = createAngelOneBroker()
    if (broker) return broker
  } catch { /* not configured or DB unavailable */ }

  // ── Zerodha ──
  try {
    const { createZerodhaBroker } = await import('@/lib/zerodha/market')
    const broker = createZerodhaBroker()
    if (broker) return broker
  } catch { /* not configured or DB unavailable */ }

  // ── Upstox (placeholder — not yet implemented) ──
  // try {
  //   const { createUpstoxBroker } = await import('@/lib/upstox/market')
  //   const broker = createUpstoxBroker()
  //   if (broker) return broker
  // } catch { }

  return null
}
