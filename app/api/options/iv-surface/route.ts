import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/nse/cache'
import { getOptionChain } from '@/lib/nse/client'
import { impliedVolatility, daysToExpiry } from '@/lib/options/greeks'
import { getDb } from '@/lib/db'

const TTL_IV_SURFACE = 10 * 60 * 1000  // 10 minutes
const RISK_FREE_RATE = 0.065

function initIVTable() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS iv_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol      TEXT NOT NULL,
      expiry      TEXT NOT NULL,
      strike      REAL NOT NULL,
      ce_iv       REAL,
      pe_iv       REAL,
      avg_iv      REAL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_iv_sym_exp ON iv_history(symbol, expiry, recorded_at DESC)`) } catch { /* exists */ }
}

function calcIV(ltp: number, spot: number, strike: number, expiryStr: string, type: 'CE' | 'PE'): number | null {
  if (ltp <= 0 || spot <= 0) return null
  const T = daysToExpiry(expiryStr)
  if (T <= 0) return null
  const iv = impliedVolatility(ltp, spot, strike, T, RISK_FREE_RATE, type)
  return iv > 0 ? parseFloat((iv * 100).toFixed(2)) : null
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'NIFTY').toUpperCase()

  const cacheKey = `iv-surface:${symbol}`
  const cached   = cache.get<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    initIVTable()
    const db = getDb()

    const raw = await getOptionChain(symbol)
    if (!raw?.records) {
      return NextResponse.json({ error: 'Could not fetch option chain' }, { status: 503 })
    }

    const spot      = raw.records.underlyingValue ?? 0
    const expiries: string[] = (raw.records.expiryDates ?? []).slice(0, 3)  // current, next, far month
    const allRows   = raw.records.data ?? []

    if (!expiries.length) {
      return NextResponse.json({ error: 'No expiries found' }, { status: 404 })
    }

    // Find ATM strike from nearest expiry
    const nearRows = allRows.filter((r: any) => r.expiryDates === expiries[0])
    let minDist   = Infinity
    let atmStrike = 0
    for (const row of nearRows) {
      const dist = Math.abs(row.strikePrice - spot)
      if (dist < minDist) { minDist = dist; atmStrike = row.strikePrice }
    }

    // Determine strike step from chain
    const uniqueStrikes = new Set<number>(nearRows.map((r: any) => r.strikePrice as number))
    const sortedStrikes = Array.from(uniqueStrikes).sort((a, b) => a - b)
    const strikeStep = sortedStrikes.length >= 2 ? sortedStrikes[1] - sortedStrikes[0] : 50

    // Build surface: ATM ±5 strikes × 3 expiries
    const surfaceStrikes = Array.from({ length: 11 }, (_, i) => atmStrike + (i - 5) * strikeStep)

    const surface: any[] = []
    const insertIV = db.prepare(
      `INSERT INTO iv_history (symbol, expiry, strike, ce_iv, pe_iv, avg_iv)
       VALUES (@symbol, @expiry, @strike, @ce_iv, @pe_iv, @avg_iv)`
    )

    for (const expiry of expiries) {
      const expRows = allRows.filter((r: any) => r.expiryDates === expiry)
      const rowMap  = new Map(expRows.map((r: any) => [r.strikePrice, r]))

      for (const strike of surfaceStrikes) {
        const row: any = rowMap.get(strike)
        let ceIV: number | null = null
        let peIV: number | null = null

        if (row) {
          // Prefer NSE-provided IV; fallback to computed
          ceIV = row.CE?.impliedVolatility > 0
            ? row.CE.impliedVolatility
            : calcIV(row.CE?.lastPrice, spot, strike, expiry, 'CE')

          peIV = row.PE?.impliedVolatility > 0
            ? row.PE.impliedVolatility
            : calcIV(row.PE?.lastPrice, spot, strike, expiry, 'PE')
        }

        const avgIV = ceIV != null && peIV != null
          ? parseFloat(((ceIV + peIV) / 2).toFixed(2))
          : (ceIV ?? peIV)

        surface.push({ expiry, strike, ceIV, peIV, avgIV, isATM: strike === atmStrike })

        if (avgIV != null) {
          try {
            insertIV.run({ symbol, expiry, strike, ce_iv: ceIV, pe_iv: peIV, avg_iv: avgIV })
          } catch { /* ignore unique constraint issues */ }
        }
      }
    }

    // ATM IV for nearest expiry
    const atmEntry = surface.find(s => s.isATM && s.expiry === expiries[0])
    const atmIV    = atmEntry?.avgIV ?? null

    // IV Rank & IV Percentile from stored history (52-week window)
    const ivHistory = db.prepare(
      `SELECT avg_iv FROM iv_history
       WHERE symbol=? AND strike=? AND recorded_at >= datetime('now','-365 days')
       ORDER BY recorded_at ASC`
    ).all(symbol, atmStrike) as { avg_iv: number }[]

    let ivRank       = null
    let ivPercentile = null
    if (ivHistory.length > 1 && atmIV != null) {
      const ivValues  = ivHistory.map(r => r.avg_iv).filter(v => v > 0)
      const low52w    = Math.min(...ivValues)
      const high52w   = Math.max(...ivValues)
      if (high52w > low52w) {
        ivRank = parseFloat(((atmIV - low52w) / (high52w - low52w) * 100).toFixed(1))
      }
      const belowCurrent = ivValues.filter(v => v <= atmIV).length
      ivPercentile = parseFloat(((belowCurrent / ivValues.length) * 100).toFixed(1))
    }

    // Term structure: ATM IV per expiry
    const termStructure = expiries.map(exp => {
      const atmExp = surface.find(s => s.isATM && s.expiry === exp)
      const dte    = daysToExpiry(exp) * 365
      return { expiry: exp, dte: Math.round(dte), atmIV: atmExp?.avgIV ?? null }
    })

    const payload = {
      symbol,
      spot,
      atmStrike,
      expiries,
      surface,
      atmIV,
      ivRank,
      ivPercentile,
      termStructure,
    }

    cache.set(cacheKey, payload, TTL_IV_SURFACE)
    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
