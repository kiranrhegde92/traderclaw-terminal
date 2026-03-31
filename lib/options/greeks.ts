/**
 * Black-Scholes options pricing model
 * Computes Delta, Gamma, Theta, Vega, Rho and IV
 * Based on standard closed-form formulas
 */

/** Cumulative standard normal distribution (Abramowitz & Stegun approximation) */
function cdf(x: number): number {
  const a1 =  0.254829592
  const a2 = -0.284496736
  const a3 =  1.421413741
  const a4 = -1.453152027
  const a5 =  1.061405429
  const p  =  0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x)
  return 0.5 * (1 + sign * y)
}

/** Standard normal PDF */
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export interface BSInput {
  spotPrice:   number   // current underlying price
  strikePrice: number   // option strike price
  timeToExpiry: number  // years to expiry (e.g. 30/365)
  riskFreeRate: number  // annualised risk-free rate (e.g. 0.065 = 6.5%)
  volatility:  number   // annualised IV (e.g. 0.15 = 15%)
  optionType:  'CE' | 'PE'
}

export interface BSOutput {
  price:  number
  delta:  number
  gamma:  number
  theta:  number  // per day
  vega:   number  // per 1% move in vol
  rho:    number
  d1:     number
  d2:     number
}

/** Compute Black-Scholes price + all Greeks */
export function blackScholes(input: BSInput): BSOutput {
  const { spotPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: v, optionType } = input

  if (T <= 0) {
    // At expiry
    const intrinsic = optionType === 'CE'
      ? Math.max(0, S - K)
      : Math.max(0, K - S)
    return { price: intrinsic, delta: optionType === 'CE' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, d1: 0, d2: 0 }
  }
  if (v <= 0 || S <= 0 || K <= 0) {
    return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, d1: 0, d2: 0 }
  }

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * sqrtT)
  const d2 = d1 - v * sqrtT

  const Nd1  = cdf(d1)
  const Nd2  = cdf(d2)
  const Nd1n = cdf(-d1)
  const Nd2n = cdf(-d2)
  const nd1  = pdf(d1)
  const ert  = Math.exp(-r * T)

  let price: number, delta: number, rho: number

  if (optionType === 'CE') {
    price = S * Nd1 - K * ert * Nd2
    delta = Nd1
    rho   = K * T * ert * Nd2 / 100
  } else {
    price = K * ert * Nd2n - S * Nd1n
    delta = Nd1 - 1
    rho   = -K * T * ert * Nd2n / 100
  }

  const gamma = nd1 / (S * v * sqrtT)
  const vega  = S * nd1 * sqrtT / 100            // per 1% IV change
  const theta = (
    -(S * nd1 * v) / (2 * sqrtT) -
    r * K * ert * (optionType === 'CE' ? Nd2 : -Nd2n)
  ) / 365                                         // per calendar day

  return {
    price:  Math.max(0, price),
    delta:  parseFloat(delta.toFixed(4)),
    gamma:  parseFloat(gamma.toFixed(6)),
    theta:  parseFloat(theta.toFixed(4)),
    vega:   parseFloat(vega.toFixed(4)),
    rho:    parseFloat(rho.toFixed(4)),
    d1, d2,
  }
}

/** Solve implied volatility via Newton-Raphson iteration */
export function impliedVolatility(
  marketPrice:  number,
  spot:         number,
  strike:       number,
  timeToExpiry: number,
  rate:         number,
  optionType:   'CE' | 'PE',
  tolerance     = 1e-6,
  maxIter       = 100
): number {
  if (marketPrice <= 0 || timeToExpiry <= 0) return 0

  let vol = 0.30  // initial guess 30%
  for (let i = 0; i < maxIter; i++) {
    const bs = blackScholes({ spotPrice: spot, strikePrice: strike, timeToExpiry, riskFreeRate: rate, volatility: vol, optionType })
    const diff = bs.price - marketPrice
    if (Math.abs(diff) < tolerance) return vol
    const vega = bs.vega * 100  // convert back from per-1%
    if (Math.abs(vega) < 1e-10) break
    vol = vol - diff / vega
    if (vol <= 0 || vol > 5) break
  }
  return Math.max(0, vol)
}

/** Days to expiry as fraction of year */
export function daysToExpiry(expiryDateStr: string): number {
  const expiry = new Date(expiryDateStr)
  const now    = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365))
}

/** Compute all Greeks for an option chain row */
export function computeGreeks(
  spot:       number,
  strike:     number,
  expiry:     string,
  optionType: 'CE' | 'PE',
  ltp:        number,
  rate        = 0.065
): BSOutput & { iv: number } {
  const T  = daysToExpiry(expiry)
  const iv = impliedVolatility(ltp, spot, strike, T, rate, optionType)
  const bs = blackScholes({ spotPrice: spot, strikePrice: strike, timeToExpiry: T, riskFreeRate: rate, volatility: iv, optionType })
  return { ...bs, iv }
}
