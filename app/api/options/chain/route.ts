import { NextRequest, NextResponse } from 'next/server'
import { getOptionChain } from '@/lib/nse/client'
import { computeGreeks, impliedVolatility, daysToExpiry } from '@/lib/options/greeks'
import type { OptionChain, OptionStrike } from '@/types/options'

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') ?? 'NIFTY').toUpperCase()
  const expiry =  req.nextUrl.searchParams.get('expiry') ?? ''

  try {
    const raw = await getOptionChain(symbol)
    if (!raw) return NextResponse.json({ error: 'Could not fetch option chain' }, { status: 503 })

    const spot      = raw.records?.underlyingValue ?? 0
    // NSE returns all expiries at records.expiryDates; each row's expiry is at r.expiryDates (string)
    const expiries: string[] = raw.records?.expiryDates ?? []
    const targetExp = expiry || expiries[0] || ''
    const allRows   = raw.records?.data ?? []
    const rows      = targetExp
      ? allRows.filter((r: any) => r.expiryDates === targetExp)
      : allRows

    const strikes: OptionStrike[] = rows.map((row: any): OptionStrike => {
      const ce = row.CE ?? {}
      const pe = row.PE ?? {}

      // Use IV from NSE directly (already in % form); null if not available
      const ceIV = ce.impliedVolatility > 0 ? ce.impliedVolatility : null
      const peIV = pe.impliedVolatility > 0 ? pe.impliedVolatility : null

      // Delta from Black-Scholes (NSE doesn't provide it directly)
      const ceG = ce.lastPrice && spot && targetExp
        ? computeGreeks(spot, row.strikePrice, targetExp, 'CE', ce.lastPrice, 0.065)
        : null
      const peG = pe.lastPrice && spot && targetExp
        ? computeGreeks(spot, row.strikePrice, targetExp, 'PE', pe.lastPrice, 0.065)
        : null

      return {
        strikePrice:  row.strikePrice,
        expiryDate:   targetExp,
        // CE
        ce_ltp:       ce.lastPrice ?? 0,
        ce_change:    ce.change ?? 0,
        ce_changePct: ce.pChange ?? 0,
        ce_oi:        ce.openInterest ?? 0,
        ce_oiChange:  ce.changeinOpenInterest ?? 0,
        ce_volume:    ce.totalTradedVolume ?? 0,
        ce_iv:        ceIV,
        ce_delta:     ceG?.delta as number | null ?? null,
        ce_gamma:     ceG?.gamma as number | null ?? null,
        ce_theta:     ceG?.theta as number | null ?? null,
        ce_vega:      ceG?.vega as number | null ?? null,
        ce_bid:       ce.bidprice ?? 0,
        ce_ask:       ce.askPrice ?? 0,
        // PE
        pe_ltp:       pe.lastPrice ?? 0,
        pe_change:    pe.change ?? 0,
        pe_changePct: pe.pChange ?? 0,
        pe_oi:        pe.openInterest ?? 0,
        pe_oiChange:  pe.changeinOpenInterest ?? 0,
        pe_volume:    pe.totalTradedVolume ?? 0,
        pe_iv:        peIV,
        pe_delta:     peG?.delta as number | null ?? null,
        pe_gamma:     peG?.gamma as number | null ?? null,
        pe_theta:     peG?.theta as number | null ?? null,
        pe_vega:      peG?.vega as number | null ?? null,
        pe_bid:       pe.bidprice ?? 0,
        pe_ask:       pe.askPrice ?? 0,
        // Derived
        isATM:  Math.abs(row.strikePrice - spot) === Math.min(...rows.map((r: any) => Math.abs(r.strikePrice - spot))),
        pcr:    ce.openInterest ? (pe.openInterest ?? 0) / ce.openInterest : 0,
      }
    })

    const totalCeOI  = strikes.reduce((s, r) => s + r.ce_oi, 0)
    const totalPeOI  = strikes.reduce((s, r) => s + r.pe_oi, 0)
    // Use ATM IV as market IV (most meaningful); fallback to near-ATM average
    const atmStrike  = strikes.find(s => s.isATM)
    const avgIV      = atmStrike?.ce_iv ?? atmStrike?.pe_iv ?? null

    // Sort strikes by price ascending (ATM will be in the middle)
    strikes.sort((a, b) => a.strikePrice - b.strikePrice)

    const chain: OptionChain = {
      symbol,
      expiry:     targetExp,
      spotPrice:  spot,
      atmStrike:  strikes.find(s => s.isATM)?.strikePrice ?? spot,
      totalCeOI,
      totalPeOI,
      pcr:        totalCeOI ? totalPeOI / totalCeOI : 0,
      iv:         avgIV,
      strikes,
      expiries,
    }

    return NextResponse.json({ data: chain })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
