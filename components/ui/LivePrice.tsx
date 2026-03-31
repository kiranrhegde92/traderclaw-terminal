'use client'

import { usePrice, formatLTP } from '@/hooks/usePriceFeed'

interface Props {
  symbol:   string
  exchange?: string
  showChange?: boolean
  className?: string
}

export default function LivePrice({ symbol, exchange = 'NSE', showChange = true, className }: Props) {
  const tick = usePrice(symbol, exchange)

  if (!tick) {
    return <span className={className} style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>—</span>
  }

  const up = tick.change >= 0

  return (
    <span className={className} style={{ fontFamily: 'JetBrains Mono' }}>
      <span style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
        ₹{formatLTP(tick.ltp)}
      </span>
      {showChange && (
        <span className="ml-2 text-xs" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
          {up ? '▲' : '▼'} {Math.abs(tick.change).toFixed(2)} ({Math.abs(tick.changePct).toFixed(2)}%)
        </span>
      )}
    </span>
  )
}
