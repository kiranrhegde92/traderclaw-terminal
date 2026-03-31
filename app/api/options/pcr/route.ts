import { NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getOptionChain } from '@/lib/nse/client'
import { getDb } from '@/lib/db'

const TTL_PCR = 5 * 60 * 1000  // 5 minutes

function getSentiment(pcr: number): string {
  if (pcr < 0.7)  return 'Bearish'
  if (pcr < 1.0)  return 'Neutral'
  if (pcr <= 1.3) return 'Bullish'
  return 'Extreme Bullish'
}

function initPcrTable() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS pcr_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol    TEXT NOT NULL,
      expiry    TEXT NOT NULL DEFAULT '',
      pcr_oi    REAL NOT NULL,
      pcr_vol   REAL NOT NULL,
      nifty_spot REAL NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_pcr_sym_ts ON pcr_history(symbol, timestamp DESC)`) } catch { /* exists */ }
}

async function calcPCR(symbol: string) {
  const raw = await getOptionChain(symbol)
  if (!raw?.records) return null

  const spot    = raw.records.underlyingValue ?? 0
  const expiries: string[] = raw.records.expiryDates ?? []
  const allRows  = raw.records.data ?? []

  let totalCallOI = 0, totalPutOI = 0
  let totalCallVol = 0, totalPutVol = 0

  for (const row of allRows) {
    const ce = row.CE ?? {}
    const pe = row.PE ?? {}
    totalCallOI  += ce.openInterest          ?? 0
    totalPutOI   += pe.openInterest          ?? 0
    totalCallVol += ce.totalTradedVolume      ?? 0
    totalPutVol  += pe.totalTradedVolume      ?? 0
  }

  const pcrOI  = totalCallOI  > 0 ? totalPutOI  / totalCallOI  : 0
  const pcrVol = totalCallVol > 0 ? totalPutVol / totalCallVol : 0

  return { pcrOI, pcrVol, spot, sentiment: getSentiment(pcrOI), expiry: expiries[0] ?? '' }
}

export async function GET() {
  const cacheKey = 'pcr:nifty+banknifty'
  const cached = cache.get<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    initPcrTable()
    const db = getDb()

    const [niftyData, bankniftyData] = await Promise.all([
      calcPCR('NIFTY'),
      calcPCR('BANKNIFTY'),
    ])

    if (!niftyData || !bankniftyData) {
      // Return last stored values if live fetch failed
      const lastNifty     = db.prepare(`SELECT * FROM pcr_history WHERE symbol='NIFTY'     ORDER BY timestamp DESC LIMIT 1`).get() as any
      const lastBanknifty = db.prepare(`SELECT * FROM pcr_history WHERE symbol='BANKNIFTY' ORDER BY timestamp DESC LIMIT 1`).get() as any
      if (lastNifty || lastBanknifty) {
        return NextResponse.json({
          cached: true,
          nifty:     lastNifty     ? { pcrOI: lastNifty.pcr_oi,     pcrVol: lastNifty.pcr_vol,     spot: lastNifty.nifty_spot,     sentiment: getSentiment(lastNifty.pcr_oi)     } : null,
          banknifty: lastBanknifty ? { pcrOI: lastBanknifty.pcr_oi, pcrVol: lastBanknifty.pcr_vol, spot: lastBanknifty.nifty_spot, sentiment: getSentiment(lastBanknifty.pcr_oi) } : null,
          history: [],
        })
      }
      return NextResponse.json({ error: 'Could not fetch PCR data' }, { status: 503 })
    }

    // Persist to history
    const insert = db.prepare(
      `INSERT INTO pcr_history (symbol, expiry, pcr_oi, pcr_vol, nifty_spot)
       VALUES (@symbol, @expiry, @pcr_oi, @pcr_vol, @nifty_spot)`
    )
    insert.run({ symbol: 'NIFTY',     expiry: niftyData.expiry,     pcr_oi: niftyData.pcrOI,     pcr_vol: niftyData.pcrVol,     nifty_spot: niftyData.spot })
    insert.run({ symbol: 'BANKNIFTY', expiry: bankniftyData.expiry, pcr_oi: bankniftyData.pcrOI, pcr_vol: bankniftyData.pcrVol, nifty_spot: bankniftyData.spot })

    // Fetch last 10 days of history for both symbols
    const history = db.prepare(
      `SELECT symbol, date(timestamp) as date, AVG(pcr_oi) as pcr_oi, AVG(pcr_vol) as pcr_vol
       FROM pcr_history
       WHERE symbol IN ('NIFTY','BANKNIFTY') AND timestamp >= datetime('now','-10 days')
       GROUP BY symbol, date(timestamp)
       ORDER BY date ASC`
    ).all() as any[]

    const payload = {
      nifty:     { pcrOI: niftyData.pcrOI,     pcrVol: niftyData.pcrVol,     spot: niftyData.spot,     sentiment: niftyData.sentiment },
      banknifty: { pcrOI: bankniftyData.pcrOI, pcrVol: bankniftyData.pcrVol, spot: bankniftyData.spot, sentiment: bankniftyData.sentiment },
      history,
    }

    cache.set(cacheKey, payload, TTL_PCR)
    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
