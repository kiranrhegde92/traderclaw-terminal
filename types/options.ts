export interface Greeks {
  delta:  number
  gamma:  number
  theta:  number
  vega:   number
  rho:    number
  iv:     number
}

export interface OptionStrike {
  strikePrice:  number
  expiryDate:   string
  // Call side
  ce_ltp:       number
  ce_change:    number
  ce_changePct: number
  ce_oi:        number
  ce_oiChange:  number
  ce_volume:    number
  ce_iv:        number | null
  ce_delta:     number | null
  ce_gamma:     number | null
  ce_theta:     number | null
  ce_vega:      number | null
  ce_bid:       number
  ce_ask:       number
  // Put side
  pe_ltp:       number
  pe_change:    number
  pe_changePct: number
  pe_oi:        number
  pe_oiChange:  number
  pe_volume:    number
  pe_iv:        number | null
  pe_delta:     number | null
  pe_gamma:     number | null
  pe_theta:     number | null
  pe_vega:      number | null
  pe_bid:       number
  pe_ask:       number
  // Derived
  isATM:        boolean
  pcr:          number
}

export interface OptionChain {
  symbol:       string
  expiry:       string
  spotPrice:    number
  atmStrike:    number
  totalCeOI:    number
  totalPeOI:    number
  pcr:          number
  iv:           number | null
  strikes:      OptionStrike[]
  expiries:     string[]
}

export interface StrategyLeg {
  type:        'CE' | 'PE' | 'FUT'
  action:      'BUY' | 'SELL'
  strike:      number
  expiry:      string
  lots:        number
  lotSize:     number
  premium:     number
  iv?:         number
  delta?:      number
  token?:      string
}

export interface PayoffPoint {
  spot:      number
  pnl:       number
  pnlAtExp:  number
}
