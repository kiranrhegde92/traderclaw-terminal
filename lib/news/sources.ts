export const RSS_SOURCES = [
  {
    id:   'moneycontrol',
    name: 'MoneyControl',
    url:  'https://www.moneycontrol.com/rss/latestnews.xml',
    color: '#e85d04',
  },
  {
    id:   'economictimes',
    name: 'Economic Times',
    url:  'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    color: '#ff9f1c',
  },
  {
    id:   'livemint',
    name: 'LiveMint',
    url:  'https://www.livemint.com/rss/markets',
    color: '#2196f3',
  },
  {
    id:   'thehindubusinessline',
    name: 'BusinessLine',
    url:  'https://www.thehindubusinessline.com/feeder/default.rss',
    color: '#9c27b0',
  },
  {
    id:   'ndtvprofit',
    name: 'NDTV Profit',
    url:  'https://feeds.feedburner.com/ndtvprofit-latest',
    color: '#f44336',
  },
]

/** Keywords that indicate positive news */
export const POSITIVE_KEYWORDS = [
  'profit', 'growth', 'record', 'surge', 'rally', 'rise', 'gain', 'beat', 'above',
  'strong', 'bullish', 'upgrade', 'buy', 'positive', 'jump', 'high', 'earnings beat',
  'dividend', 'buyback', 'acquisition', 'expansion', 'partnership', 'deal', 'order',
  'approval', 'launch', 'result',
]

/** Keywords that indicate negative news */
export const NEGATIVE_KEYWORDS = [
  'loss', 'fall', 'decline', 'drop', 'crash', 'sell', 'weak', 'bearish', 'downgrade',
  'below', 'miss', 'negative', 'concern', 'risk', 'fraud', 'penalty', 'fine', 'lawsuit',
  'recall', 'default', 'bankruptcy', 'layoff', 'delay', 'probe', 'investigation', 'sebi',
  'ban', 'restriction', 'warning',
]

/** Macro/policy keywords and their likely impact */
export const MACRO_KEYWORDS = [
  { pattern: /rbi|rate|repo|inflation|monetary policy/i,   impact: 2.5, sectors: ['BANKING','FIN SERVICE'] },
  { pattern: /sebi|regulation|compliance/i,                impact: 1.5, sectors: ['ALL'] },
  { pattern: /budget|fiscal|tax|gst/i,                     impact: 2.0, sectors: ['ALL'] },
  { pattern: /fii|dii|foreign investment/i,                impact: 1.5, sectors: ['ALL'] },
  { pattern: /oil|crude|opec/i,                            impact: 2.0, sectors: ['ENERGY','AUTO','AIRLINE'] },
  { pattern: /it|technology|software|tech/i,               impact: 1.5, sectors: ['IT'] },
  { pattern: /pharma|drug|approval|usfda/i,                impact: 3.0, sectors: ['PHARMA'] },
  { pattern: /auto|ev|electric vehicle/i,                  impact: 2.0, sectors: ['AUTO'] },
  { pattern: /bank|nbfc|npa|credit/i,                      impact: 2.0, sectors: ['BANKING'] },
  { pattern: /metal|steel|aluminium|iron/i,                impact: 2.5, sectors: ['METALS'] },
]
