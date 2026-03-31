import { NextResponse } from 'next/server'

// Hardcoded earnings calendar for next 30 days from March 29, 2026
// Major NIFTY 50 companies with expected results dates
const EARNINGS_CALENDAR = [
  { symbol: 'INFY',        company: 'Infosys',                  resultsDate: '2026-04-10', epsEstimate: 17.2, prevEps: 16.8 },
  { symbol: 'TCS',         company: 'Tata Consultancy Services', resultsDate: '2026-04-11', epsEstimate: 29.5, prevEps: 28.9 },
  { symbol: 'WIPRO',       company: 'Wipro',                    resultsDate: '2026-04-16', epsEstimate: 6.3,  prevEps: 6.1  },
  { symbol: 'HCLTECH',     company: 'HCL Technologies',         resultsDate: '2026-04-12', epsEstimate: 19.1, prevEps: 18.7 },
  { symbol: 'RELIANCE',    company: 'Reliance Industries',      resultsDate: '2026-04-25', epsEstimate: 68.4, prevEps: 65.2 },
  { symbol: 'HDFC',        company: 'HDFC Bank',                resultsDate: '2026-04-19', epsEstimate: 42.3, prevEps: 40.8 },
  { symbol: 'ICICIBANK',   company: 'ICICI Bank',               resultsDate: '2026-04-26', epsEstimate: 38.1, prevEps: 36.5 },
  { symbol: 'AXISBANK',    company: 'Axis Bank',                resultsDate: '2026-04-24', epsEstimate: 25.6, prevEps: 24.2 },
  { symbol: 'KOTAKBANK',   company: 'Kotak Mahindra Bank',      resultsDate: '2026-04-22', epsEstimate: 35.8, prevEps: 34.1 },
  { symbol: 'SBIN',        company: 'State Bank of India',      resultsDate: '2026-04-27', epsEstimate: 22.4, prevEps: 21.3 },
  { symbol: 'ITC',         company: 'ITC',                      resultsDate: '2026-04-29', epsEstimate: 5.9,  prevEps: 5.6  },
  { symbol: 'HINDUNILVR',  company: 'Hindustan Unilever',       resultsDate: '2026-04-23', epsEstimate: 28.7, prevEps: 27.9 },
  { symbol: 'LT',          company: 'Larsen & Toubro',          resultsDate: '2026-04-28', epsEstimate: 41.2, prevEps: 39.8 },
  { symbol: 'BHARTIARTL',  company: 'Bharti Airtel',            resultsDate: '2026-04-17', epsEstimate: 18.6, prevEps: 17.2 },
  { symbol: 'M&M',         company: 'Mahindra & Mahindra',      resultsDate: '2026-04-21', epsEstimate: 32.5, prevEps: 30.9 },
  { symbol: 'MARUTI',      company: 'Maruti Suzuki',            resultsDate: '2026-04-15', epsEstimate: 115.3, prevEps: 110.2 },
  { symbol: 'TATAMOTORS',  company: 'Tata Motors',              resultsDate: '2026-04-30', epsEstimate: 8.7,  prevEps: 7.9  },
  { symbol: 'BAJFINANCE',  company: 'Bajaj Finance',            resultsDate: '2026-04-14', epsEstimate: 55.2, prevEps: 52.8 },
  { symbol: 'ASIANPAINT',  company: 'Asian Paints',             resultsDate: '2026-04-20', epsEstimate: 22.1, prevEps: 21.4 },
  { symbol: 'SUNPHARMA',   company: 'Sun Pharmaceutical',       resultsDate: '2026-04-18', epsEstimate: 16.8, prevEps: 15.9 },
  { symbol: 'CIPLA',       company: 'Cipla',                    resultsDate: '2026-04-13', epsEstimate: 14.2, prevEps: 13.7 },
  { symbol: 'DRREDDY',     company: 'Dr Reddys Laboratories',   resultsDate: '2026-04-09', epsEstimate: 89.4, prevEps: 85.6 },
  { symbol: 'NTPC',        company: 'NTPC',                     resultsDate: '2026-04-08', epsEstimate: 4.8,  prevEps: 4.5  },
  { symbol: 'ONGC',        company: 'Oil & Natural Gas Corp',   resultsDate: '2026-04-07', epsEstimate: 6.2,  prevEps: 5.9  },
  { symbol: 'POWERGRID',   company: 'Power Grid Corp',          resultsDate: '2026-04-06', epsEstimate: 7.1,  prevEps: 6.8  },
  { symbol: 'JSWSTEEL',    company: 'JSW Steel',                resultsDate: '2026-04-05', epsEstimate: 12.3, prevEps: 11.7 },
  { symbol: 'TATASTEEL',   company: 'Tata Steel',               resultsDate: '2026-04-04', epsEstimate: 3.8,  prevEps: 3.2  },
  { symbol: 'GRASIM',      company: 'Grasim Industries',        resultsDate: '2026-04-03', epsEstimate: 44.6, prevEps: 43.1 },
  { symbol: 'ULTRACEMCO',  company: 'UltraTech Cement',         resultsDate: '2026-04-02', epsEstimate: 68.9, prevEps: 66.4 },
  { symbol: 'HDFCLIFE',    company: 'HDFC Life Insurance',      resultsDate: '2026-04-01', epsEstimate: 8.4,  prevEps: 7.9  },
]

export async function GET() {
  try {
    const today = new Date()
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const calendar = EARNINGS_CALENDAR.map(e => {
      const rd = new Date(e.resultsDate)
      const daysUntil = Math.ceil((rd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      return {
        ...e,
        daysUntil,
        upcoming: daysUntil >= 0 && rd <= in7Days,
      }
    }).sort((a, b) => a.daysUntil - b.daysUntil)

    return NextResponse.json({ data: calendar })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
