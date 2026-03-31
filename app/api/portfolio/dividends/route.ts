import { NextResponse } from 'next/server'

/* Hardcoded upcoming dividend data for major NIFTY stocks */
const DIVIDEND_DATA = [
  { symbol: 'TCS',         name: 'Tata Consultancy Services', exDate: '2025-07-10', dividendPerShare: 10,  yield: 0.28 },
  { symbol: 'INFY',        name: 'Infosys',                   exDate: '2025-05-30', dividendPerShare: 21,  yield: 0.95 },
  { symbol: 'HDFCBANK',    name: 'HDFC Bank',                 exDate: '2025-07-18', dividendPerShare: 19.5, yield: 1.15 },
  { symbol: 'ICICIBANK',   name: 'ICICI Bank',                exDate: '2025-08-05', dividendPerShare: 10,  yield: 0.82 },
  { symbol: 'HINDUNILVR',  name: 'Hindustan Unilever',        exDate: '2025-06-20', dividendPerShare: 24,  yield: 1.05 },
  { symbol: 'ITC',         name: 'ITC Ltd',                   exDate: '2025-07-02', dividendPerShare: 7.5,  yield: 1.89 },
  { symbol: 'RELIANCE',    name: 'Reliance Industries',        exDate: '2025-09-12', dividendPerShare: 10,  yield: 0.40 },
  { symbol: 'COALINDIA',   name: 'Coal India',                exDate: '2025-05-15', dividendPerShare: 5,   yield: 1.22 },
  { symbol: 'ONGC',        name: 'ONGC',                      exDate: '2025-08-22', dividendPerShare: 5.5,  yield: 2.05 },
  { symbol: 'NTPC',        name: 'NTPC',                      exDate: '2025-07-28', dividendPerShare: 3.75, yield: 1.35 },
  { symbol: 'POWERGRID',   name: 'Power Grid Corp',           exDate: '2025-06-30', dividendPerShare: 7.5,  yield: 2.10 },
  { symbol: 'NESTLEIND',   name: 'Nestle India',              exDate: '2025-10-08', dividendPerShare: 140, yield: 0.92 },
  { symbol: 'BRITANNIA',   name: 'Britannia Industries',      exDate: '2025-08-14', dividendPerShare: 72,  yield: 1.45 },
  { symbol: 'WIPRO',       name: 'Wipro',                     exDate: '2025-06-05', dividendPerShare: 5,   yield: 0.95 },
  { symbol: 'HCLTECH',     name: 'HCL Technologies',          exDate: '2025-07-22', dividendPerShare: 18,  yield: 1.32 },
  { symbol: 'TECHM',       name: 'Tech Mahindra',             exDate: '2025-08-18', dividendPerShare: 28,  yield: 2.05 },
  { symbol: 'SBIN',        name: 'State Bank of India',       exDate: '2025-06-12', dividendPerShare: 13.7, yield: 1.88 },
  { symbol: 'BAJFINANCE',  name: 'Bajaj Finance',             exDate: '2025-09-05', dividendPerShare: 36,  yield: 0.48 },
  { symbol: 'KOTAKBANK',   name: 'Kotak Mahindra Bank',       exDate: '2025-07-15', dividendPerShare: 2,   yield: 0.12 },
  { symbol: 'MARUTI',      name: 'Maruti Suzuki',             exDate: '2025-08-28', dividendPerShare: 125, yield: 0.95 },
  { symbol: 'TITAN',       name: 'Titan Company',             exDate: '2025-06-25', dividendPerShare: 10,  yield: 0.30 },
  { symbol: 'SUNPHARMA',   name: 'Sun Pharma',                exDate: '2025-07-08', dividendPerShare: 5,   yield: 0.40 },
  { symbol: 'DRREDDY',     name: "Dr Reddy's Labs",           exDate: '2025-10-14', dividendPerShare: 40,  yield: 0.65 },
  { symbol: 'GAIL',        name: 'GAIL India',                exDate: '2025-09-18', dividendPerShare: 5.5,  yield: 2.25 },
  { symbol: 'AXISBANK',    name: 'Axis Bank',                 exDate: '2025-08-01', dividendPerShare: 1,   yield: 0.10 },
]

export async function GET() {
  return NextResponse.json({ data: DIVIDEND_DATA })
}
