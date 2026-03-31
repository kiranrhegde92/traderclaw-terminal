import type { StrategyLeg, PayoffPoint } from '@/types/options'
import { blackScholes, daysToExpiry } from './greeks'

/** Compute P&L for one leg at a given spot price */
function legPnlAtExpiry(leg: StrategyLeg, spot: number): number {
  const { type, action, strike, lots, lotSize, premium } = leg
  const qty = lots * (lotSize || 1)
  const multiplier = action === 'BUY' ? 1 : -1

  if (type === 'FUT') {
    return multiplier * (spot - strike) * qty - premium * qty
  }

  const intrinsic = type === 'CE'
    ? Math.max(0, spot - strike)
    : Math.max(0, strike - spot)

  return multiplier * (intrinsic - premium) * qty
}

/** Compute current P&L for one leg given current spot (using Black-Scholes) */
function legPnlNow(leg: StrategyLeg, spot: number, rate = 0.065): number {
  const { type, action, strike, expiry, lots, lotSize, premium, iv } = leg
  const qty = lots * (lotSize || 1)
  const multiplier = action === 'BUY' ? 1 : -1

  if (type === 'FUT') {
    return multiplier * (spot - strike) * qty - premium * qty
  }

  const T     = daysToExpiry(expiry)
  const sigmaGuess = iv ?? 0.18
  const bs    = blackScholes({ spotPrice: spot, strikePrice: strike, timeToExpiry: T, riskFreeRate: rate, volatility: sigmaGuess, optionType: type as 'CE' | 'PE' })

  return multiplier * (bs.price - premium) * qty
}

/** Generate payoff diagram data points for a strategy */
export function computePayoff(
  legs:      StrategyLeg[],
  spotRef:   number,
  steps      = 100,
  rangeMultiplier = 0.25
): PayoffPoint[] {
  const rangeWidth = spotRef * rangeMultiplier
  const low  = Math.max(0, spotRef - rangeWidth)
  const high = spotRef + rangeWidth
  const step = (high - low) / steps

  const points: PayoffPoint[] = []
  for (let spot = low; spot <= high + step/2; spot += step) {
    const s = parseFloat(spot.toFixed(0))
    const pnlAtExp = legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, s), 0)
    const pnlNow   = legs.reduce((sum, leg) => sum + legPnlNow(leg, s), 0)
    points.push({ spot: s, pnl: pnlNow, pnlAtExp })
  }
  return points
}

/** Compute breakeven points (zero crossings at expiry) */
export function findBreakevens(payoff: PayoffPoint[]): number[] {
  const breakevens: number[] = []
  for (let i = 1; i < payoff.length; i++) {
    const prev = payoff[i - 1].pnlAtExp
    const curr = payoff[i].pnlAtExp
    if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
      // Linear interpolation
      const fraction = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr))
      const be = payoff[i-1].spot + fraction * (payoff[i].spot - payoff[i-1].spot)
      breakevens.push(parseFloat(be.toFixed(2)))
    }
  }
  return breakevens
}

/** Summary stats for a strategy */
export function strategyStats(legs: StrategyLeg[], spotRef: number) {
  const payoff = computePayoff(legs, spotRef, 200)
  const pnls   = payoff.map(p => p.pnlAtExp)
  const maxProfit = Math.max(...pnls)
  const maxLoss   = Math.min(...pnls)
  const breakevens = findBreakevens(payoff)
  const netPremium = legs.reduce((s, l) => s + (l.action === 'BUY' ? -1 : 1) * l.premium * l.lots * (l.lotSize || 1), 0)

  return { maxProfit, maxLoss, breakevens, netPremium, payoff }
}
