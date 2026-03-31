export type OrderType     = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
export type ProductType   = 'CNC' | 'MIS' | 'NRML'
export type TransactionType = 'BUY' | 'SELL'
export type OrderStatus   = 'PENDING' | 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'REJECTED'
export type OptionType    = 'CE' | 'PE'

export interface PaperOrder {
  id:              number
  accountId:       number
  symbol:          string
  exchange:        string
  segment:         'EQ' | 'FO'
  orderType:       OrderType
  transactionType: TransactionType
  productType:     ProductType
  quantity:        number
  price:           number | null
  triggerPrice:    number | null
  status:          OrderStatus
  filledPrice:     number | null
  filledQty:       number
  filledAt:        string | null
  optionType:      OptionType | null
  strikePrice:     number | null
  expiryDate:      string | null
  strategyId:      number | null
  notes:           string | null
  createdAt:       string
}

export interface PaperPosition {
  id:           number
  accountId:    number
  symbol:       string
  exchange:     string
  segment:      string
  quantity:     number
  averagePrice: number
  currentPrice: number
  productType:  ProductType
  optionType:   OptionType | null
  strikePrice:  number | null
  expiryDate:   string | null
  realizedPnl:  number
  unrealizedPnl?: number
  pnlPct?:      number
}

export interface PaperAccount {
  id:             number
  name:           string
  initialBalance: number
  currentBalance: number
  createdAt:      string
  // computed
  usedMargin?:    number
  availableMargin?: number
  dayPnl?:        number
  totalPnl?:      number
}

export interface PaperTrade {
  id:              number
  accountId:       number
  orderId:         number
  symbol:          string
  exchange:        string
  segment:         'EQ' | 'FO' | 'CDS'
  transactionType: TransactionType
  quantity:        number
  price:           number
  optionType:      OptionType | null
  strikePrice:     number | null
  expiryDate:      string | null
  pnl:             number | null
  executedAt:      string
}
