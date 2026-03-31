/**
 * 50+ options strategy template definitions
 * Each template defines leg structure with relative strikes
 */

export interface StrategyTemplate {
  name:             string
  category:         string
  description:      string
  legs:             Array<{ type: 'CE' | 'PE' | 'FUT'; action: 'BUY' | 'SELL'; strikeOffset: number; lots: number }>
  maxProfit:        string
  maxLoss:          string
  breakevenFormula: string
  marketOutlook:    string
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  // ===== BULLISH STRATEGIES =====
  { name: 'Long Call',          category: 'Bullish',  description: 'Buy a call option. Unlimited profit, limited loss.',
    legs: [{ type:'CE', action:'BUY',  strikeOffset: 0, lots: 1 }],
    maxProfit: 'Unlimited', maxLoss: 'Premium Paid', breakevenFormula: 'Strike + Premium', marketOutlook: 'Strongly bullish' },

  { name: 'Short Put',          category: 'Bullish',  description: 'Sell a put. Collect premium if stock stays above strike.',
    legs: [{ type:'PE', action:'SELL', strikeOffset: 0, lots: 1 }],
    maxProfit: 'Premium Received', maxLoss: 'Strike - Premium', breakevenFormula: 'Strike - Premium', marketOutlook: 'Mildly bullish' },

  { name: 'Bull Call Spread',   category: 'Bullish',  description: 'Buy lower CE, sell higher CE. Reduced cost, capped profit.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:-1, lots:1 }, { type:'CE', action:'SELL', strikeOffset:1, lots:1 }],
    maxProfit: 'Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Lower Strike + Net Debit', marketOutlook: 'Mildly bullish' },

  { name: 'Bull Put Spread',    category: 'Bullish',  description: 'Sell higher PE, buy lower PE. Credit spread.',
    legs: [{ type:'PE', action:'SELL', strikeOffset:0, lots:1 }, { type:'PE', action:'BUY', strikeOffset:-2, lots:1 }],
    maxProfit: 'Net Credit', maxLoss: 'Width - Net Credit', breakevenFormula: 'Upper Strike - Net Credit', marketOutlook: 'Mildly bullish' },

  { name: 'Covered Call',       category: 'Bullish',  description: 'Hold stock, sell call. Income generation.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:1, lots:1 }],
    maxProfit: 'Strike - Entry + Premium', maxLoss: 'Entry - Premium', breakevenFormula: 'Entry - Premium', marketOutlook: 'Mildly bullish / neutral' },

  { name: 'Protective Put',     category: 'Bullish',  description: 'Hold stock, buy put. Downside protection.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:-1, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Entry - Strike + Premium', breakevenFormula: 'Entry + Premium', marketOutlook: 'Bullish with hedge' },

  { name: 'Long Combo',         category: 'Bullish',  description: 'Buy OTM call, sell OTM put. Bullish with no cost.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Unlimited', breakevenFormula: 'Net credit/debit adjusted strikes', marketOutlook: 'Strongly bullish' },

  { name: 'Call Ratio Backspread', category: 'Bullish', description: 'Sell 1 ITM call, buy 2 OTM calls. Profits from big move up.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:-1, lots:1 }, { type:'CE', action:'BUY', strikeOffset:1, lots:2 }],
    maxProfit: 'Unlimited', maxLoss: 'Width - Net Credit', breakevenFormula: 'Upper strike + Max loss / extra lots', marketOutlook: 'Strongly bullish' },

  // ===== BEARISH STRATEGIES =====
  { name: 'Long Put',           category: 'Bearish',  description: 'Buy a put option. Profits when price falls.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'Strike - Premium', maxLoss: 'Premium Paid', breakevenFormula: 'Strike - Premium', marketOutlook: 'Strongly bearish' },

  { name: 'Short Call',         category: 'Bearish',  description: 'Sell a call. Collect premium if stock stays below strike.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:0, lots:1 }],
    maxProfit: 'Premium Received', maxLoss: 'Unlimited', breakevenFormula: 'Strike + Premium', marketOutlook: 'Mildly bearish' },

  { name: 'Bear Put Spread',    category: 'Bearish',  description: 'Buy higher PE, sell lower PE. Defined risk.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Upper Strike - Net Debit', marketOutlook: 'Mildly bearish' },

  { name: 'Bear Call Spread',   category: 'Bearish',  description: 'Sell lower CE, buy higher CE. Credit spread.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:0, lots:1 }, { type:'CE', action:'BUY', strikeOffset:2, lots:1 }],
    maxProfit: 'Net Credit', maxLoss: 'Width - Net Credit', breakevenFormula: 'Lower Strike + Net Credit', marketOutlook: 'Mildly bearish' },

  { name: 'Put Ratio Backspread', category:'Bearish', description: 'Sell 1 ITM put, buy 2 OTM puts. Profits from big move down.',
    legs: [{ type:'PE', action:'SELL', strikeOffset:1, lots:1 }, { type:'PE', action:'BUY', strikeOffset:-1, lots:2 }],
    maxProfit: 'Large', maxLoss: 'Width - Net Credit', breakevenFormula: 'Upper strike - Max loss', marketOutlook: 'Strongly bearish' },

  // ===== NEUTRAL / INCOME STRATEGIES =====
  { name: 'Short Straddle',     category: 'Neutral',  description: 'Sell ATM call and put. Profit from low volatility.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:0, lots:1 }, { type:'PE', action:'SELL', strikeOffset:0, lots:1 }],
    maxProfit: 'Total Premium', maxLoss: 'Unlimited', breakevenFormula: 'Strike ± Total Premium', marketOutlook: 'Range-bound' },

  { name: 'Long Straddle',      category: 'Volatile', description: 'Buy ATM call and put. Profit from big move either way.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:0, lots:1 }, { type:'PE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Total Premium', breakevenFormula: 'Strike ± Total Premium', marketOutlook: 'Highly volatile' },

  { name: 'Short Strangle',     category: 'Neutral',  description: 'Sell OTM call and put. Wider breakevens than straddle.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Total Premium', maxLoss: 'Unlimited', breakevenFormula: 'OTM strikes ± Total Premium', marketOutlook: 'Range-bound' },

  { name: 'Long Strangle',      category: 'Volatile', description: 'Buy OTM call and put. Cheaper than straddle.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:1, lots:1 }, { type:'PE', action:'BUY', strikeOffset:-1, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Total Premium', breakevenFormula: 'Strikes ± Total Premium', marketOutlook: 'Highly volatile' },

  { name: 'Iron Condor',        category: 'Neutral',  description: 'Sell OTM strangle, buy wider strangle. Four legs.',
    legs: [
      { type:'PE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Net Credit', maxLoss: 'Wing Width - Net Credit', breakevenFormula: 'Inner strikes ± Net Credit', marketOutlook: 'Range-bound' },

  { name: 'Iron Butterfly',     category: 'Neutral',  description: 'Sell ATM straddle, buy OTM strangle. Maximum credit.',
    legs: [
      { type:'PE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:0,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Net Credit', maxLoss: 'Wing Width - Net Credit', breakevenFormula: 'Strike ± Net Credit', marketOutlook: 'Precisely range-bound' },

  { name: 'Jade Lizard',        category: 'Neutral',  description: 'Sell OTM put spread + OTM call. No upside risk.',
    legs: [
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Net Credit', maxLoss: 'Put Spread Width - Net Credit', breakevenFormula: 'CE strike ± credit, PE spread - credit', marketOutlook: 'Neutral to mildly bullish' },

  { name: 'Reverse Jade Lizard', category: 'Neutral', description: 'Sell OTM call spread + OTM put. No downside risk.',
    legs: [
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
    ],
    maxProfit: 'Net Credit', maxLoss: 'Call Spread Width - Net Credit', breakevenFormula: 'Adjusted strikes', marketOutlook: 'Neutral to mildly bearish' },

  // ===== CALENDAR SPREADS =====
  { name: 'Calendar Spread (Call)', category: 'Neutral', description: 'Sell near-term call, buy far-term call. Time decay play.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:0, lots:1 }, { type:'CE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'When short expires worthless', maxLoss: 'Net Debit', breakevenFormula: 'Depends on IVs', marketOutlook: 'Neutral, stable' },

  { name: 'Diagonal Spread',    category: 'Neutral',  description: 'Like calendar spread with different strikes.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:1, lots:1 }, { type:'CE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'When short expires worthless', maxLoss: 'Net Debit', breakevenFormula: 'Depends on structure', marketOutlook: 'Mildly bullish, stable' },

  // ===== VOLATILE STRATEGIES =====
  { name: 'Long Butterfly',     category: 'Neutral',  description: '3-leg spread. Profit near middle strike.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:2 },
      { type:'CE', action:'BUY',  strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Lower + Debit and Upper - Debit', marketOutlook: 'Very range-bound' },

  { name: 'Short Butterfly',    category: 'Volatile', description: 'Profit from big move away from middle strike.',
    legs: [
      { type:'CE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:0,  lots:2 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Net Credit', maxLoss: 'Width - Net Credit', breakevenFormula: 'Outer strikes ± adjustment', marketOutlook: 'Volatile' },

  { name: 'Broken Wing Butterfly (Call)', category: 'Neutral', description: 'Asymmetric butterfly. Zero cost or credit.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:2 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Net Credit + Wing Width', maxLoss: '0 or small', breakevenFormula: 'Asymmetric', marketOutlook: 'Neutral to mildly bullish' },

  { name: 'Christmas Tree',     category: 'Neutral',  description: '6-leg butterfly variant. Low risk.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Limited', maxLoss: 'Net Debit', breakevenFormula: 'Complex', marketOutlook: 'Mildly bullish, range-bound' },

  // ===== SYNTHETIC / FUTURES =====
  { name: 'Synthetic Long',     category: 'Bullish',  description: 'Buy ATM call, sell ATM put. Mimics long futures.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:0, lots:1 }, { type:'PE', action:'SELL', strikeOffset:0, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Unlimited (downside)', breakevenFormula: 'Strike + Net Debit', marketOutlook: 'Strongly bullish' },

  { name: 'Synthetic Short',    category: 'Bearish',  description: 'Buy ATM put, sell ATM call. Mimics short futures.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:0, lots:1 }, { type:'CE', action:'SELL', strikeOffset:0, lots:1 }],
    maxProfit: 'Large (downside)', maxLoss: 'Unlimited', breakevenFormula: 'Strike - Net Debit', marketOutlook: 'Strongly bearish' },

  // ===== MORE SPREADS =====
  { name: 'Ratio Call Spread',  category: 'Neutral',  description: 'Buy 1 lower call, sell 2 higher calls.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:-1, lots:1 }, { type:'CE', action:'SELL', strikeOffset:1, lots:2 }],
    maxProfit: 'Strike Width ± Credit', maxLoss: 'Unlimited (upside)', breakevenFormula: 'Complex', marketOutlook: 'Neutral to mildly bullish' },

  { name: 'Ratio Put Spread',   category: 'Neutral',  description: 'Buy 1 higher put, sell 2 lower puts.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:-1, lots:2 }],
    maxProfit: 'Strike Width ± Credit', maxLoss: 'Large (downside)', breakevenFormula: 'Complex', marketOutlook: 'Neutral to mildly bearish' },

  { name: 'Collar',             category: 'Bullish',  description: 'Hold stock + buy protective put + sell covered call.',
    legs: [{ type:'PE', action:'BUY', strikeOffset:-1, lots:1 }, { type:'CE', action:'SELL', strikeOffset:1, lots:1 }],
    maxProfit: 'CE Strike - Entry + Net Credit', maxLoss: 'Entry - PE Strike + Net Debit', breakevenFormula: 'Entry ± Net Debit/Credit', marketOutlook: 'Bullish with downside protection' },

  { name: 'Risk Reversal',      category: 'Bullish',  description: 'Sell OTM put, buy OTM call. Zero or low cost.',
    legs: [{ type:'PE', action:'SELL', strikeOffset:-1, lots:1 }, { type:'CE', action:'BUY', strikeOffset:1, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Large (downside)', breakevenFormula: 'OTM strikes ± net credit/debit', marketOutlook: 'Bullish' },

  { name: 'Condor (Long)',      category: 'Volatile', description: '4-leg spread like butterfly but with wider inner strikes.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Inner Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Inner strikes ± Net Debit', marketOutlook: 'Volatile' },

  { name: 'Double Diagonal',    category: 'Neutral',  description: 'Long diagonal call + long diagonal put.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1, lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
    ],
    maxProfit: 'When inner options expire worthless', maxLoss: 'Net Debit', breakevenFormula: 'IV-dependent', marketOutlook: 'Range-bound with IV contraction' },

  // ===== VOLATILE - GUTS / STRAP / STRIP =====
  { name: 'Strap',              category: 'Volatile', description: 'Buy 2 ATM calls + 1 ATM put. Bullish bias with volatility play.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:0, lots:2 }, { type:'PE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'Unlimited (upside > downside)', maxLoss: 'Total Premium', breakevenFormula: 'Strike + Premium/2 (up), Strike - Premium (down)', marketOutlook: 'Volatile with bullish bias' },

  { name: 'Strip',              category: 'Volatile', description: 'Buy 1 ATM call + 2 ATM puts. Bearish bias with volatility play.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:0, lots:1 }, { type:'PE', action:'BUY', strikeOffset:0, lots:2 }],
    maxProfit: 'Large (downside > upside)', maxLoss: 'Total Premium', breakevenFormula: 'Strike + Premium (up), Strike - Premium/2 (down)', marketOutlook: 'Volatile with bearish bias' },

  { name: 'Long Guts',          category: 'Volatile', description: 'Buy ITM call + ITM put. Similar to straddle but more expensive.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:-1, lots:1 }, { type:'PE', action:'BUY', strikeOffset:1, lots:1 }],
    maxProfit: 'Unlimited', maxLoss: 'Net Debit - ITM spread', breakevenFormula: 'CE strike - debit adj, PE strike + debit adj', marketOutlook: 'Highly volatile' },

  { name: 'Short Guts',         category: 'Neutral',  description: 'Sell ITM call + ITM put. High premium collection, high risk.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:-1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:1, lots:1 }],
    maxProfit: 'Net Credit - ITM spread', maxLoss: 'Unlimited', breakevenFormula: 'CE strike + net credit, PE strike - net credit', marketOutlook: 'Tightly range-bound' },

  // ===== REVERSE SPREADS =====
  { name: 'Reverse Iron Condor', category: 'Volatile', description: 'Buy OTM strangle, sell wider strangle. Profits from big breakout.',
    legs: [
      { type:'PE', action:'SELL', strikeOffset:-2, lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:1,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Wing Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Inner strikes ± Net Debit', marketOutlook: 'Big breakout expected' },

  { name: 'Reverse Iron Butterfly', category: 'Volatile', description: 'Buy ATM straddle, sell OTM strangle. Profits from large move.',
    legs: [
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:0,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:0,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Wing Width - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'Strike ± Net Debit', marketOutlook: 'Very large move expected' },

  // ===== LADDERS =====
  { name: 'Bull Call Ladder',   category: 'Bullish',  description: 'Buy 1 lower CE, sell 1 mid CE, sell 1 upper CE. Limited upside risk.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'Middle strike - Lower strike - Net Debit', maxLoss: 'Unlimited above upper strike', breakevenFormula: 'Complex', marketOutlook: 'Mildly bullish, below upper strike' },

  { name: 'Bear Put Ladder',    category: 'Bearish',  description: 'Buy 1 higher PE, sell 1 mid PE, sell 1 lower PE.',
    legs: [
      { type:'PE', action:'BUY',  strikeOffset:1,  lots:1 },
      { type:'PE', action:'SELL', strikeOffset:0,  lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
    ],
    maxProfit: 'Higher strike - Middle strike - Net Debit', maxLoss: 'Unlimited below lower strike', breakevenFormula: 'Complex', marketOutlook: 'Mildly bearish, above lower strike' },

  { name: 'Long Call Ladder',   category: 'Bullish',  description: 'Buy lower CE, buy mid CE, sell upper CE. Moderate bullish.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:0,  lots:1 },
      { type:'CE', action:'SELL', strikeOffset:2,  lots:2 },
    ],
    maxProfit: 'Net Credit if stock stays below upper', maxLoss: 'Net Debit', breakevenFormula: 'Below lower + Net Debit', marketOutlook: 'Moderately bullish' },

  // ===== INCOME / YIELD STRATEGIES =====
  { name: 'Cash-Secured Put',   category: 'Bullish',  description: 'Sell OTM put with cash reserved to buy stock. Income + entry strategy.',
    legs: [{ type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Premium Received', maxLoss: 'Strike - Premium (large)', breakevenFormula: 'Strike - Premium', marketOutlook: 'Neutral to mildly bullish, willing to own stock' },

  { name: 'Covered Strangle',   category: 'Neutral',  description: 'Hold stock + sell OTM call + sell OTM put. Enhanced income.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:1, lots:1 }, { type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Total Premium + Upside to CE strike', maxLoss: 'Large downside below PE strike', breakevenFormula: 'Entry - Total Premium', marketOutlook: 'Neutral with income focus' },

  { name: 'Wheel Strategy',     category: 'Neutral',  description: 'Cycle: sell CSP → get assigned → sell covered call → repeat.',
    legs: [{ type:'PE', action:'SELL', strikeOffset:-1, lots:1 }],
    maxProfit: 'Continuous premium income', maxLoss: 'Stock goes to zero', breakevenFormula: 'Entry - cumulative premium', marketOutlook: 'Long-term neutral to bullish' },

  { name: 'Poor Man\'s Covered Call', category: 'Bullish', description: 'Buy deep ITM LEAP call, sell short-term OTM call. Low capital covered call.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:-3, lots:1 }, { type:'CE', action:'SELL', strikeOffset:1, lots:1 }],
    maxProfit: 'OTM strike - ITM strike - Net Debit', maxLoss: 'Net Debit', breakevenFormula: 'ITM strike + Net Debit', marketOutlook: 'Mildly bullish, time-decay play' },

  // ===== SEAGULL / COMPLEX =====
  { name: 'Bullish Seagull',    category: 'Bullish',  description: 'Buy OTM call spread, sell OTM put. Zero or low cost bullish play.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:2, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
    ],
    maxProfit: 'CE spread width', maxLoss: 'Strike - Net Credit (downside)', breakevenFormula: 'PE strike - net credit', marketOutlook: 'Moderately bullish' },

  { name: 'Bearish Seagull',    category: 'Bearish',  description: 'Buy OTM put spread, sell OTM call. Zero or low cost bearish play.',
    legs: [
      { type:'PE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-2, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
    ],
    maxProfit: 'PE spread width', maxLoss: 'Strike + Net Credit (upside)', breakevenFormula: 'CE strike + net credit', marketOutlook: 'Moderately bearish' },

  // ===== BOX / ARBITRAGE =====
  { name: 'Box Spread',         category: 'Neutral',  description: 'Long call spread + short put spread at same strikes. Risk-free arbitrage.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:1,  lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
    ],
    maxProfit: 'Width - Net Debit (if mispriced)', maxLoss: 'Net Debit - Width', breakevenFormula: 'N/A (fixed value at expiry)', marketOutlook: 'Arbitrage, not directional' },

  // ===== SKIP-STRIKE / BATMAN =====
  { name: 'Skip-Strike Butterfly', category: 'Neutral', description: 'Like butterfly but skips a strike for wider profit zone.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:0,  lots:2 },
      { type:'CE', action:'BUY',  strikeOffset:3,  lots:1 },
    ],
    maxProfit: 'Net Credit + Asymmetric upside', maxLoss: 'Lower wing width', breakevenFormula: 'Asymmetric', marketOutlook: 'Neutral with slight upside bias' },

  { name: 'Batman Spread',      category: 'Neutral',  description: 'Two butterflies combined. Wide profit zone.',
    legs: [
      { type:'CE', action:'BUY',  strikeOffset:-3, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:-1, lots:2 },
      { type:'CE', action:'BUY',  strikeOffset:0,  lots:2 },
      { type:'CE', action:'SELL', strikeOffset:2,  lots:2 },
      { type:'CE', action:'BUY',  strikeOffset:3,  lots:1 },
    ],
    maxProfit: 'Limited, wide zone', maxLoss: 'Net Debit', breakevenFormula: 'Complex', marketOutlook: 'Range-bound in wide zone' },

  // ===== INDIAN MARKET SPECIALS =====
  { name: 'Nifty Weekly Short Straddle', category: 'Neutral', description: 'Sell ATM CE + PE on weekly Nifty expiry. Theta decay play.',
    legs: [{ type:'CE', action:'SELL', strikeOffset:0, lots:1 }, { type:'PE', action:'SELL', strikeOffset:0, lots:1 }],
    maxProfit: 'Full premium if Nifty stays at ATM', maxLoss: 'Unlimited', breakevenFormula: 'ATM ± Total Premium', marketOutlook: 'Low volatility week expected' },

  { name: 'BankNifty Iron Condor', category: 'Neutral', description: 'Classic weekly IC on BankNifty with 200-pt wings.',
    legs: [
      { type:'PE', action:'BUY',  strikeOffset:-2, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'CE', action:'SELL', strikeOffset:1,  lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2,  lots:1 },
    ],
    maxProfit: 'Net Credit (full range)', maxLoss: 'Wing Width - Net Credit', breakevenFormula: 'Inner strikes ± Net Credit', marketOutlook: 'BankNifty range-bound for week' },

  { name: 'Expiry Day Straddle', category: 'Volatile', description: 'Buy ATM straddle close to expiry. Low cost, high gamma.',
    legs: [{ type:'CE', action:'BUY', strikeOffset:0, lots:1 }, { type:'PE', action:'BUY', strikeOffset:0, lots:1 }],
    maxProfit: 'Unlimited (big expiry move)', maxLoss: 'Low premium (near expiry)', breakevenFormula: 'Strike ± small premium', marketOutlook: 'Big expiry-day move expected' },

  { name: 'Theta Spread',       category: 'Neutral',  description: 'Sell near-week strangle, buy next-week strangle. Pure theta capture.',
    legs: [
      { type:'CE', action:'SELL', strikeOffset:1, lots:1 },
      { type:'PE', action:'SELL', strikeOffset:-1, lots:1 },
      { type:'CE', action:'BUY',  strikeOffset:2, lots:1 },
      { type:'PE', action:'BUY',  strikeOffset:-2, lots:1 },
    ],
    maxProfit: 'Net Credit (theta decay)', maxLoss: 'Gap between expiries', breakevenFormula: 'OTM strikes ± Net Credit', marketOutlook: 'Stable for current week, hedge for tail risk' },
]
