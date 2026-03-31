/**
 * scripts/download-symbols.ts
 * Download Angel One instrument master CSV and seed into instrument_master table
 * Run: npx tsx scripts/download-symbols.ts
 */
import { getDb } from '../lib/db'

const ANGEL_INSTRUMENT_URL =
  'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json'

interface Instrument {
  token:        string
  symbol:       string
  name:         string
  expiry:       string
  strike:       string
  lotsize:      string
  instrumenttype: string
  exch_seg:     string
  tick_size:    string
}

async function main() {
  console.log('Downloading Angel One instrument master...')
  const db = getDb()

  try {
    const res = await fetch(ANGEL_INSTRUMENT_URL, {
      headers: { 'User-Agent': 'OpenClaw-Terminal/1.0' },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const instruments: Instrument[] = await res.json()

    console.log(`Downloaded ${instruments.length} instruments`)

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO instrument_master
        (token, symbol, name, expiry, strike, lot_size, instrument_type, exchange, tick_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((items: Instrument[]) => {
      for (const i of items) {
        stmt.run(
          i.token,
          i.symbol,
          i.name,
          i.expiry || null,
          parseFloat(i.strike) || null,
          parseInt(i.lotsize)  || 1,
          i.instrumenttype,
          i.exch_seg,
          parseFloat(i.tick_size) || 0.05,
        )
      }
    })

    insertMany(instruments)
    console.log(`✅ Inserted ${instruments.length} instruments into database`)

  } catch (err: any) {
    console.error('Failed to download instruments:', err.message)
    console.log('You can retry later or use manual instrument data.')
  }
}

main().catch(console.error)
