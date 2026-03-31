'use client'
import useSWR from 'swr'
import { formatINR } from '@/lib/utils/format'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function betaLabel(b: number): { label: string; color: string } {
  if (b > 1.2) return { label: 'Aggressive', color: 'var(--red)' }
  if (b >= 0.8) return { label: 'Moderate', color: 'var(--amber)' }
  return { label: 'Defensive', color: 'var(--green)' }
}

function MetricCard({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '12px 18px', minWidth: 140, flex: 1,
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function RiskMetrics() {
  const { data, isLoading, error } = useSWR('/api/portfolio/risk', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30 * 60 * 1000,
  })

  if (isLoading) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
      Computing risk metrics (may take ~10s)...
    </div>
  )
  if (error || data?.error) return (
    <div style={{ padding: 24, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>
      {data?.error ?? 'Failed to load risk metrics'}
    </div>
  )

  const {
    beta = 0, var95 = 0, var99 = 0, maxDrawdown = 0,
    portfolioStdDev = 0, stocks = [], distribution = [], cachedAt,
  } = data ?? {}

  const { label: betaLbl, color: betaColor } = betaLabel(beta)
  const maxCount = Math.max(...distribution.map((d: any) => d.count), 1)

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', fontSize: 13 }}>
      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard
          title="Portfolio Beta"
          value={beta.toFixed(2)}
          sub={`${betaLbl} vs NIFTY`}
          color={betaColor}
        />
        <MetricCard
          title="VaR 95% (1-day)"
          value={formatINR(var95)}
          sub="Parametric, 95% confidence"
          color="var(--amber)"
        />
        <MetricCard
          title="VaR 99% (1-day)"
          value={formatINR(var99)}
          sub="Parametric, 99% confidence"
          color="var(--red)"
        />
        <MetricCard
          title="Max 5-Day Drawdown"
          value={`${maxDrawdown}%`}
          sub="Worst 5-day return"
          color={maxDrawdown < -5 ? 'var(--red)' : maxDrawdown < -2 ? 'var(--amber)' : 'var(--green)'}
        />
        <MetricCard
          title="Portfolio Std Dev"
          value={`${portfolioStdDev}%`}
          sub="Daily returns (30d)"
        />
      </div>

      {/* Return distribution histogram */}
      {distribution.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            RETURN DISTRIBUTION (30 DAYS)
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {distribution.map((d: any, i: number) => {
              const h = (d.count / maxCount) * 80
              return (
                <div key={i} title={`${d.label}: ${d.count} days`}
                  style={{
                    flex: 1, height: `${h}px`, minHeight: 2,
                    background: d.label.startsWith('-') ? 'var(--red)' : 'var(--green)',
                    opacity: 0.8, borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: 10, marginTop: 4 }}>
            <span>{distribution[0]?.label}</span>
            <span>Returns</span>
            <span>{distribution[distribution.length - 1]?.label}</span>
          </div>
        </div>
      )}

      {/* Individual stock betas */}
      {stocks.length > 0 && (
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>STOCK BETAS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {['Symbol', 'Qty', 'Value', 'Weight%', 'Beta', 'StdDev%'].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: h === 'Symbol' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.map((s: any, i: number) => {
                const { color } = betaLabel(s.beta)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--cyan)' }}>{s.symbol}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{s.quantity}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{formatINR(s.value)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{s.weight}%</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color }}>{s.beta}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-dim)' }}>{s.stdDev}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cachedAt && (
            <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 8 }}>
              Cached at {new Date(cachedAt).toLocaleTimeString()} · refreshes every 30 min
            </div>
          )}
        </div>
      )}
    </div>
  )
}
