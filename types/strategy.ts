import type { StrategyLeg, PayoffPoint } from './options'

export type StrategyCategory = 'Bullish' | 'Bearish' | 'Neutral' | 'Volatile' | 'Custom'
export type StrategyStatus   = 'DRAFT' | 'PAPER' | 'LIVE' | 'CLOSED'

export interface StrategyTemplate {
  id:               number
  name:             string
  category:         StrategyCategory
  description:      string
  legs:             Partial<StrategyLeg>[]
  maxProfit:        string
  maxLoss:          string
  breakevenFormula: string
  isBuiltin:        boolean
}

export interface Strategy {
  id:            number
  templateId:    number | null
  name:          string
  underlying:    string
  expiryDate:    string
  legs:          StrategyLeg[]
  targetPnl:     number | null
  stopLossPnl:   number | null
  status:        StrategyStatus
  paperAccountId: number | null
  notes:         string | null
  config:        Record<string, any> | null
  createdAt:     string
  // computed
  currentPnl?:   number
  payoff?:       PayoffPoint[]
}
