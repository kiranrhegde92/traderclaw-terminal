export interface OHLCV {
  time:   number  // Unix timestamp seconds
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export interface Ticker {
  symbol:      string
  name:        string
  ltp:         number
  open:        number
  high:        number
  low:         number
  close:       number   // prev close
  change:      number
  changePct:   number
  volume:      number
  exchange:    string
  timestamp:   number
}

export interface IndexData {
  symbol:    string
  name:      string
  ltp:       number
  change:    number
  changePct: number
  high:      number
  low:       number
  open:      number
  prevClose: number
  pe:        number
  pb:        number
  advances?: number
  declines?: number
  unchanged?: number
}

export interface GainerLoser {
  symbol:    string
  name:      string
  ltp:       number
  change:    number
  changePct: number
  volume:    number
  high52w:   number
  low52w:    number
}

export interface FIIDIIData {
  date:         string
  fii_buy:      number
  fii_sell:     number
  fii_net:      number
  dii_buy:      number
  dii_sell:     number
  dii_net:      number
}

export interface SectorData {
  name:      string
  changePct: number
  topStock:  string
  marketCap: number
}
