import { POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS, MACRO_KEYWORDS } from './sources'
import { NIFTY50_SYMBOLS } from '@/lib/utils/constants'
import type { Sentiment, AffectedStock } from '@/types/news'

/** Detect sentiment from title + summary */
export function detectSentiment(text: string): Sentiment {
  const lower = text.toLowerCase()
  const pos = POSITIVE_KEYWORDS.filter(k => lower.includes(k)).length
  const neg = NEGATIVE_KEYWORDS.filter(k => lower.includes(k)).length
  if (pos > neg + 1) return 'positive'
  if (neg > pos + 1) return 'negative'
  return 'neutral'
}

/** Extract affected stock symbols from news text */
export function extractAffectedStocks(title: string, summary: string = ''): AffectedStock[] {
  const text = `${title} ${summary}`.toUpperCase()
  const affected: AffectedStock[] = []
  const sentiment = detectSentiment(title + ' ' + summary)

  // Direct symbol mentions
  for (const sym of NIFTY50_SYMBOLS) {
    if (text.includes(sym) || text.includes(sym.replace('&', 'AND'))) {
      const prob      = estimateProbability(title, 'direct')
      const impactPct = estimateImpact(title, 'direct')
      affected.push({
        symbol:      sym,
        probability: prob,
        impactPct:   impactPct,
        direction:   sentiment === 'positive' ? 'up' : sentiment === 'negative' ? 'down' : 'neutral',
      })
    }
  }

  // Macro/sector keywords
  for (const macro of MACRO_KEYWORDS) {
    if (macro.pattern.test(title) || macro.pattern.test(summary)) {
      if (macro.sectors.includes('ALL')) {
        // Add major index stocks with lower probability
        const prob = estimateProbability(title, 'macro')
        for (const sym of NIFTY50_SYMBOLS.slice(0, 5)) {
          if (!affected.find(a => a.symbol === sym)) {
            affected.push({
              symbol:      sym,
              probability: prob,
              impactPct:   macro.impact,
              direction:   sentiment === 'positive' ? 'up' : sentiment === 'negative' ? 'down' : 'neutral',
            })
          }
        }
        break
      }
    }
  }

  // Deduplicate by symbol, keep highest probability
  const map = new Map<string, AffectedStock>()
  for (const a of affected) {
    const existing = map.get(a.symbol)
    if (!existing || a.probability > existing.probability) {
      map.set(a.symbol, a)
    }
  }

  return Array.from(map.values()).slice(0, 8)
}

function estimateProbability(title: string, matchType: 'direct' | 'macro'): number {
  if (matchType === 'direct') {
    // Higher confidence for earnings/results
    if (/result|earnings|profit|loss|quarter|q[1-4]/i.test(title)) return 85
    if (/deal|acquisition|merger/i.test(title)) return 75
    if (/rating|upgrade|downgrade/i.test(title)) return 70
    return 60
  }
  return 40
}

function estimateImpact(title: string, matchType: 'direct' | 'macro'): number {
  if (/result|earnings|q[1-4]/i.test(title))  return 3.0
  if (/deal|acquisition|merger/i.test(title)) return 4.0
  if (/fraud|penalty|ban/i.test(title))        return 5.0
  if (/dividend|buyback/i.test(title))         return 1.5
  if (matchType === 'macro')                   return 1.0
  return 1.5
}
