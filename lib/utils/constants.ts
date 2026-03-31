/** NSE Index symbols and their constituents */
export const INDICES = {
  NIFTY50:    { symbol: 'NIFTY 50',      yf: '^NSEI',     token: '26000', lotSize: 75  },
  BANKNIFTY:  { symbol: 'NIFTY BANK',    yf: '^NSEBANK',  token: '26009', lotSize: 30  },
  SENSEX:     { symbol: 'SENSEX',         yf: '^BSESN',    token: '99919000', lotSize: 20 },
  FINNIFTY:   { symbol: 'NIFTY FIN SERVICE', yf: '^CNXFIN', token: '26037', lotSize: 40 },
  MIDCPNIFTY: { symbol: 'NIFTY MID SELECT', yf: '^NIFTY_M', token: '26074', lotSize: 120 },
  VIX:        { symbol: 'INDIA VIX',      yf: '^INDIAVIX', token: '26017', lotSize: 1  },
}

export const SEGMENTS = ['EQ', 'FO', 'CDS'] as const
export const ORDER_TYPES  = ['MARKET', 'LIMIT', 'SL', 'SL-M'] as const
export const PRODUCT_TYPES = ['CNC', 'MIS', 'NRML'] as const
export const TXN_TYPES = ['BUY', 'SELL'] as const

export const INTERVALS = [
  { label: '1m',  value: 'ONE_MINUTE',    yf: '1m',  minutes: 1    },
  { label: '5m',  value: 'FIVE_MINUTE',   yf: '5m',  minutes: 5    },
  { label: '15m', value: 'FIFTEEN_MINUTE',yf: '15m', minutes: 15   },
  { label: '1h',  value: 'ONE_HOUR',      yf: '60m', minutes: 60   },
  { label: '1D',  value: 'ONE_DAY',       yf: '1d',  minutes: 1440 },
  { label: '1W',  value: 'ONE_WEEK',      yf: '1wk', minutes: 10080},
] as const

export const NIFTY50_SYMBOLS = [
  'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT','AXISBANK',
  'BAJAJFINSV','BAJFINANCE','BHARTIARTL','BPCL','BRITANNIA',
  'CIPLA','COALINDIA','DIVISLAB','DRREDDY','EICHERMOT',
  'GRASIM','HCLTECH','HDFCBANK','HDFCLIFE','HEROMOTOCO',
  'HINDALCO','HINDUNILVR','ICICIBANK','INDUSINDBK','INFY',
  'ITC','JSWSTEEL','KOTAKBANK','LT','M&M',
  'MARUTI','NESTLEIND','NTPC','ONGC','POWERGRID',
  'RELIANCE','SBILIFE','SBIN','SHRIRAMFIN','SUNPHARMA',
  'TATACONSUM','TATAMOTORS','TATASTEEL','TCS','TECHM',
  'TITAN','TRENT','ULTRACEMCO','WIPRO','BAJAJ-AUTO',
]

export const NIFTY100_SYMBOLS = Array.from(new Set([
    // Nifty 50
    'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT','AXISBANK',
    'BAJAJFINSV','BAJFINANCE','BHARTIARTL','BPCL','BRITANNIA',
    'CIPLA','COALINDIA','DIVISLAB','DRREDDY','EICHERMOT',
    'GRASIM','HCLTECH','HDFCBANK','HDFCLIFE','HEROMOTOCO',
    'HINDALCO','HINDUNILVR','ICICIBANK','INDUSINDBK','INFY',
    'ITC','JSWSTEEL','KOTAKBANK','LT','M&M',
    'MARUTI','NESTLEIND','NTPC','ONGC','POWERGRID',
    'RELIANCE','SBILIFE','SBIN','SHRIRAMFIN','SUNPHARMA',
    'TATACONSUM','TATAMOTORS','TATASTEEL','TCS','TECHM',
    'TITAN','TRENT','ULTRACEMCO','WIPRO','BAJAJ-AUTO',
    // Nifty Next 50
    'ABB','ADANIGREEN','AMBUJACEM','AUROPHARMA','BANDHANBNK',
    'BANKBARODA','BEL','BERGEPAINT','BOSCHLTD','CANBK',
    'CHOLAFIN','COLPAL','DABUR','DLF','FEDERALBNK',
    'GODREJCP','GODREJPROP','HAVELLS','INDIGO','ICICIGI',
    'IRCTC','LTIM','LUPIN','MARICO','MUTHOOTFIN',
    'NAUKRI','NMDC','OFSS','PAGEIND','PIDILITIND',
    'PNB','RECLTD','SAIL','SIEMENS','SRF',
    'TORNTPHARM','TVSMOTOR','UBL','VEDL','VOLTAS',
    'WHIRLPOOL','ZOMATO','PFC','ICICIGI','HDFCAMC',
]))

// Popular F&O stocks (subset with good liquidity)
export const FO_SYMBOLS = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR',
  'ITC','SBIN','BHARTIARTL','KOTAKBANK','LT','AXISBANK',
  'ASIANPAINT','MARUTI','SUNPHARMA','TATAMOTORS','TATASTEEL',
  'WIPRO','TECHM','HCLTECH','BAJFINANCE','M&M','ONGC','NTPC',
  'ADANIENT','TITAN','ULTRACEMCO','JSWSTEEL','HINDALCO','DRREDDY',
  'DIVISLAB','CIPLA','EICHERMOT','POWERGRID','COALINDIA','GRASIM',
  'HEROMOTOCO','INDUSINDBK','BAJAJFINSV','TRENT','TATACONSUM',
  'ADANIPORTS','APOLLOHOSP','NESTLEIND','HDFCLIFE','SBILIFE',
  'NAUKRI','IRCTC','ZOMATO','DMART','PIDILITIND',
]

export const SECTORS = [
  'IT','BANKING','PHARMA','AUTO','FMCG','ENERGY',
  'METALS','REALTY','INFRA','MEDIA','TELECOM','FINANCE',
]

/** NSE RSS feeds */
export const NEWS_FEEDS = {
  moneycontrol: 'https://www.moneycontrol.com/rss/latestnews.xml',
  economictimes: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  livemint: 'https://www.livemint.com/rss/markets',
  businessstandard: 'https://www.business-standard.com/rss/markets-106.rss',
  zeebiz: 'https://www.zeebiz.com/markets/rss',
}

/** Broker charges for paper trade realism */
export const BROKERAGE = {
  equity_intraday: 0.0003,  // 0.03% or ₹20 max per order
  equity_delivery: 0,       // Zero for CNC
  fo: 0.0003,               // 0.03% or ₹20 max
  max_per_order: 20,        // ₹20 cap
  stt_equity_delivery: 0.001, // 0.1%
  stt_equity_intraday_sell: 0.00025,
  stt_fo_sell: 0.0125,      // per lot (options)
  exchange_txn: 0.0000345,
  sebi_charges: 0.000001,
  gst: 0.18,
  stamp_duty: 0.00003,
}
