'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { formatINR } from '@/lib/utils/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const TAX_YEARS = ['FY 2024-25', 'FY 2023-24', 'FY 2022-23', 'FY 2021-22']

export default function TaxPage() {
  const [fy, setFy] = useState('FY 2024-25')
  const { data, isLoading } = useSWR(`/api/portfolio/tax?fy=${encodeURIComponent(fy)}`, fetcher)

  const {
    stcgTrades = [], ltcgTrades = [],
    totalSTCG = 0, totalLTCG = 0,
    estimatedTax = 0, stcgTax = 0, ltcgTax = 0,
    ltcgExemptionUsed = 0,
  } = data ?? {}
  const allTrades = [...stcgTrades, ...ltcgTrades]

  function downloadCSV() {
    const headers = ['Symbol','Buy Date','Sell Date','Holding Days','Qty','Buy Price','Sell Price','Gross Gain','STT','Charges','Net Gain','Type']
    const rows = allTrades.map((t: any) => [
      t.symbol, t.buyDate, t.sellDate, t.holdingDays, t.quantity,
      t.buyPrice, t.sellPrice, t.grossGain, t.stt, t.charges, t.netGain, t.classification
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    const a = document.createElement('a')
    a.href = uri
    a.download = `tax_pnl_${fy.replace(' ', '_')}.csv`
    a.click()
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'JetBrains Mono, monospace', padding: 24,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--cyan)' }}>Tax P&L Report</h1>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>FIFO-based capital gains — Indian tax regime</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={fy}
              onChange={e => setFy(e.target.value)}
              style={{
                background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 12px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
              }}
            >
              {TAX_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={downloadCSV}
              style={{
                background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: 6,
                padding: '7px 16px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: 48, textAlign: 'center' }}>Computing tax report...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
              {[
                { label: 'Total STCG', value: formatINR(totalSTCG), sub: 'Short-term gains', color: totalSTCG >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'Total LTCG', value: formatINR(totalLTCG), sub: 'Long-term gains', color: totalLTCG >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: 'STCG Tax @20%', value: formatINR(stcgTax), sub: 'Flat rate', color: 'var(--amber)' },
                { label: 'LTCG Tax @12.5%', value: formatINR(ltcgTax), sub: `₹1.25L exemption used: ${formatINR(ltcgExemptionUsed)}`, color: 'var(--amber)' },
                { label: 'Estimated Total Tax', value: formatINR(estimatedTax), sub: 'Before surcharge & cess', color: 'var(--red)' },
              ].map(card => (
                <div key={card.label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 18px', minWidth: 170, flex: 1,
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 3 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Tax note */}
            <div style={{
              background: 'rgba(255,160,0,0.08)', border: '1px solid var(--amber)',
              borderRadius: 6, padding: '8px 14px', marginBottom: 20, fontSize: 11, color: 'var(--amber)',
            }}>
              ⚠ These are estimates based on paper trades. Rates: STCG equity = 20% | LTCG equity = 12.5% above ₹1.25L exemption. Consult a CA for actual filing.
            </div>

            {/* Trades table */}
            {allTrades.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px 0' }}>
                No closed trades in {fy}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {['Symbol','Buy Date','Sell Date','Days','Qty','Buy ₹','Sell ₹','Gross Gain','STT','Net Gain','Type'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Symbol' ? 'left' : 'right', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allTrades.map((t: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--cyan)' }}>{t.symbol}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{t.buyDate}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{t.sellDate}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{t.holdingDays}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{t.quantity}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(t.buyPrice)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(t.sellPrice)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: t.grossGain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatINR(t.grossGain)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--red)' }}>{formatINR(t.stt)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: t.netGain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatINR(t.netGain)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                          <span style={{
                            background: t.classification === 'STCG' ? 'rgba(255,160,0,0.15)' : 'rgba(0,200,200,0.15)',
                            color: t.classification === 'STCG' ? 'var(--amber)' : 'var(--cyan)',
                            borderRadius: 4, padding: '2px 6px', fontSize: 11,
                          }}>{t.classification}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button, select { display: none !important; }
        }
      `}</style>
    </div>
  )
}
