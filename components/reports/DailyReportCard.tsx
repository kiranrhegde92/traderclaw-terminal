'use client'
import { useState, useCallback } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import { formatINR, formatPct } from '@/lib/utils/format'
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  Download,
  AlertCircle,
} from 'lucide-react'

interface DailyReport {
  date?: string
  reportDate?: string
  openValue: number
  closedValue: number
  realizedPnl: number
  unrealizedPnl: number
  totalPnl: number
  totalReturn: number
  topGainers?: Array<{ symbol: string; qty: number; pnl: number; return: number }>
  topLosers?: Array<{ symbol: string; qty: number; pnl: number; return: number }>
  tradesExecuted: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
}

interface Props {
  accountId?: number
  onSettingsClick?: () => void
  brokerUnrealizedPnl?: number   // live unrealized P&L from broker holdings
  brokerInvested?: number        // total invested from broker holdings
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DailyReportCard({ accountId = 1, onSettingsClick, brokerUnrealizedPnl, brokerInvested }: Props) {
  const [isAutoRefreshEnabled] = useState(true)

  const { data, error, isLoading, mutate } = useSWR<{
    data: DailyReport
    cached?: boolean
    cacheExpiresAt?: string
  }>(
    `/api/reports/daily?accountId=${accountId}`,
    fetcher,
    {
      refreshInterval: 30 * 1000,       // refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10 * 1000,      // allow re-fetch after 10s
    }
  )

  const baseReport = data?.data

  // Overlay live broker P&L on top of paper-trade report when available
  const report: DailyReport | undefined = baseReport
    ? {
        ...baseReport,
        unrealizedPnl: brokerUnrealizedPnl ?? baseReport.unrealizedPnl,
        totalPnl:      (baseReport.realizedPnl) + (brokerUnrealizedPnl ?? baseReport.unrealizedPnl),
        totalReturn:   brokerInvested && brokerInvested > 0
          ? ((baseReport.realizedPnl + (brokerUnrealizedPnl ?? baseReport.unrealizedPnl)) / brokerInvested) * 100
          : baseReport.totalReturn,
      }
    : undefined



  const handleRefresh = useCallback(() => {
    mutate(undefined, { revalidate: true })
  }, [mutate])

  const handleExportPdf = () => {
    // Placeholder for PDF export functionality
    console.log('Export PDF clicked')
    // In a full implementation, this would use a library like jsPDF or html2pdf
  }

  if (error) {
    return (
      <TerminalCard
        title="Daily Report"
        icon={<AlertCircle size={16} />}
        accent="red"
        className="mb-6"
      >
        <div className="text-red-400 text-sm">Failed to load report data</div>
      </TerminalCard>
    )
  }

  const displayReport = report || {
    date: new Date().toISOString().split('T')[0],
    openValue: 0,
    closedValue: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
    totalReturn: 0,
    topGainers: [],
    topLosers: [],
    tradesExecuted: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
  }

  const rawDate = displayReport.reportDate ?? displayReport.date ?? new Date().toISOString().split('T')[0]
  const reportDate = rawDate ? new Date(rawDate.slice(0, 10) + 'T00:00:00') : new Date()
  const dateStr = isNaN(reportDate.getTime())
    ? new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
    : reportDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

  const pnlColor = displayReport.totalPnl >= 0 ? 'var(--green)' : 'var(--red)'
  const winRateColor = displayReport.winRate >= 50 ? 'var(--green)' : 'var(--amber)'

  return (
    <TerminalCard
      title="Daily Report"
      icon={<TrendingUp size={16} />}
      action={
        <div className="flex items-center gap-2">
          {isAutoRefreshEnabled && (
            <span className="text-xs text-cyan-400">
              Auto-refresh: 30s
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-gray-700 rounded disabled:opacity-50 transition-colors"
            title="Refresh report"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onSettingsClick}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Report settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={handleExportPdf}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="Export as PDF"
          >
            <Download size={14} />
          </button>
        </div>
      }
      className="mb-6"
    >
      <div className="space-y-6">
        {/* Date Header */}
        <div className="pb-4 border-b border-cyan-900">
          <div className="text-sm text-cyan-400">{dateStr}</div>
          {data?.cached && (
            <div className="text-xs text-amber-400 mt-1">
              Cached report (refreshes at 15:31 IST)
            </div>
          )}
        </div>

        {/* P&L Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-700 p-3 rounded">
            <div className="text-xs text-gray-400 uppercase">Realized P&L</div>
            <div
              className="text-lg font-bold mt-2"
              style={{
                color: displayReport.realizedPnl >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            >
              {formatINR(displayReport.realizedPnl, true)}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 p-3 rounded">
            <div className="text-xs text-gray-400 uppercase">Unrealized P&L</div>
            <div
              className="text-lg font-bold mt-2"
              style={{
                color: displayReport.unrealizedPnl >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            >
              {formatINR(displayReport.unrealizedPnl, true)}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 p-3 rounded">
            <div className="text-xs text-gray-400 uppercase">Total P&L</div>
            <div
              className="text-lg font-bold mt-2"
              style={{ color: pnlColor }}
            >
              {formatINR(displayReport.totalPnl, true)}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 p-3 rounded">
            <div className="text-xs text-gray-400 uppercase">Return</div>
            <div
              className="text-lg font-bold mt-2"
              style={{ color: pnlColor }}
            >
              {formatPct(displayReport.totalReturn)}
            </div>
          </div>
        </div>

        {/* Trade Statistics */}
        <div className="bg-gray-900 border border-gray-700 p-4 rounded">
          <div className="text-xs text-cyan-400 font-bold uppercase mb-3">
            Trade Statistics
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-400">Win Rate</div>
              <div
                className="text-base font-bold mt-1"
                style={{ color: winRateColor }}
              >
                {displayReport.winRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Profit Factor</div>
              <div className="text-base font-bold mt-1" style={{ color: 'var(--green)' }}>
                {isFinite(displayReport.profitFactor)
                  ? displayReport.profitFactor.toFixed(2)
                  : '∞'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Avg Win</div>
              <div className="text-base font-bold mt-1" style={{ color: 'var(--green)' }}>
                {formatINR(displayReport.avgWin, true)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Avg Loss</div>
              <div className="text-base font-bold mt-1" style={{ color: 'var(--red)' }}>
                {formatINR(displayReport.avgLoss, true)}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400">Trades Executed</div>
            <div className="text-base font-bold mt-1" style={{ color: 'var(--cyan)' }}>
              {displayReport.tradesExecuted} trades
            </div>
          </div>
        </div>

        {/* Top Gainers */}
        {displayReport.topGainers && displayReport.topGainers.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 p-4 rounded">
            <div className="text-xs text-green-400 font-bold uppercase mb-3 flex items-center gap-2">
              <TrendingUp size={14} /> Top Gainers
            </div>
            <div className="space-y-2">
              {displayReport.topGainers.map((gainer, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300">{gainer.symbol}</span>
                  <div className="flex gap-3">
                    <span className="text-gray-400 w-12 text-right">{gainer.qty}x</span>
                    <span className="text-green-400 font-bold w-20 text-right">
                      {formatINR(gainer.pnl, true)}
                    </span>
                    <span className="text-green-400 w-16 text-right">
                      +{gainer.return.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Losers */}
        {displayReport.topLosers && displayReport.topLosers.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 p-4 rounded">
            <div className="text-xs text-red-400 font-bold uppercase mb-3 flex items-center gap-2">
              <TrendingDown size={14} /> Top Losers
            </div>
            <div className="space-y-2">
              {displayReport.topLosers.map((loser, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-300">{loser.symbol}</span>
                  <div className="flex gap-3">
                    <span className="text-gray-400 w-12 text-right">{loser.qty}x</span>
                    <span className="text-red-400 font-bold w-20 text-right">
                      {formatINR(loser.pnl, true)}
                    </span>
                    <span className="text-red-400 w-16 text-right">
                      {loser.return.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TerminalCard>
  )
}
