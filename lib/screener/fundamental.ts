/**
 * Fundamental screener utilities
 * Scoring and classification functions for fundamental analysis
 */

export interface FundamentalStock {
  symbol: string
  company: string
  price: number
  changePct: number
  pe?: number
  pb?: number
  roe?: number
  roce?: number
  debtToEquity?: number
  marketCap?: number
  dividendYield?: number
  eps?: number
  epsGrowth?: number
}

export interface FundamentalFilters {
  pe_min: number
  pe_max: number
  pb_min: number
  pb_max: number
  roe_min: number
  roe_max: number
  roce_min: number
  roce_max: number
  debt_min: number
  debt_max: number
  mcap_min: number
  mcap_max: number
  div_min: number
  div_max: number
  eps_growth_min: number
  eps_growth_max: number
}

/**
 * Check if a stock meets the fundamental criteria
 */
export function isGoodFundamental(
  stock: FundamentalStock,
  filters: Partial<FundamentalFilters>
): boolean {
  const f = {
    pe_min: filters.pe_min ?? 0,
    pe_max: filters.pe_max ?? 100,
    pb_min: filters.pb_min ?? 0,
    pb_max: filters.pb_max ?? 10,
    roe_min: filters.roe_min ?? 0,
    roe_max: filters.roe_max ?? 50,
    roce_min: filters.roce_min ?? 0,
    roce_max: filters.roce_max ?? 50,
    debt_min: filters.debt_min ?? 0,
    debt_max: filters.debt_max ?? 3,
    mcap_min: filters.mcap_min ?? 0,
    mcap_max: filters.mcap_max ?? 100000,
    div_min: filters.div_min ?? 0,
    div_max: filters.div_max ?? 10,
    eps_growth_min: filters.eps_growth_min ?? -50,
    eps_growth_max: filters.eps_growth_max ?? 50,
  }

  if (stock.pe !== undefined && (stock.pe < f.pe_min || stock.pe > f.pe_max)) return false
  if (stock.pb !== undefined && (stock.pb < f.pb_min || stock.pb > f.pb_max)) return false
  if (stock.roe !== undefined && (stock.roe < f.roe_min || stock.roe > f.roe_max)) return false
  if (stock.roce !== undefined && (stock.roce < f.roce_min || stock.roce > f.roce_max)) return false
  if (stock.debtToEquity !== undefined && (stock.debtToEquity < f.debt_min || stock.debtToEquity > f.debt_max)) return false
  if (stock.marketCap !== undefined && (stock.marketCap < f.mcap_min || stock.marketCap > f.mcap_max)) return false
  if (stock.dividendYield !== undefined && (stock.dividendYield < f.div_min || stock.dividendYield > f.div_max)) return false
  if (stock.epsGrowth !== undefined && (stock.epsGrowth < f.eps_growth_min || stock.epsGrowth > f.eps_growth_max)) return false

  return true
}

/**
 * Score a stock from 0-100 based on fundamentals
 * Higher score = better fundamentals
 */
export function scoreStock(stock: FundamentalStock): number {
  let score = 0
  let count = 0

  // PE Score: Lower is better (range 8-35)
  if (stock.pe !== undefined) {
    if (stock.pe < 15) score += 30
    else if (stock.pe < 25) score += 20
    else if (stock.pe < 35) score += 10
    count++
  }

  // PB Score: Lower is better (range 0.5-4)
  if (stock.pb !== undefined) {
    if (stock.pb < 1) score += 25
    else if (stock.pb < 2.5) score += 20
    else if (stock.pb < 4) score += 10
    count++
  }

  // ROE Score: Higher is better (range 5-40%)
  if (stock.roe !== undefined) {
    if (stock.roe > 25) score += 25
    else if (stock.roe > 15) score += 20
    else if (stock.roe > 10) score += 10
    count++
  }

  // ROCE Score: Higher is better (range 5-40%)
  if (stock.roce !== undefined) {
    if (stock.roce > 25) score += 25
    else if (stock.roce > 15) score += 20
    else if (stock.roce > 10) score += 10
    count++
  }

  // Debt Score: Lower is better (range 0-2.5)
  if (stock.debtToEquity !== undefined) {
    if (stock.debtToEquity < 1) score += 20
    else if (stock.debtToEquity < 1.5) score += 15
    else if (stock.debtToEquity < 2) score += 10
    count++
  }

  // EPS Growth Score: Higher is better (range -20 to +50%)
  if (stock.epsGrowth !== undefined) {
    if (stock.epsGrowth > 20) score += 15
    else if (stock.epsGrowth > 10) score += 10
    else if (stock.epsGrowth > 0) score += 5
    count++
  }

  // Dividend Score
  if (stock.dividendYield !== undefined) {
    if (stock.dividendYield > 3) score += 10
    else if (stock.dividendYield > 1.5) score += 5
    count++
  }

  return count > 0 ? Math.round((score / (count * 30)) * 100) : 0
}

/**
 * Get PE ratio classification
 */
export function getPERange(pe?: number): 'cheap' | 'fair' | 'expensive' | 'unknown' {
  if (pe === undefined) return 'unknown'
  if (pe < 15) return 'cheap'
  if (pe <= 25) return 'fair'
  return 'expensive'
}

/**
 * Get PE color for UI
 */
export function getPEColor(pe?: number): string {
  const range = getPERange(pe)
  if (range === 'cheap') return 'var(--green)'
  if (range === 'fair') return 'var(--amber)'
  if (range === 'expensive') return 'var(--red)'
  return 'var(--gray-500)'
}

/**
 * Get ROE classification
 */
export function getROERange(roe?: number): 'poor' | 'fair' | 'excellent' | 'unknown' {
  if (roe === undefined) return 'unknown'
  if (roe < 10) return 'poor'
  if (roe <= 20) return 'fair'
  return 'excellent'
}

/**
 * Get ROE color for UI
 */
export function getROEColor(roe?: number): string {
  const range = getROERange(roe)
  if (range === 'poor') return 'var(--red)'
  if (range === 'fair') return 'var(--amber)'
  if (range === 'excellent') return 'var(--green)'
  return 'var(--gray-500)'
}

/**
 * Get Debt/Equity classification
 */
export function getDebtRange(debt?: number): 'low' | 'moderate' | 'high' | 'unknown' {
  if (debt === undefined) return 'unknown'
  if (debt < 1) return 'low'
  if (debt <= 2) return 'moderate'
  return 'high'
}

/**
 * Get Debt color for UI
 */
export function getDebtColor(debt?: number): string {
  const range = getDebtRange(debt)
  if (range === 'low') return 'var(--green)'
  if (range === 'moderate') return 'var(--amber)'
  if (range === 'high') return 'var(--red)'
  return 'var(--gray-500)'
}

/**
 * Format market cap for display
 */
export function formatMarketCap(mcap?: number): string {
  if (mcap === undefined) return '—'
  if (mcap >= 100000) return `${(mcap / 100000).toFixed(1)}L Cr`
  if (mcap >= 1000) return `${(mcap / 1000).toFixed(1)}K Cr`
  return `${mcap.toFixed(0)} Cr`
}

/**
 * Get preset filters for quick screening
 */
export const PRESET_FILTERS = {
  'Value Stocks': {
    label: 'Value Stocks',
    desc: 'Low PE, low PB, reasonable debt',
    filters: { pe_max: 15, pb_max: 1.5, debt_max: 1 } as Partial<FundamentalFilters>,
  },
  'Quality Growth': {
    label: 'Quality Growth',
    desc: 'High ROE, high ROCE, low debt, growth',
    filters: { roe_min: 20, roce_min: 20, debt_max: 1, eps_growth_min: 10 } as Partial<FundamentalFilters>,
  },
  'Dividend Champions': {
    label: 'Dividend Champions',
    desc: 'High dividend yield, reasonable PE, low debt',
    filters: { div_min: 3, pe_max: 20, debt_max: 1.5 } as Partial<FundamentalFilters>,
  },
  'Undervalued Gems': {
    label: 'Undervalued Gems',
    desc: 'Low PB, moderate PE, positive growth',
    filters: { pb_max: 1, pe_max: 20, eps_growth_min: 5 } as Partial<FundamentalFilters>,
  },
  'Blue Chips': {
    label: 'Blue Chips',
    desc: 'High market cap, high ROE, low debt',
    filters: { mcap_min: 10000, roe_min: 15, debt_max: 1 } as Partial<FundamentalFilters>,
  },
}
