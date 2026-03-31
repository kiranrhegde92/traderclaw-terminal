/**
 * upload-parser.ts
 * Parse portfolio Excel/PDF uploads from Angel One / Zerodha / HDFC / ICICI
 */
import * as XLSX from 'xlsx'

export interface ParsedHolding {
  symbol:      string
  name:        string
  quantity:    number
  avgPrice:    number
  currentValue?: number
  exchange:    string
  isin?:       string
}

export interface ParsedPortfolio {
  source:    string
  holdings:  ParsedHolding[]
  totalCost: number
  errors:    string[]
}

/* ─── Excel Parser ─────────────────────────────────────────────────── */
export function parseExcel(buffer: Buffer): ParsedPortfolio {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const rows  = XLSX.utils.sheet_to_json<any>(ws, { defval: '' })
  const errors: string[] = []

  // Detect broker format from headers
  const headers  = Object.keys(rows[0] ?? {}).map(h => h.toLowerCase().trim())
  const source   = detectBroker(headers)

  const holdings: ParsedHolding[] = []

  for (const row of rows) {
    try {
      const h = mapRow(row, source)
      if (h && h.symbol && h.quantity > 0) holdings.push(h)
    } catch (e: any) {
      errors.push(`Row parse error: ${e.message}`)
    }
  }

  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.avgPrice, 0)
  return { source, holdings, totalCost, errors }
}

function detectBroker(headers: string[]): string {
  if (headers.some(h => h.includes('tradingsymbol'))) return 'zerodha'
  if (headers.some(h => h.includes('scrip name') || h.includes('scripname'))) return 'angelone'
  if (headers.some(h => h.includes('stock name'))) return 'hdfc'
  if (headers.some(h => h.includes('instrument'))) return 'icici'
  return 'generic'
}

function mapRow(row: any, source: string): ParsedHolding | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
      if (v !== undefined && v !== '') return String(v).trim()
    }
    return ''
  }
  const num = (...keys: string[]) => parseFloat(get(...keys).replace(/[₹,]/g, '')) || 0

  switch (source) {
    case 'zerodha':
      return {
        symbol:   get('Tradingsymbol', 'tradingsymbol', 'Symbol'),
        name:     get('Instrument', 'Company Name'),
        quantity: num('Quantity', 'quantity', 'Qty'),
        avgPrice: num('Average price', 'Average Price', 'Avg Price'),
        exchange: get('Exchange') || 'NSE',
        isin:     get('ISIN'),
      }
    case 'angelone':
      return {
        symbol:   get('Symbol', 'Scrip Name', 'scripName'),
        name:     get('Company Name', 'Scrip Name'),
        quantity: num('Quantity', 'Net Qty', 'Qty'),
        avgPrice: num('Average Price', 'Avg Price', 'Buy Avg'),
        exchange: get('Exchange') || 'NSE',
        isin:     get('ISIN'),
      }
    case 'hdfc':
      return {
        symbol:   get('Stock Symbol', 'Symbol'),
        name:     get('Stock Name', 'Company'),
        quantity: num('Quantity', 'Qty', 'Units'),
        avgPrice: num('Average Cost', 'Avg Cost', 'Buy Price'),
        exchange: 'NSE',
        isin:     get('ISIN'),
      }
    case 'icici':
      return {
        symbol:   get('Instrument', 'Symbol'),
        name:     get('Instrument', 'Name'),
        quantity: num('Quantity', 'Qty'),
        avgPrice: num('Avg. Price', 'Avg Price', 'Average Price'),
        exchange: get('Exch') || 'NSE',
        isin:     get('ISIN'),
      }
    default:
      // Generic — try common column names
      const symbol = get('Symbol', 'Stock', 'Ticker', 'Scrip', 'Instrument')
      if (!symbol) return null
      return {
        symbol,
        name:     get('Name', 'Company', 'Description') || symbol,
        quantity: num('Quantity', 'Qty', 'Units', 'Shares'),
        avgPrice: num('Avg Price', 'Average Price', 'Cost', 'Buy Price', 'Price'),
        exchange: get('Exchange', 'Exch') || 'NSE',
        isin:     get('ISIN'),
      }
  }
}

/* ─── PDF Parser ─────────────────────────────────────────────────── */
export async function parsePDF(buffer: Buffer): Promise<ParsedPortfolio> {
  // Dynamic import to avoid server-side issues
  const pdfParse = (await import('pdf-parse')).default
  const pdf = await pdfParse(buffer)
  return parsePDFText(pdf.text)
}

function parsePDFText(text: string): ParsedPortfolio {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean)
  const holdings: ParsedHolding[] = []
  const errors:   string[] = []

  // Regex patterns for common line formats
  // e.g. "RELIANCE     100   2450.00   245000.00"
  const lineRe = /([A-Z]{2,20}(?:[-&][A-Z]+)?)\s+(\d+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/

  for (const line of lines) {
    const m = line.match(lineRe)
    if (!m) continue
    const [, symbol, qty, price] = m
    const quantity = parseInt(qty)
    const avgPrice = parseFloat(price.replace(/,/g, ''))
    if (symbol && quantity > 0 && avgPrice > 0) {
      holdings.push({ symbol, name: symbol, quantity, avgPrice, exchange: 'NSE' })
    }
  }

  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.avgPrice, 0)
  return { source: 'pdf', holdings, totalCost, errors }
}
