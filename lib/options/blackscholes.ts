/**
 * Black-Scholes wrapper — re-exports core functions from greeks.ts
 * with the flat function signatures required by new feature routes.
 *
 * The authoritative implementation lives in lib/options/greeks.ts.
 */
export {
  blackScholes,
  impliedVolatility,
  daysToExpiry,
  computeGreeks,
} from './greeks'

export type { BSInput, BSOutput } from './greeks'
