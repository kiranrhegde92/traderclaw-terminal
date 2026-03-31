'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { clsx } from 'clsx'
import {
  Download, ChevronUp, ChevronDown, Plus,
  RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import FundamentalFilter from '@/components/screener/FundamentalFilter'
import { useToast } from '@/components/ui/Toast'
import {
  FundamentalStock, FundamentalFilters, scoreStock,
  getPEColor, getPERange, getROEColor, getROERange,
  getDebtColor, getDebtRange, formatMarketCap,
  isGoodFundamental,
} from '@/lib/screener/fundamental'
import { formatPct, formatCompact } from '@/lib/utils/format'

/* ─── Default Filters ───────────────────────────────────────── */
const DEFAULT_FILTERS: FundamentalFilters = {
  pe_min: 0,
  pe_max: 50,
  pb_min: 0,
  pb_max: 5,
  roe_min: 15,
  roe_max: 50,
  roce_min: 0,
  roce_max: 50,
  debt_min: 0,
  debt_max: 1.5,
  mcap_min: 100,
  mcap_max: 100000,
  div_min: 0,
  div_max: 10,
  eps_growth_min: -50,
  eps_growth_max: 50,
}

/* ─── Types ────────────────────────────────────────────────── */
type SortKey = keyof FundamentalStock
type SortDir = 'asc' | 'desc'

/* ─── Page ─────────────────────────────────────────────────── */
export default function FundamentalScreenerPage() {
  const toast = useToast()

  // State
  const [filters, setFilters] = useState<FundamentalFilters>(DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [watchlistItems, setWatchlistItems] = useState<Set<string>>(new Set())

  // Build query string
  const queryParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    queryParams.append(key, String(value))
  })

  // Fetch data
  const [responseMetadata, setResponseMetadata] = useState<{
    timestamp?: number
    cached?: boolean
    finnhubAvailable?: boolean
  }>({})

  const { data, isLoading, error, mutate } = useSWR(
    `/api/screener/fundamental?${queryParams.toString()}`,
    async (url) => {
      const res = await fetch(url)
      const json = await res.json()
      setResponseMetadata({
        timestamp: json.timestamp,
        cached: json.cached,
        finnhubAvailable: json.finnhubAvailable,
      })
      return json.stocks as FundamentalStock[]
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const stocks = data || []

  // Format timestamp for display
  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Unknown'
    const date = new Date(ts)
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.pe_min > DEFAULT_FILTERS.pe_min || filters.pe_max < DEFAULT_FILTERS.pe_max) count++
    if (filters.pb_min > DEFAULT_FILTERS.pb_min || filters.pb_max < DEFAULT_FILTERS.pb_max) count++
    if (filters.roe_min > DEFAULT_FILTERS.roe_min || filters.roe_max < DEFAULT_FILTERS.roe_max) count++
    if (filters.roce_min > DEFAULT_FILTERS.roce_min || filters.roce_max < DEFAULT_FILTERS.roce_max) count++
    if (filters.debt_min > DEFAULT_FILTERS.debt_min || filters.debt_max < DEFAULT_FILTERS.debt_max) count++
    if (filters.mcap_min > DEFAULT_FILTERS.mcap_min || filters.mcap_max < DEFAULT_FILTERS.mcap_max) count++
    if (filters.div_min > DEFAULT_FILTERS.div_min || filters.div_max < DEFAULT_FILTERS.div_max) count++
    if (filters.eps_growth_min > DEFAULT_FILTERS.eps_growth_min || filters.eps_growth_max < DEFAULT_FILTERS.eps_growth_max) count++
    return count
  }, [filters])

  // Sorted results
  const sortedStocks = useMemo(() => {
    const sorted = [...stocks].sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      // Handle undefined values
      if (aVal === undefined) aVal = 0 as any
      if (bVal === undefined) bVal = 0 as any

      // Sort direction
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
    return sorted
  }, [stocks, sortBy, sortDir])

  // Handlers
  const handleSort = useCallback((key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }, [sortBy, sortDir])

  const handleAddToWatchlist = (symbol: string) => {
    const newSet = new Set(watchlistItems)
    if (newSet.has(symbol)) {
      newSet.delete(symbol)
      toast.info(`${symbol} removed from watchlist`)
    } else {
      newSet.add(symbol)
      toast.success(`${symbol} added to watchlist`)
    }
    setWatchlistItems(newSet)
  }

  const downloadCSV = () => {
    if (stocks.length === 0) {
      toast.warn('No stocks to download')
      return
    }

    const headers = [
      'Symbol', 'Company', 'Price', 'Change%', 'PE', 'PB', 'ROE%', 'ROCE%',
      'Debt/Eq', 'MCap(Cr)', 'Div%', 'EPS', 'EPS Growth%', 'Score'
    ]

    const rows = sortedStocks.map((stock) => [
      stock.symbol,
      stock.company,
      stock.price.toFixed(2),
      stock.changePct.toFixed(2),
      stock.pe?.toFixed(2) ?? '—',
      stock.pb?.toFixed(2) ?? '—',
      stock.roe?.toFixed(2) ?? '—',
      stock.roce?.toFixed(2) ?? '—',
      stock.debtToEquity?.toFixed(2) ?? '—',
      stock.marketCap?.toFixed(0) ?? '—',
      stock.dividendYield?.toFixed(2) ?? '—',
      stock.eps?.toFixed(2) ?? '—',
      stock.epsGrowth?.toFixed(2) ?? '—',
      scoreStock(stock),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fundamental-screener-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Downloaded ${stocks.length} stocks`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Topbar />

      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <TerminalCard title="Fundamental Screener" accent="cyan">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-300">
                  Screen NIFTY 100 stocks by PE, ROE, debt, and other fundamentals.
                </p>
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  <p>
                    {responseMetadata.finnhubAvailable ? (
                      <span className="text-green-400">✓ Live Finnhub Data</span>
                    ) : (
                      <span className="text-amber-400">⊘ Using Demo Data (Finnhub API not configured)</span>
                    )}
                  </p>
                  {responseMetadata.cached && (
                    <p className="text-amber-300">📦 Cached data (updated {formatTimestamp(responseMetadata.timestamp)})</p>
                  )}
                  {!responseMetadata.cached && responseMetadata.timestamp && (
                    <p>🔄 Updated at {formatTimestamp(responseMetadata.timestamp)}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => mutate()}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-gray-600 text-sm hover:border-cyan-500 hover:bg-cyan-500/10 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={isLoading || stocks.length === 0}
                  className="flex items-center gap-2 px-3 py-2 rounded border border-gray-600 text-sm hover:border-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  title="Download as CSV"
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>
          </TerminalCard>

          {/* Filters */}
          <FundamentalFilter
            filters={filters}
            onChange={setFilters}
            activeCount={activeFilterCount}
            isLoading={isLoading}
          />

          {/* Results Card */}
          <TerminalCard
            title="Results"
            accent="green"
            action={
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">
                  {stocks.length} stocks
                </span>
                {isLoading && <Spinner />}
              </div>
            }
            noPadding
          >
            {isLoading && (
              <div className="p-8 text-center text-gray-500">
                <Spinner />
                <p className="mt-3 text-sm">Loading fundamentals...</p>
              </div>
            )}

            {!isLoading && stocks.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No stocks match your criteria.</p>
                <p className="text-xs mt-2">Try adjusting your filters.</p>
              </div>
            )}

            {!isLoading && stocks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        { label: 'Symbol', key: 'symbol' as SortKey, w: 'w-20' },
                        { label: 'Company', key: 'company' as SortKey, w: 'w-32' },
                        { label: 'Price', key: 'price' as SortKey, w: 'w-20' },
                        { label: 'Change%', key: 'changePct' as SortKey, w: 'w-20' },
                        { label: 'PE', key: 'pe' as SortKey, w: 'w-16' },
                        { label: 'PB', key: 'pb' as SortKey, w: 'w-16' },
                        { label: 'ROE%', key: 'roe' as SortKey, w: 'w-16' },
                        { label: 'ROCE%', key: 'roce' as SortKey, w: 'w-16' },
                        { label: 'Debt/Eq', key: 'debtToEquity' as SortKey, w: 'w-16' },
                        { label: 'MCap(Cr)', key: 'marketCap' as SortKey, w: 'w-24' },
                        { label: 'Div%', key: 'dividendYield' as SortKey, w: 'w-16' },
                        { label: '', key: 'symbol' as SortKey, w: 'w-12' },
                      ].map(({ label, key, w }) => (
                        <th
                          key={key}
                          className={clsx(
                            'px-3 py-2 text-left text-xs font-mono text-gray-500 cursor-pointer hover:text-gray-300 transition-colors',
                            w
                          )}
                          onClick={() => handleSort(key)}
                        >
                          <div className="flex items-center gap-1">
                            {label}
                            {sortBy === key && (
                              sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStocks.map((stock) => (
                      <tr
                        key={stock.symbol}
                        className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors group"
                      >
                        {/* Symbol */}
                        <td className="px-3 py-2 font-mono text-green-400 font-semibold">
                          {stock.symbol}
                        </td>

                        {/* Company */}
                        <td className="px-3 py-2 text-xs text-gray-400 truncate">
                          {stock.company}
                        </td>

                        {/* Price */}
                        <td className="px-3 py-2 text-sm">
                          ₹{stock.price.toFixed(2)}
                        </td>

                        {/* Change% */}
                        <td className="px-3 py-2 text-sm">
                          <span
                            className={clsx(
                              'font-semibold',
                              stock.changePct >= 0 ? 'text-green-400' : 'text-red-400'
                            )}
                          >
                            <span className="inline-block mr-1">
                              {stock.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            </span>
                            {formatPct(stock.changePct)}
                          </span>
                        </td>

                        {/* PE */}
                        <td className="px-3 py-2 text-sm" style={{ color: getPEColor(stock.pe) }}>
                          {stock.pe?.toFixed(1) ?? '—'}
                        </td>

                        {/* PB */}
                        <td className="px-3 py-2 text-sm text-gray-300">
                          {stock.pb?.toFixed(2) ?? '—'}
                        </td>

                        {/* ROE */}
                        <td className="px-3 py-2 text-sm" style={{ color: getROEColor(stock.roe) }}>
                          {stock.roe?.toFixed(1) ?? '—'}%
                        </td>

                        {/* ROCE */}
                        <td className="px-3 py-2 text-sm text-gray-300">
                          {stock.roce?.toFixed(1) ?? '—'}%
                        </td>

                        {/* Debt/Eq */}
                        <td className="px-3 py-2 text-sm" style={{ color: getDebtColor(stock.debtToEquity) }}>
                          {stock.debtToEquity?.toFixed(2) ?? '—'}
                        </td>

                        {/* MCap */}
                        <td className="px-3 py-2 text-sm text-gray-300">
                          {formatMarketCap(stock.marketCap)}
                        </td>

                        {/* Div% */}
                        <td className="px-3 py-2 text-sm text-gray-300">
                          {stock.dividendYield?.toFixed(2) ?? '—'}%
                        </td>

                        {/* Action */}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleAddToWatchlist(stock.symbol)}
                            className={clsx(
                              'p-1 rounded transition-colors',
                              watchlistItems.has(stock.symbol)
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'text-gray-500 hover:bg-gray-800 hover:text-cyan-400 opacity-0 group-hover:opacity-100'
                            )}
                            title={watchlistItems.has(stock.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                          >
                            <Plus size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TerminalCard>
        </div>
      </main>
    </div>
  )
}
