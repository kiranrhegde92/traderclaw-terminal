'use client'
import useSWR from 'swr'
import { formatINR } from '@/lib/utils/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function GreekCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = Math.abs(value) > 0.01 ? (value > 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '12px 18px', minWidth: 120,
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value >= 0 ? '+' : ''}{value}</div>
      {sub && <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function GreeksAggregation() {
  const { data, isLoading, error } = useSWR('/api/portfolio/greeks', fetcher, { refreshInterval: 60000 })

  if (isLoading) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
      Computing Greeks...
    </div>
  )
  if (error || data?.error) return (
    <div style={{ padding: 24, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>
      {data?.error ?? 'Failed to load Greeks'}
    </div>
  )

  const { netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0, positions = [] } = data ?? {}
  const deltaAlert = Math.abs(netDelta) > 50
  const thetaAlert = Math.abs(netTheta) > 5000

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', fontSize: 13 }}>
      {/* Risk alerts */}
      {(deltaAlert || thetaAlert) && (
        <div style={{
          background: 'rgba(255,160,0,0.12)', border: '1px solid var(--amber)',
          borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 12,
          color: 'var(--amber)',
        }}>
          ⚠ Risk Alert:{' '}
          {deltaAlert && `Net Delta |${netDelta}| > 50 — high directional exposure. `}
          {thetaAlert && `Net Theta |${netTheta}| > ₹5000/day — significant time decay.`}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <GreekCard label="Net Δ Delta" value={netDelta} sub="Directional exposure" />
        <GreekCard label="Net Γ Gamma" value={netGamma} sub="Delta sensitivity" />
        <GreekCard label="Net Θ Theta/day" value={netTheta} sub="Time decay ₹/day" />
        <GreekCard label="Net V Vega" value={netVega} sub="Per 1% IV change" />
      </div>

      {/* Positions table */}
      {positions.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0' }}>
          No option positions found
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Symbol','Qty','Strike','Expiry','Type','Delta','Gamma','Theta','Vega','LTP'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Symbol' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: 0.9 }}>
                  <td style={{ padding: '7px 10px', color: 'var(--cyan)' }}>{p.symbol}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.quantity > 0 ? 'var(--green)' : 'var(--red)' }}>{p.quantity}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{p.strike}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.expiry}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.optionType === 'CE' ? 'var(--green)' : 'var(--red)' }}>{p.optionType}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.delta >= 0 ? 'var(--green)' : 'var(--red)' }}>{p.delta}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{p.gamma}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.theta < 0 ? 'var(--red)' : 'var(--green)' }}>{p.theta}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{p.vega}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(p.ltp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
