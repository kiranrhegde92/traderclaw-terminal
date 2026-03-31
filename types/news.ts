export type Sentiment = 'positive' | 'negative' | 'neutral'

export interface AffectedStock {
  symbol:      string
  probability: number  // 0-100
  impactPct:   number  // estimated price impact %
  direction:   'up' | 'down' | 'neutral'
}

export interface NewsItem {
  id:             number
  title:          string
  url:            string
  source:         string
  summary:        string | null
  publishedAt:    string
  fetchedAt:      string
  sentiment:      Sentiment | null
  affectedStocks: AffectedStock[]
  isRead:         boolean
}
