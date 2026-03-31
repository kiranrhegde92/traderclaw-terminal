/**
 * Candlestick pattern detection using technicalindicators
 * Returns detected pattern names for the last N candles
 */
import type { OHLCV } from '@/types/market'

export interface PatternResult {
  name:        string
  label:       string
  type:        'bullish' | 'bearish' | 'neutral'
  description: string
  detected:    boolean
  barIndex:    number   // which bar index was detected
}

/** Pattern metadata */
const PATTERN_META: Record<string, { label: string; type: 'bullish' | 'bearish' | 'neutral'; description: string }> = {
  abandonedbaby:            { label: 'Abandoned Baby',           type: 'bullish',  description: 'Rare reversal pattern with gap' },
  bearishengulfingpattern:  { label: 'Bearish Engulfing',        type: 'bearish',  description: 'Large bearish candle engulfs previous bullish' },
  bullishengulfingpattern:  { label: 'Bullish Engulfing',        type: 'bullish',  description: 'Large bullish candle engulfs previous bearish' },
  darkcloudcover:           { label: 'Dark Cloud Cover',         type: 'bearish',  description: 'Bearish reversal after uptrend' },
  doji:                     { label: 'Doji',                     type: 'neutral',  description: 'Indecision candle, open ≈ close' },
  dojistar:                 { label: 'Doji Star',                type: 'neutral',  description: 'Doji after strong candle' },
  downsidetasukigap:        { label: 'Downside Tasuki Gap',      type: 'bearish',  description: 'Continuation bearish gap pattern' },
  dragonflydoji:            { label: 'Dragonfly Doji',           type: 'bullish',  description: 'Long lower shadow, bullish reversal' },
  eveningdojistar:          { label: 'Evening Doji Star',        type: 'bearish',  description: 'Strong bearish reversal 3-candle' },
  eveningstar:              { label: 'Evening Star',             type: 'bearish',  description: '3-candle bearish reversal at top' },
  gravestonedoji:           { label: 'Gravestone Doji',          type: 'bearish',  description: 'Long upper shadow, bearish reversal' },
  hammer:                   { label: 'Hammer',                   type: 'bullish',  description: 'Long lower shadow in downtrend' },
  hangingman:               { label: 'Hanging Man',              type: 'bearish',  description: 'Long lower shadow in uptrend' },
  harami:                   { label: 'Harami',                   type: 'neutral',  description: 'Small candle inside previous large candle' },
  haramicross:              { label: 'Harami Cross',             type: 'neutral',  description: 'Doji inside previous large candle' },
  highwave:                 { label: 'High Wave',                type: 'neutral',  description: 'Long upper and lower shadows' },
  hikkake:                  { label: 'Hikkake',                  type: 'neutral',  description: 'False breakout pattern' },
  homingpigeon:             { label: 'Homing Pigeon',            type: 'bullish',  description: 'Bullish reversal small candle in large' },
  identical3crows:          { label: 'Identical 3 Crows',        type: 'bearish',  description: '3 consecutive bearish candles' },
  inneck:                   { label: 'In-Neck',                  type: 'bearish',  description: 'Bearish continuation pattern' },
  invertedHammer:           { label: 'Inverted Hammer',          type: 'bullish',  description: 'Long upper shadow after downtrend' },
  kicking:                  { label: 'Kicking',                  type: 'bullish',  description: 'Strong gap reversal' },
  kickingbylength:          { label: 'Kicking by Length',        type: 'bullish',  description: 'Kicking with longer candles' },
  ladderbottom:             { label: 'Ladder Bottom',            type: 'bullish',  description: '5-candle bullish reversal' },
  longneck:                 { label: 'Long-Neck',                type: 'bullish',  description: 'Bullish continuation' },
  marubozu:                 { label: 'Marubozu',                 type: 'neutral',  description: 'Full body candle, no shadows' },
  matchinglow:              { label: 'Matching Low',             type: 'bullish',  description: 'Two candles with same low' },
  morningdojistar:          { label: 'Morning Doji Star',        type: 'bullish',  description: 'Strong bullish reversal 3-candle' },
  morningstar:              { label: 'Morning Star',             type: 'bullish',  description: '3-candle bullish reversal at bottom' },
  onneck:                   { label: 'On-Neck',                  type: 'bearish',  description: 'Bearish continuation pattern' },
  piercingline:             { label: 'Piercing Line',            type: 'bullish',  description: 'Bullish reversal after downtrend' },
  rickshawman:              { label: 'Rickshaw Man',             type: 'neutral',  description: 'Long shadows, small body' },
  risefall3methods:         { label: 'Rise/Fall 3 Methods',      type: 'neutral',  description: '5-candle continuation pattern' },
  separatinglines:          { label: 'Separating Lines',         type: 'bullish',  description: 'Continuation pattern' },
  shootingstar:             { label: 'Shooting Star',            type: 'bearish',  description: 'Long upper shadow in uptrend' },
  shortline:                { label: 'Short Line',               type: 'neutral',  description: 'Small range candle' },
  spinningtop:              { label: 'Spinning Top',             type: 'neutral',  description: 'Small body, indecision' },
  stalledpattern:           { label: 'Stalled Pattern',          type: 'bearish',  description: 'Bullish trend stalling' },
  sticksandwich:            { label: 'Stick Sandwich',           type: 'bullish',  description: 'Bullish reversal' },
  takuri:                   { label: 'Takuri',                   type: 'bullish',  description: 'Long lower shadow, bullish' },
  tasukigap:                { label: 'Tasuki Gap',               type: 'bullish',  description: 'Bullish continuation gap' },
  threeblackcrows:          { label: 'Three Black Crows',        type: 'bearish',  description: '3 bearish candles, strong reversal' },
  threeinside:              { label: 'Three Inside',             type: 'bullish',  description: 'Reversal after harami' },
  threelinesrike:           { label: 'Three-Line Strike',        type: 'bearish',  description: '4-candle continuation' },
  threeoutside:             { label: 'Three Outside',            type: 'bullish',  description: 'Reversal after engulfing' },
  threewhitesoldiers:       { label: 'Three White Soldiers',     type: 'bullish',  description: '3 bullish candles, strong reversal' },
  thrusting:                { label: 'Thrusting',                type: 'bearish',  description: 'Bearish continuation' },
  tristar:                  { label: 'Tri-Star',                 type: 'bullish',  description: 'Rare reversal 3 doji' },
  twocrows:                 { label: 'Two Crows',                type: 'bearish',  description: '3-candle bearish reversal' },
  uniquethreeriver:         { label: 'Unique Three River',       type: 'bullish',  description: 'Rare bullish reversal' },
  upsidegap2crows:          { label: 'Upside Gap Two Crows',     type: 'bearish',  description: 'Bearish reversal after gap' },
  upsidedowngapthreemethods:{ label: 'Upside/Downside Gap 3 Methods', type: 'neutral', description: 'Continuation pattern' },
}

// Map of pattern key → function name in technicalindicators
const PATTERN_FN_MAP: Record<string, string> = {
  doji:                    'doji',
  dragonflydoji:           'dragonflydoji',
  gravestonedoji:          'gravestonedoji',
  bullishengulfingpattern: 'bullishengulfingpattern',
  bearishengulfingpattern: 'bearishengulfingpattern',
  morningstar:             'morningstar',
  eveningstar:             'eveningstar',
  morningdojistar:         'morningdojistar',
  eveningdojistar:         'eveningdojistar',
  threewhitesoldiers:      'threewhitesoldiers',
  threeblackcrows:         'threeblackcrows',
  bullishharami:           'bullishharami',
  bearishharami:           'bearishharami',
  bullishharamicross:      'bullishharamicross',
  bearishharamicross:      'bearishharamicross',
  piercingline:            'piercingline',
  darkcloudcover:          'darkcloudcover',
  hammerpattern:           'hammerpattern',
  shootingstar:            'shootingstar',
  hangingman:              'hangingman',
  bullishmarubozu:         'bullishmarubozu',
  bearishmarubozu:         'bearishmarubozu',
  abandonedbaby:           'abandonedbaby',
  tweezertop:              'tweezertop',
  tweezerbottom:           'tweezerbottom',
}

/** Detect all candlestick patterns for given candles */
export async function detectPatterns(candles: OHLCV[], lastNBars = 3): Promise<PatternResult[]> {
  if (candles.length < 5) return []

  const TI = await import('technicalindicators') as any
  const results: PatternResult[] = []

  // Slide a window over last N bars and check each pattern function
  for (const [patternKey, fnName] of Object.entries(PATTERN_FN_MAP)) {
    const fn = TI[fnName]
    if (typeof fn !== 'function') continue

    // Check within last lastNBars positions
    let detectedIdx = -1
    const checkFrom = Math.max(0, candles.length - lastNBars)
    for (let i = checkFrom; i < candles.length; i++) {
      // Include enough prior candles for multi-candle patterns (up to 5)
      const slice = candles.slice(Math.max(0, i - 4), i + 1)
      const input = {
        open:  slice.map(c => c.open),
        high:  slice.map(c => c.high),
        low:   slice.map(c => c.low),
        close: slice.map(c => c.close),
      }
      try {
        if (fn(input) === true) { detectedIdx = i; break }
      } catch { /* skip */ }
    }

    if (detectedIdx >= 0) {
      const meta = PATTERN_META[patternKey] ?? { label: patternKey, type: 'neutral' as const, description: '' }
      results.push({ name: patternKey, label: meta.label, type: meta.type, description: meta.description, detected: true, barIndex: detectedIdx })
    }
  }

  return results
}
