'use client'
import useSWR from 'swr'
import { formatINR } from '@/lib/utils/format'
import TerminalCard from '@/components/ui/TerminalCard'
import { Activity } from 'lucide-react'

interface Snapshot { time: string; pnl: number; invested: number }

const fetcher = (url: string) => fetch(url).then(r => r.json())

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const MARKET_OPEN  = 9 * 60 + 15   // 555
const MARKET_CLOSE = 15 * 60 + 30  // 930

export default function IntradayPnlChart({
  currentPnl,
  currentInvested,
}: {
  currentPnl?: number
  currentInvested?: number
}) {
  const { data } = useSWR<{ data: Snapshot[] }>('/api/portfolio/pnl-history', fetcher, {
    refreshInterval: 30000,
  })

  const snaps: Snapshot[] = data?.data ?? []

  // Merge live value as the last point
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const nowTime = now.toISOString().slice(11, 16)

  const points: Snapshot[] = [...snaps]
  if (currentPnl !== undefined && currentInvested !== undefined) {
    const last = points[points.length - 1]
    if (!last || last.time !== nowTime) {
      points.push({ time: nowTime, pnl: currentPnl, invested: currentInvested })
    } else {
      points[points.length - 1] = { time: nowTime, pnl: currentPnl, invested: currentInvested }
    }
  }

  if (points.length === 0) {
    return (
      <TerminalCard title="Intraday P&L" icon={<Activity size={14} />} className="mb-6">
        <div className="h-32 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Collecting data — updates every 30s during market hours
        </div>
      </TerminalCard>
    )
  }

  const latestPnl  = points[points.length - 1]?.pnl ?? 0
  const latestRet  = (() => {
    const inv = points[points.length - 1]?.invested ?? 0
    return inv > 0 ? (latestPnl / inv) * 100 : 0
  })()
  const pnlColor   = latestPnl >= 0 ? 'var(--green)' : 'var(--red)'

  // SVG dimensions
  const W = 600, H = 120, PL = 8, PR = 8, PT = 12, PB = 20

  const minPnl = Math.min(0, ...points.map(p => p.pnl))
  const maxPnl = Math.max(0, ...points.map(p => p.pnl))
  const range  = maxPnl - minPnl || 1

  function toX(t: string) {
    const mins = Math.max(MARKET_OPEN, Math.min(MARKET_CLOSE, timeToMins(t)))
    return PL + ((mins - MARKET_OPEN) / (MARKET_CLOSE - MARKET_OPEN)) * (W - PL - PR)
  }
  function toY(v: number) {
    return PT + (1 - (v - minPnl) / range) * (H - PT - PB)
  }

  const zeroY  = toY(0)
  const pts    = points.map(p => `${toX(p.time)},${toY(p.pnl)}`).join(' ')
  // Closed area polygon for fill
  const first  = points[0]
  const last   = points[points.length - 1]
  const polyFill = `${toX(first.time)},${zeroY} ${pts} ${toX(last.time)},${zeroY}`

  // Time labels
  const labels = ['09:15', '11:00', '13:00', '15:00', '15:30']

  return (
    <TerminalCard title="Intraday P&L" icon={<Activity size={14} />} className="mb-6">
      <div className="space-y-3">
        {/* Summary row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Today's P&L</div>
            <div className="text-lg font-bold font-mono" style={{ color: pnlColor }}>
              {latestPnl >= 0 ? '+' : '−'}{formatINR(Math.abs(latestPnl), true)}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Return</div>
            <div className="text-base font-bold font-mono" style={{ color: pnlColor }}>
              {latestRet >= 0 ? '+' : ''}{latestRet.toFixed(2)}%
            </div>
          </div>
          <div className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            {points.length} data point{points.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* SVG Chart */}
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Zero line */}
            <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY}
              stroke="#333" strokeWidth="1" strokeDasharray="4,3" />

            {/* Fill area */}
            {points.length > 1 && (
              <polygon
                points={polyFill}
                fill={latestPnl >= 0 ? 'rgba(0,255,65,0.12)' : 'rgba(255,0,64,0.12)'}
              />
            )}

            {/* P&L line */}
            {points.length > 1 && (
              <polyline
                points={pts}
                fill="none"
                stroke={pnlColor}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Single point dot */}
            {points.length === 1 && (
              <circle cx={toX(points[0].time)} cy={toY(points[0].pnl)} r="3" fill={pnlColor} />
            )}

            {/* Last value dot */}
            {points.length > 1 && (
              <circle cx={toX(last.time)} cy={toY(last.pnl)} r="3" fill={pnlColor} />
            )}

            {/* Time labels */}
            {labels.map(t => (
              <text key={t} x={toX(t)} y={H - 4} textAnchor="middle"
                fontSize="9" fill="var(--text-muted)" fontFamily="monospace">
                {t}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </TerminalCard>
  )
}
