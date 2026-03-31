'use client'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import CandlestickChart from '@/components/charts/CandlestickChart'
import Spinner from '@/components/ui/Spinner'
import { formatPct, formatCompact } from '@/lib/utils/format'
import {
  BarChart2, Play, TrendingUp, TrendingDown, Download,
  RefreshCw, ChevronUp, ChevronDown, ExternalLink, Zap,
  Save, BookOpen, Bell, Settings, X, Plus, Check,
} from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

/* ─── Constants ─────────────────────────────────────────────────────── */

const INTERVALS = [
  { value: '5m',  label: '5M'  },
  { value: '15m', label: '15M' },
  { value: '60m', label: '1H'  },
  { value: '1d',  label: '1D'  },
  { value: '1wk', label: '1W'  },
]

const UNIVERSES = [
  { value: 'nifty50',  label: 'Nifty 50'  },
  { value: 'nifty100', label: 'Nifty 100' },
  { value: 'fo',       label: 'F&O Stocks' },
]

const PATTERNS = [
  { value: 'bullishengulfingpattern', label: 'Bullish Engulfing', type: 'bullish' },
  { value: 'bearishengulfingpattern', label: 'Bearish Engulfing', type: 'bearish' },
  { value: 'morningstar',             label: 'Morning Star',      type: 'bullish' },
  { value: 'eveningstar',             label: 'Evening Star',      type: 'bearish' },
  { value: 'hammer',                  label: 'Hammer',            type: 'bullish' },
  { value: 'shootingstar',            label: 'Shooting Star',     type: 'bearish' },
  { value: 'doji',                    label: 'Doji',              type: 'neutral' },
  { value: 'threewhitesoldiers',      label: '3 White Soldiers',  type: 'bullish' },
  { value: 'threeblackcrows',         label: '3 Black Crows',     type: 'bearish' },
  { value: 'piercingline',            label: 'Piercing Line',     type: 'bullish' },
  { value: 'darkcloudcover',          label: 'Dark Cloud Cover',  type: 'bearish' },
]

/* ── Preset scans ── */
const PRESETS = [
  {
    label: '🚀 Momentum',
    desc:  'MACD bullish, above EMA20, strong trend',
    filters: { macdBullish: true, aboveEMA20: true, adxMin: '25' },
  },
  {
    label: '📉 Oversold Bounce',
    desc:  'RSI < 35, near 52w low — potential reversal',
    filters: { rsiMax: '35', near52wLow: true },
  },
  {
    label: '🎯 Breakout',
    desc:  'Near 52w high with volume spike',
    filters: { near52wHigh: true, volumeSpike: true },
  },
  {
    label: '⚡ Golden Cross',
    desc:  'EMA50 crossed above EMA200',
    filters: { goldenCross: true, aboveEMA200: true },
  },
  {
    label: '🔻 Death Cross',
    desc:  'EMA50 below EMA200, bearish trend',
    filters: { deathCross: true, macdBearish: true },
  },
  {
    label: '💥 Volume Spike',
    desc:  'Volume > 2× 20-day average',
    filters: { volumeSpike: true },
  },
  {
    label: '📊 BB Squeeze',
    desc:  'Bollinger Band squeeze — volatility building',
    filters: { bbSqueeze: true },
  },
  {
    label: '💎 Quality Trend',
    desc:  'Above all MAs, strong trend, RSI healthy',
    filters: { aboveEMA20: true, aboveEMA50: true, aboveEMA200: true, rsiMin: '50', rsiMax: '70', adxMin: '20' },
  },
]

const DEFAULT_FILTERS = {
  universe:       'nifty50' as string,
  interval:       '1d',
  priceMin:       '',
  priceMax:       '',
  rsiMin:         '',
  rsiMax:         '',
  macdBullish:    false,
  macdBearish:    false,
  aboveEMA20:     false,
  aboveEMA50:     false,
  aboveEMA200:    false,
  goldenCross:    false,
  deathCross:     false,
  aboveVWAP:      false,
  bbSqueeze:      false,
  bbBreakout:     false,
  volumeSpike:    false,
  adxMin:         '',
  stochOversold:  false,
  stochOverbought: false,
  near52wHigh:    false,
  near52wLow:     false,
  patterns:       [] as string[],
}

type Filters = typeof DEFAULT_FILTERS

/* ── Column definitions ── */
const ALL_COLUMNS = [
  { key: 'symbol',     label: 'Symbol',   required: true  },
  { key: 'signal',     label: 'Signal',   required: true  },
  { key: 'ltp',        label: 'Price',    required: true  },
  { key: 'changePct',  label: 'Change%',  required: true  },
  { key: 'rsi',        label: 'RSI',      required: false },
  { key: 'macd',       label: 'MACD',     required: false },
  { key: 'volume',     label: 'Volume',   required: false },
  { key: 'ema20',      label: 'EMA20',    required: false },
  { key: 'ema50',      label: 'EMA50',    required: false },
  { key: 'adx',        label: 'ADX',      required: false },
  { key: 'volRatio',   label: 'Vol×',     required: false },
  { key: 'pct52wH',    label: '52wH%',    required: false },
  { key: 'patterns',   label: 'Patterns', required: false },
  { key: 'actions',    label: 'Actions',  required: true  },
]

const DEFAULT_VISIBLE_COLS = ['symbol','signal','ltp','changePct','rsi','macd','volume','adx','volRatio','pct52wH','patterns','actions']

const fetcher = (url: string) => fetch(url).then(r => r.json())

/* ══════════════════════════════════════════════════════════════════════ */

export default function ScreenerPage() {
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS)
  const [results,    setResults]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [scanInfo,   setScanInfo]   = useState<{ total: number; ms: number } | null>(null)
  const [selected,   setSelected]   = useState<any>(null)
  const [chartOpen,  setChartOpen]  = useState(false)
  const [sortKey,    setSortKey]    = useState<string>('changePct')
  const [sortDir,    setSortDir]    = useState<1|-1>(-1)

  /* ── Feature 1: Save Scans ── */
  const [saveName,      setSaveName]      = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [showSavedList, setShowSavedList] = useState(false)
  const { data: scansData, mutate: mutateScans } = useSWR('/api/screener/scans', fetcher)
  const savedScans = scansData?.data ?? []

  const toast = useToast()

  /* ── Feature 2: Alert on Scan Match ── */
  const prevResultsRef = useRef<string[]>([])
  const [alertOnEntry, setAlertOnEntry] = useState(false)

  // Per-scan alert polling: track previous symbols per scan id
  const scanAlertPrevRef = useRef<Record<number, string[]>>({})

  useEffect(() => {
    const interval = setInterval(async () => {
      const alertScans = savedScans.filter((s: any) => s.alert_enabled)
      if (alertScans.length === 0) return
      for (const scan of alertScans) {
        try {
          const config = JSON.parse(scan.config_json)
          const cf = config.customFilters ?? {}
          const body: any = {
            universe: cf.universe ?? config.universe ?? 'nifty50',
            interval: cf.interval ?? config.interval ?? '1d',
          }
          if (cf.priceMin)        body.priceMin        = +cf.priceMin
          if (cf.priceMax)        body.priceMax        = +cf.priceMax
          if (cf.rsiMin)          body.rsiMin          = +cf.rsiMin
          if (cf.rsiMax)          body.rsiMax          = +cf.rsiMax
          if (cf.macdBullish)     body.macdBullish     = true
          if (cf.macdBearish)     body.macdBearish     = true
          if (cf.aboveEMA20)      body.aboveEMA20      = true
          if (cf.aboveEMA50)      body.aboveEMA50      = true
          if (cf.aboveEMA200)     body.aboveEMA200     = true
          if (cf.goldenCross)     body.goldenCross     = true
          if (cf.deathCross)      body.deathCross      = true
          if (cf.aboveVWAP)       body.aboveVWAP       = true
          if (cf.bbSqueeze)       body.bbSqueeze       = true
          if (cf.bbBreakout)      body.bbBreakout      = true
          if (cf.volumeSpike)     body.volumeSpike     = true
          if (cf.adxMin)          body.adxMin          = +cf.adxMin
          if (cf.stochOversold)   body.stochOversold   = true
          if (cf.stochOverbought) body.stochOverbought = true
          if (cf.near52wHigh)     body.near52wHigh     = true
          if (cf.near52wLow)      body.near52wLow      = true
          if (cf.patterns?.length) body.patterns       = cf.patterns

          const res = await fetch('/api/screener/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) continue
          const json = await res.json()
          const newSymbols: string[] = (json.data ?? []).map((r: any) => r.symbol)
          const prev = scanAlertPrevRef.current[scan.id]
          if (prev !== undefined) {
            const newEntries = newSymbols.filter(sym => !prev.includes(sym))
            for (const sym of newEntries) {
              toast.warn(`⚡ ${sym} newly entered ${scan.name}`)
            }
          }
          scanAlertPrevRef.current[scan.id] = newSymbols
        } catch { /* ignore per-scan errors */ }
      }
    }, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedScans])

  /* ── Feature 3: Column Customization ── */
  const [visibleCols,    setVisibleCols]    = useState<string[]>(DEFAULT_VISIBLE_COLS)
  const [showColPicker,  setShowColPicker]  = useState(false)
  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('screener-columns')
      if (stored) setVisibleCols(JSON.parse(stored))
    } catch {}
  }, [])
  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      try { localStorage.setItem('screener-columns', JSON.stringify(next)) } catch {}
      return next
    })
  }

  /* ── Feature 4: Bulk Add to Watchlist ── */
  const [selectedRows,    setSelectedRows]    = useState<Set<string>>(new Set())
  const [showWLModal,     setShowWLModal]      = useState(false)
  const [wlModalLoading,  setWlModalLoading]  = useState(false)
  const [wlAddDone,       setWlAddDone]        = useState(false)
  const { data: wlData } = useSWR('/api/monitor/watchlist', fetcher)
  const watchlists = wlData?.data ? [wlData.data] : []  // current API returns single watchlist

  function toggleRowSelect(symbol: string) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
  }
  function selectAll() {
    if (selectedRows.size === sorted.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(sorted.map(r => r.symbol)))
  }
  async function addToWatchlist(watchlistId = 1) {
    setWlModalLoading(true)
    try {
      await fetch('/api/watchlist/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: Array.from(selectedRows), watchlistId }),
      })
    } catch { /* fallback: silent fail */ }
    setWlModalLoading(false)
    setWlAddDone(true)
    setTimeout(() => { setShowWLModal(false); setWlAddDone(false); setSelectedRows(new Set()) }, 1200)
  }

  /* ── sort ── */
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      return sortDir * (va - vb)
    })
  }, [results, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(key); setSortDir(-1) }
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}>↕</span>
    return sortDir === -1 ? <ChevronDown size={10} className="inline"/> : <ChevronUp size={10} className="inline"/>
  }

  /* ── helpers ── */
  function setF(key: keyof Filters, val: any) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function togglePattern(p: string) {
    setFilters(f => ({
      ...f,
      patterns: f.patterns.includes(p) ? f.patterns.filter(x => x !== p) : [...f.patterns, p],
    }))
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    setFilters({ ...DEFAULT_FILTERS, universe: filters.universe, interval: filters.interval, ...preset.filters })
  }

  /* ── Feature 1: Save/Load Scans ── */
  async function saveScan() {
    if (!saveName.trim()) return
    const config = {
      universe: filters.universe,
      interval: filters.interval,
      customFilters: { ...filters },
    }
    await fetch('/api/screener/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: saveName.trim(), config }),
    })
    setSaveName('')
    setShowSaveInput(false)
    mutateScans()
  }

  function loadScan(scan: any) {
    try {
      const config = JSON.parse(scan.config_json)
      if (config.customFilters) {
        setFilters({ ...DEFAULT_FILTERS, ...config.customFilters })
      } else {
        setFilters({
          ...DEFAULT_FILTERS,
          universe: config.universe ?? filters.universe,
          interval: config.interval ?? filters.interval,
        })
      }
      setShowSavedList(false)
    } catch {}
  }

  async function deleteScan(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/screener/scans?id=${id}`, { method: 'DELETE' })
    mutateScans()
  }

  async function toggleScanAlert(id: number, current: boolean, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch('/api/screener/scans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, alert_enabled: !current }),
    })
    mutateScans()
  }

  /* ── run scan ── */
  async function runScan() {
    setLoading(true)
    setError('')
    setResults([])
    setScanInfo(null)
    setSelectedRows(new Set())
    const t0 = Date.now()
    try {
      const body: any = {
        universe: filters.universe,
        interval: filters.interval,
      }
      if (filters.priceMin)      body.priceMin       = +filters.priceMin
      if (filters.priceMax)      body.priceMax       = +filters.priceMax
      if (filters.rsiMin)        body.rsiMin         = +filters.rsiMin
      if (filters.rsiMax)        body.rsiMax         = +filters.rsiMax
      if (filters.macdBullish)   body.macdBullish    = true
      if (filters.macdBearish)   body.macdBearish    = true
      if (filters.aboveEMA20)    body.aboveEMA20     = true
      if (filters.aboveEMA50)    body.aboveEMA50     = true
      if (filters.aboveEMA200)   body.aboveEMA200    = true
      if (filters.goldenCross)   body.goldenCross    = true
      if (filters.deathCross)    body.deathCross     = true
      if (filters.aboveVWAP)     body.aboveVWAP      = true
      if (filters.bbSqueeze)     body.bbSqueeze      = true
      if (filters.bbBreakout)    body.bbBreakout     = true
      if (filters.volumeSpike)   body.volumeSpike    = true
      if (filters.adxMin)        body.adxMin         = +filters.adxMin
      if (filters.stochOversold) body.stochOversold  = true
      if (filters.stochOverbought) body.stochOverbought = true
      if (filters.near52wHigh)   body.near52wHigh    = true
      if (filters.near52wLow)    body.near52wLow     = true
      if (filters.patterns.length) body.patterns     = filters.patterns

      const res  = await fetch('/api/screener/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const newResults = json.data ?? []
      setResults(newResults)
      setScanInfo({ total: json.total ?? 0, ms: Date.now() - t0 })

      /* ── Feature 2: Alert on Entry ── */
      if (alertOnEntry) {
        const prevSymbols = prevResultsRef.current
        const newSymbols = newResults.map((r: any) => r.symbol)
        const newEntries = newResults.filter((r: any) => !prevSymbols.includes(r.symbol))
        for (const r of newEntries) {
          const patternLabel = r.patterns?.[0]?.label ?? r.signals ? Object.keys(r.signals ?? {}).find(k => r.signals[k]) ?? 'scan match' : 'scan match'
          await fetch('/api/console-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level: 'signal',
              source: 'screener',
              message: `New scan match: ${r.symbol} (${patternLabel})`,
              metadata: { symbol: r.symbol, ltp: r.ltp, changePct: r.changePct },
            }),
          }).catch(() => {})
        }
        prevResultsRef.current = newSymbols
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Feature 2: Create alert for a result row ── */
  async function createRowAlert(r: any) {
    const alertType = r.changePct >= 0 ? 'PRICE_ABOVE' : 'PRICE_BELOW'
    await fetch('/api/monitor/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: r.symbol,
        alertType,
        condition: { value: r.ltp },
      }),
    })
  }

  /* ── export CSV ── */
  function exportCSV() {
    const cols = ['symbol','ltp','changePct','rsi','macd','ema20','ema50','adx','volume','volRatio','pct52wH']
    const rows = [cols.join(','), ...sorted.map(r =>
      cols.map(c => r[c] != null ? (typeof r[c] === 'number' ? r[c].toFixed(2) : r[c]) : '').join(',')
    )]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'screener.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  /* ── active filter count ── */
  const activeCount = [
    filters.priceMin, filters.priceMax, filters.rsiMin, filters.rsiMax,
    filters.macdBullish, filters.macdBearish, filters.aboveEMA20, filters.aboveEMA50,
    filters.aboveEMA200, filters.goldenCross, filters.deathCross, filters.aboveVWAP,
    filters.bbSqueeze, filters.bbBreakout, filters.volumeSpike, filters.adxMin,
    filters.stochOversold, filters.stochOverbought, filters.near52wHigh, filters.near52wLow,
    ...filters.patterns,
  ].filter(Boolean).length

  const showCol = (key: string) => visibleCols.includes(key)

  /* ══════════════════════════════════════════════════════════════════════ */

  return (
    <>
      <Topbar title="Stock Screener" />
      <div className="page-content space-y-4">

        {/* ── Preset Scans + Save/Load ── */}
        <TerminalCard title="Preset Scans" icon={<Zap size={12}/>} accent="amber" noPadding>
          <div className="flex flex-wrap gap-2 p-3 items-center">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} title={p.desc}
                className="btn btn-sm btn-ghost hover:btn-amber">
                {p.label}
              </button>
            ))}
            <div className="ml-auto flex gap-2 items-center flex-wrap">

              {/* Saved Scans dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowSavedList(v => !v); setShowSaveInput(false) }}
                  className="btn btn-sm btn-ghost"
                  title="Load saved scan">
                  <BookOpen size={10}/> Saved ({savedScans.length})
                </button>
                {showSavedList && savedScans.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    {savedScans.map((s: any) => (
                      <div key={s.id}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 text-xs"
                        onClick={() => loadScan(s)}>
                        <span style={{ color: 'var(--cyan)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => toggleScanAlert(s.id, !!s.alert_enabled, e)}
                            title={s.alert_enabled ? 'Disable scan alert' : 'Enable scan alert (60s poll)'}
                            style={{ color: s.alert_enabled ? 'var(--amber)' : 'var(--text-muted)' }}
                            className="hover:opacity-80">
                            <Bell size={10}/>
                          </button>
                          <button onClick={e => deleteScan(s.id, e)} style={{ color: 'var(--red)' }} className="hover:opacity-80">
                            <X size={10}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showSavedList && savedScans.length === 0 && (
                  <div className="absolute right-0 top-full mt-1 z-50 px-3 py-2 text-xs rounded border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    No saved scans
                  </div>
                )}
              </div>

              {/* Save Scan */}
              {showSaveInput ? (
                <div className="flex gap-1 items-center">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Scan name..."
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveScan()}
                    className="term-input text-xs"
                    style={{ width: 130, padding: '3px 8px' }}/>
                  <button onClick={saveScan} className="btn btn-sm btn-green" disabled={!saveName.trim()}>
                    <Check size={10}/>
                  </button>
                  <button onClick={() => { setShowSaveInput(false); setSaveName('') }} className="btn btn-sm btn-ghost">
                    <X size={10}/>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setShowSaveInput(true); setShowSavedList(false) }}
                  className="btn btn-sm btn-ghost">
                  <Save size={10}/> Save Scan
                </button>
              )}

              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="btn btn-sm btn-ghost">
                <RefreshCw size={10}/> Reset
              </button>
            </div>
          </div>
        </TerminalCard>

        <div className="grid grid-cols-12 gap-4">

          {/* ── Filter Panel ── */}
          <div className="col-span-12 lg:col-span-3 space-y-3">

            {/* Universe + Interval */}
            <TerminalCard title={`Filters${activeCount ? ` (${activeCount} active)` : ''}`} icon={<BarChart2 size={12}/>} accent="green">
              <div className="space-y-4">

                <div>
                  <Label>Universe</Label>
                  <div className="flex flex-wrap gap-1">
                    {UNIVERSES.map(u => (
                      <button key={u.value} onClick={() => setF('universe', u.value)}
                        className={`btn btn-sm ${filters.universe === u.value ? 'btn-green' : 'btn-ghost'}`}>
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Timeframe</Label>
                  <div className="flex flex-wrap gap-1">
                    {INTERVALS.map(iv => (
                      <button key={iv.value} onClick={() => setF('interval', iv.value)}
                        className={`btn btn-sm ${filters.interval === iv.value ? 'btn-green' : 'btn-ghost'}`}>
                        {iv.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <Label>Price Range (₹)</Label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Min" value={filters.priceMin}
                      onChange={e => setF('priceMin', e.target.value)}
                      className="term-input flex-1" min={0}/>
                    <input type="number" placeholder="Max" value={filters.priceMax}
                      onChange={e => setF('priceMax', e.target.value)}
                      className="term-input flex-1" min={0}/>
                  </div>
                </div>

                {/* RSI */}
                <div>
                  <Label>RSI Range</Label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Min (0)" value={filters.rsiMin}
                      onChange={e => setF('rsiMin', e.target.value)}
                      className="term-input flex-1" min={0} max={100}/>
                    <input type="number" placeholder="Max (100)" value={filters.rsiMax}
                      onChange={e => setF('rsiMax', e.target.value)}
                      className="term-input flex-1" min={0} max={100}/>
                  </div>
                </div>

                {/* ADX */}
                <div>
                  <Label>ADX ≥ (Trend Strength)</Label>
                  <input type="number" placeholder="e.g. 25" value={filters.adxMin}
                    onChange={e => setF('adxMin', e.target.value)}
                    className="term-input w-full" min={0} max={100}/>
                </div>

                {/* Moving Averages */}
                <div>
                  <Label>Moving Averages</Label>
                  <div className="space-y-1">
                    {[
                      { key: 'aboveEMA20',  label: 'Above EMA 20'  },
                      { key: 'aboveEMA50',  label: 'Above EMA 50'  },
                      { key: 'aboveEMA200', label: 'Above EMA 200' },
                      { key: 'goldenCross', label: 'Golden Cross (EMA50 > 200)' },
                      { key: 'deathCross',  label: 'Death Cross (EMA50 < 200)'  },
                    ].map(f => <CheckRow key={f.key} f={f} filters={filters} setF={setF}/>)}
                  </div>
                </div>

                {/* MACD */}
                <div>
                  <Label>MACD</Label>
                  <div className="space-y-1">
                    {[
                      { key: 'macdBullish', label: 'Bullish Crossover' },
                      { key: 'macdBearish', label: 'Bearish Crossover' },
                    ].map(f => <CheckRow key={f.key} f={f} filters={filters} setF={setF}/>)}
                  </div>
                </div>

                {/* Other signals */}
                <div>
                  <Label>Other Signals</Label>
                  <div className="space-y-1">
                    {[
                      { key: 'aboveVWAP',      label: 'Above VWAP'         },
                      { key: 'bbSqueeze',      label: 'BB Squeeze'          },
                      { key: 'bbBreakout',     label: 'BB Breakout (above upper)' },
                      { key: 'volumeSpike',    label: 'Volume Spike (2× avg)' },
                      { key: 'stochOversold',  label: 'Stoch Oversold (<20)' },
                      { key: 'stochOverbought',label: 'Stoch Overbought (>80)' },
                      { key: 'near52wHigh',    label: 'Near 52W High (5%)' },
                      { key: 'near52wLow',     label: 'Near 52W Low (5%)'  },
                    ].map(f => <CheckRow key={f.key} f={f} filters={filters} setF={setF}/>)}
                  </div>
                </div>

                {/* Patterns */}
                <div>
                  <Label>Candlestick Patterns</Label>
                  <div className="flex flex-wrap gap-1">
                    {PATTERNS.map(p => (
                      <button key={p.value} onClick={() => togglePattern(p.value)}
                        className={`btn btn-sm ${filters.patterns.includes(p.value)
                          ? (p.type === 'bullish' ? 'btn-green' : p.type === 'bearish' ? 'btn-red' : 'btn-amber')
                          : 'btn-ghost'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alert on Entry toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded"
                  style={{ background: 'rgba(255,183,0,0.05)', border: '1px solid rgba(255,183,0,0.15)' }}>
                  <input type="checkbox" checked={alertOnEntry}
                    onChange={e => setAlertOnEntry(e.target.checked)}
                    style={{ accentColor: 'var(--amber)', width: 13, height: 13 }}/>
                  <span className="text-xs" style={{ color: 'var(--amber)' }}>Alert on new entry</span>
                </label>

                <button onClick={runScan} disabled={loading} className="btn btn-green w-full">
                  {loading ? <Spinner size={13}/> : <Play size={13}/>}
                  {loading ? 'Scanning…' : 'Run Scan'}
                </button>

              </div>
            </TerminalCard>
          </div>

          {/* ── Results Panel ── */}
          <div className="col-span-12 lg:col-span-9">
            <TerminalCard
              title={results.length
                ? `Results — ${results.length} matches from ${scanInfo?.total ?? '?'} stocks (${((scanInfo?.ms ?? 0)/1000).toFixed(1)}s)`
                : 'Results'}
              icon={<BarChart2 size={12}/>}
              accent="cyan"
              noPadding
              action={results.length > 0 ? (
                <div className="flex gap-2 items-center">
                  {/* Column picker */}
                  <div className="relative">
                    <button onClick={() => setShowColPicker(v => !v)} className="btn btn-sm btn-ghost">
                      <Settings size={10}/> Columns
                    </button>
                    {showColPicker && (
                      <div className="absolute right-0 top-full mt-1 z-50 p-2 rounded border"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 160 }}>
                        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Toggle columns</div>
                        {ALL_COLUMNS.map(col => (
                          <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox"
                              checked={visibleCols.includes(col.key)}
                              disabled={col.required}
                              onChange={() => !col.required && toggleCol(col.key)}
                              style={{ accentColor: 'var(--cyan)', width: 12, height: 12 }}/>
                            <span className="text-xs" style={{ color: col.required ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                              {col.label}{col.required ? ' *' : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={exportCSV} className="btn btn-sm btn-ghost">
                    <Download size={10}/> CSV
                  </button>
                </div>
              ) : undefined}>

              {/* Bulk action bar */}
              {selectedRows.size > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 border-b text-xs"
                  style={{ borderColor: 'var(--border)', background: 'rgba(0,212,255,0.05)' }}>
                  <span style={{ color: 'var(--cyan)' }}>{selectedRows.size} selected</span>
                  <button onClick={() => setShowWLModal(true)} className="btn btn-sm btn-cyan">
                    <Plus size={10}/> Add {selectedRows.size} to Watchlist
                  </button>
                  <button onClick={() => setSelectedRows(new Set())} className="btn btn-sm btn-ghost ml-auto">
                    <X size={10}/> Clear
                  </button>
                </div>
              )}

              {/* Empty / loading state */}
              {results.length === 0 && !loading && !error && (
                <div className="py-16 text-center space-y-3">
                  <BarChart2 size={36} style={{ margin: '0 auto', opacity: 0.2 }}/>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Choose a preset or set filters, then click <strong>Run Scan</strong>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                    Scans Nifty50 by default · Yahoo Finance data · ~30s for full scan
                  </div>
                </div>
              )}

              {loading && (
                <div className="py-16 text-center space-y-3">
                  <Spinner size={28}/>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Scanning stocks… fetching indicators…
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 text-center" style={{ color: 'var(--red)' }}>
                  ⚠ {error}
                  <button onClick={runScan} className="btn btn-sm btn-ghost ml-3">Retry</button>
                </div>
              )}

              {/* Results table */}
              {results.length > 0 && (
                <div className="overflow-auto">
                  <table className="term-table text-xs">
                    <thead>
                      <tr>
                        {/* Checkbox column */}
                        <th style={{ width: 30, padding: '4px 8px' }}>
                          <input type="checkbox"
                            checked={selectedRows.size === sorted.length && sorted.length > 0}
                            onChange={selectAll}
                            style={{ accentColor: 'var(--cyan)', width: 12, height: 12 }}/>
                        </th>
                        {showCol('symbol') && <th className="col-left">Symbol</th>}
                        {showCol('ltp') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('ltp')}>
                            LTP <SortIcon k="ltp"/>
                          </th>
                        )}
                        {showCol('changePct') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('changePct')}>
                            Chg% <SortIcon k="changePct"/>
                          </th>
                        )}
                        {showCol('rsi') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('rsi')}>
                            RSI <SortIcon k="rsi"/>
                          </th>
                        )}
                        {showCol('adx') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('adx')}>
                            ADX <SortIcon k="adx"/>
                          </th>
                        )}
                        {showCol('volRatio') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('volRatio')}>
                            Vol× <SortIcon k="volRatio"/>
                          </th>
                        )}
                        {showCol('pct52wH') && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('pct52wH')}>
                            52wH% <SortIcon k="pct52wH"/>
                          </th>
                        )}
                        {showCol('ema20') && <th className="col-right">EMA20</th>}
                        {showCol('ema50') && <th className="col-right">EMA50</th>}
                        {showCol('macd') && <th className="col-right">MACD</th>}
                        {showCol('volume') && <th className="col-right">Volume</th>}
                        {showCol('signal') && <th>Signals</th>}
                        {showCol('patterns') && <th>Patterns</th>}
                        {showCol('actions') && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(r => (
                        <tr key={r.symbol} style={{
                          background: selectedRows.has(r.symbol) ? 'rgba(0,212,255,0.04)' : undefined,
                        }}>
                          <td style={{ padding: '4px 8px' }}>
                            <input type="checkbox"
                              checked={selectedRows.has(r.symbol)}
                              onChange={() => toggleRowSelect(r.symbol)}
                              style={{ accentColor: 'var(--cyan)', width: 12, height: 12 }}/>
                          </td>
                          {showCol('symbol') && (
                            <td>
                              <div className="font-bold" style={{ color: 'var(--green)' }}>{r.symbol}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                {r.ema20 ? `E20:${r.ema20.toFixed(0)}` : ''} {r.ema50 ? `E50:${r.ema50.toFixed(0)}` : ''}
                              </div>
                            </td>
                          )}
                          {showCol('ltp') && (
                            <td className="col-right font-mono">
                              ₹{r.ltp?.toFixed(r.ltp >= 100 ? 1 : 2)}
                            </td>
                          )}
                          {showCol('changePct') && (
                            <td className="col-right font-mono" style={{ color: r.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {r.changePct >= 0 ? '+' : ''}{r.changePct?.toFixed(2)}%
                            </td>
                          )}
                          {showCol('rsi') && (
                            <td className="col-right font-mono" style={{
                              color: r.rsi < 30 ? 'var(--green)' : r.rsi > 70 ? 'var(--red)' : r.rsi > 55 ? 'var(--amber)' : 'var(--text-dim)'
                            }}>
                              {r.rsi?.toFixed(1)}
                            </td>
                          )}
                          {showCol('adx') && (
                            <td className="col-right font-mono" style={{
                              color: r.adx > 40 ? 'var(--green)' : r.adx > 25 ? 'var(--amber)' : 'var(--text-muted)'
                            }}>
                              {r.adx?.toFixed(0) ?? '—'}
                            </td>
                          )}
                          {showCol('volRatio') && (
                            <td className="col-right font-mono" style={{
                              color: r.volRatio >= 2 ? 'var(--amber)' : 'var(--text-dim)'
                            }}>
                              {r.volRatio?.toFixed(1)}×
                            </td>
                          )}
                          {showCol('pct52wH') && (
                            <td className="col-right font-mono" style={{
                              color: r.pct52wH > -3 ? 'var(--green)' : r.pct52wH > -10 ? 'var(--amber)' : 'var(--text-muted)'
                            }}>
                              {r.pct52wH?.toFixed(1)}%
                            </td>
                          )}
                          {showCol('ema20') && (
                            <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                              {r.ema20 ? `₹${r.ema20.toFixed(1)}` : '—'}
                            </td>
                          )}
                          {showCol('ema50') && (
                            <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                              {r.ema50 ? `₹${r.ema50.toFixed(1)}` : '—'}
                            </td>
                          )}
                          {showCol('macd') && (
                            <td className="col-right font-mono" style={{
                              color: r.macd > 0 ? 'var(--green)' : r.macd < 0 ? 'var(--red)' : 'var(--text-dim)'
                            }}>
                              {r.macd != null ? r.macd.toFixed(2) : '—'}
                            </td>
                          )}
                          {showCol('volume') && (
                            <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                              {r.volume != null ? formatCompact(r.volume) : '—'}
                            </td>
                          )}
                          {showCol('signal') && (
                            <td>
                              <div className="flex flex-wrap gap-0.5">
                                {r.signals?.macdBullish   && <Tag c="green">MACD↑</Tag>}
                                {r.signals?.macdBearish   && <Tag c="red">MACD↓</Tag>}
                                {r.signals?.rsiOversold   && <Tag c="green">OS</Tag>}
                                {r.signals?.rsiOverbought && <Tag c="red">OB</Tag>}
                                {r.signals?.goldenCross   && <Tag c="cyan">GX</Tag>}
                                {r.signals?.deathCross    && <Tag c="red">DX</Tag>}
                                {r.signals?.trendUp       && <Tag c="green">Trend↑</Tag>}
                                {r.signals?.bbSqueeze     && <Tag c="amber">BB⊡</Tag>}
                                {r.signals?.volumeSpike   && <Tag c="amber">Vol↑</Tag>}
                                {r.signals?.nearHighs     && <Tag c="cyan">52H</Tag>}
                                {r.signals?.strongTrend   && <Tag c="green">ADX+</Tag>}
                              </div>
                            </td>
                          )}
                          {showCol('patterns') && (
                            <td>
                              <div className="flex flex-wrap gap-0.5">
                                {r.patterns?.slice(0, 2).map((p: any) => (
                                  <span key={p.name} style={{
                                    fontSize: 9, padding: '1px 4px', borderRadius: 3,
                                    background: p.type === 'bullish' ? 'rgba(0,255,65,0.15)' : p.type === 'bearish' ? 'rgba(255,0,64,0.15)' : 'rgba(255,170,0,0.15)',
                                    color: p.type === 'bullish' ? 'var(--green)' : p.type === 'bearish' ? 'var(--red)' : 'var(--amber)',
                                  }}>
                                    {p.label}
                                  </span>
                                ))}
                              </div>
                            </td>
                          )}
                          {showCol('actions') && (
                            <td>
                              <div className="flex gap-1 flex-wrap">
                                <button onClick={() => { setSelected(r); setChartOpen(true) }}
                                  className="btn btn-sm btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }}>
                                  Chart
                                </button>
                                <button
                                  onClick={() => createRowAlert(r)}
                                  className="btn btn-sm btn-ghost"
                                  style={{ padding: '2px 6px', fontSize: 10, color: 'var(--amber)' }}
                                  title={`Set ${r.changePct >= 0 ? 'PRICE_ABOVE' : 'PRICE_BELOW'} alert at ₹${r.ltp?.toFixed(2)}`}>
                                  🔔
                                </button>
                                <Link href={`/options?symbol=${r.symbol}`}
                                  className="btn btn-sm btn-cyan" style={{ textDecoration: 'none', padding: '2px 6px', fontSize: 10 }}>
                                  Opt
                                </Link>
                                <Link href={`/strategies?underlying=${r.symbol}`}
                                  className="btn btn-sm btn-amber" style={{ textDecoration: 'none', padding: '2px 6px', fontSize: 10 }}>
                                  Strat
                                </Link>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TerminalCard>
          </div>
        </div>

        {/* Chart Modal */}
        <Modal open={chartOpen} onClose={() => setChartOpen(false)}
          title={selected ? `${selected.symbol} — RSI ${selected.rsi?.toFixed(1)} · ADX ${selected.adx?.toFixed(0)}` : ''}
          width="960px">
          {selected && (
            <div>
              {/* Quick stats bar */}
              <div className="flex flex-wrap gap-4 mb-3 text-xs">
                <Stat label="LTP"     value={`₹${selected.ltp?.toFixed(2)}`} />
                <Stat label="Chg"     value={`${selected.changePct >= 0 ? '+' : ''}${selected.changePct?.toFixed(2)}%`}
                  color={selected.changePct >= 0 ? 'var(--green)' : 'var(--red)'} />
                <Stat label="RSI"     value={selected.rsi?.toFixed(1)}
                  color={selected.rsi < 30 ? 'var(--green)' : selected.rsi > 70 ? 'var(--red)' : 'var(--text-dim)'} />
                <Stat label="ADX"     value={selected.adx?.toFixed(0) ?? '—'} />
                <Stat label="EMA20"   value={`₹${selected.ema20?.toFixed(1) ?? '—'}`} />
                <Stat label="EMA50"   value={`₹${selected.ema50?.toFixed(1) ?? '—'}`} />
                <Stat label="Vol×"    value={`${selected.volRatio?.toFixed(1)}×`}
                  color={selected.volRatio >= 2 ? 'var(--amber)' : 'var(--text-dim)'} />
                <Stat label="52wH%"   value={`${selected.pct52wH?.toFixed(1)}%`}
                  color={selected.pct52wH > -5 ? 'var(--green)' : 'var(--text-dim)'} />
              </div>
              <CandlestickChart symbol={selected.symbol} height={420} />
              <div className="flex gap-2 mt-3 flex-wrap">
                <Link href={`/monitor?symbol=${selected.symbol}`} className="btn btn-green btn-sm" style={{ textDecoration:'none' }}>
                  <ExternalLink size={11}/> Monitor
                </Link>
                <Link href={`/options?symbol=${selected.symbol}`} className="btn btn-cyan btn-sm" style={{ textDecoration:'none' }}>
                  Options Chain
                </Link>
                <Link href={`/strategies?underlying=${selected.symbol}`} className="btn btn-amber btn-sm" style={{ textDecoration:'none' }}>
                  Build Strategy
                </Link>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Delivery % Spike Section ── */}
        <DeliverySpikeSection />

        {/* Add to Watchlist Modal */}
        <Modal open={showWLModal} onClose={() => { setShowWLModal(false); setWlAddDone(false) }}
          title="Add to Watchlist" width="400px">
          <div className="space-y-3">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Adding {selectedRows.size} symbol{selectedRows.size !== 1 ? 's' : ''} to watchlist:
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from(selectedRows).map(sym => (
                <span key={sym} className="badge badge-dim">{sym}</span>
              ))}
            </div>
            {wlAddDone ? (
              <div className="text-center py-2 text-sm" style={{ color: 'var(--green)' }}>
                ✓ Added successfully!
              </div>
            ) : (
              <button
                onClick={() => addToWatchlist(1)}
                disabled={wlModalLoading}
                className="btn btn-green w-full">
                {wlModalLoading ? <Spinner size={13}/> : <Plus size={13}/>}
                {wlModalLoading ? 'Adding…' : 'Add to My Watchlist'}
              </button>
            )}
          </div>
        </Modal>
      </div>
    </>
  )
}

/* ─── Delivery % Spike Section ─────────────────────────────────────── */

function DeliverySpikeSection() {
  const { data, isLoading, mutate } = useSWR('/api/market/delivery-spikes', (url: string) => fetch(url).then(r => r.json()), { refreshInterval: 300000 })
  const [sortKey, setSortKey] = useState<'delivPct' | 'spike' | 'volume' | 'changePct'>('delivPct')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [minDelivPct, setMinDelivPct] = useState(50)
  const [collapsed, setCollapsed] = useState(false)

  const rows: any[] = data?.data ?? []

  const filtered = useMemo(() => {
    return [...rows]
      .filter(r => r.delivPct >= minDelivPct)
      .sort((a, b) => sortDir * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)))
  }, [rows, minDelivPct, sortKey, sortDir])

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(k); setSortDir(-1) }
  }

  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}>↕</span>
    return sortDir === -1 ? <ChevronDown size={9} className="inline"/> : <ChevronUp size={9} className="inline"/>
  }

  return (
    <TerminalCard
      title="Delivery % Spike Screener"
      icon={<BarChart2 size={12}/>}
      accent="cyan"
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Min Deliv%:</span>
          <select
            value={minDelivPct}
            onChange={e => setMinDelivPct(+e.target.value)}
            className="term-select"
            style={{ padding: '2px 6px', fontSize: 11 }}
          >
            {[20, 30, 40, 50, 60, 70, 80].map(v => (
              <option key={v} value={v}>{v}%</option>
            ))}
          </select>
          <button onClick={() => mutate()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
            <RefreshCw size={11}/>
          </button>
          <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
            {collapsed ? <ChevronDown size={11}/> : <ChevronUp size={11}/>}
          </button>
        </div>
      }
    >
      {!collapsed && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            High delivery % stocks indicate institutional/retail conviction — delivery &gt; 50% means more participants taking delivery vs intraday trading.
            Delivery spikes (↑ vs previous day) signal accumulation.
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              <Spinner size={16}/> <span className="ml-2">Fetching delivery data...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
              {data?.error ?? 'NSE delivery data unavailable. Try again during market hours.'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              No stocks with delivery ≥ {minDelivPct}% found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="term-table text-xs w-full">
                <thead>
                  <tr>
                    <th className="col-left">Symbol</th>
                    <th className="col-right" style={{ cursor: 'pointer' }} onClick={() => setSortKey('changePct')}>
                      Chg% <SortIcon k="changePct"/>
                    </th>
                    <th className="col-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('volume')}>
                      Volume <SortIcon k="volume"/>
                    </th>
                    <th className="col-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('delivPct')}>
                      Deliv% <SortIcon k="delivPct"/>
                    </th>
                    <th className="col-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('spike')}>
                      Spike <SortIcon k="spike"/>
                    </th>
                    <th className="col-right">Deliv Bar</th>
                    <th className="col-left">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 30).map((r, i) => {
                    const up      = r.changePct >= 0
                    const highDel = r.delivPct >= 70
                    const spiking = r.spike > 10
                    let signal = ''
                    let sigColor = 'var(--text-muted)'
                    if (up && spiking)      { signal = '▲ Accumulation'; sigColor = 'var(--green)' }
                    else if (!up && spiking) { signal = '▼ Distribution'; sigColor = 'var(--red)' }
                    else if (highDel && up)  { signal = '● Strong Buy';   sigColor = 'var(--cyan)' }
                    else if (highDel && !up) { signal = '● Supply';       sigColor = 'var(--amber)' }
                    else                     { signal = '— Neutral';       sigColor = 'var(--text-dim)' }

                    return (
                      <tr key={r.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : undefined }}>
                        <td>
                          <Link href={`/monitor?symbol=${r.symbol}`}
                            style={{ color: 'var(--cyan)', textDecoration: 'none', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                            {r.symbol}
                          </Link>
                        </td>
                        <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
                        </td>
                        <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                          {formatCompact(r.volume)}
                        </td>
                        <td className="col-right font-mono font-bold" style={{
                          color: r.delivPct >= 70 ? 'var(--green)' : r.delivPct >= 50 ? 'var(--cyan)' : 'var(--text-dim)'
                        }}>
                          {r.delivPct.toFixed(1)}%
                        </td>
                        <td className="col-right font-mono" style={{ color: r.spike > 0 ? 'var(--green)' : r.spike < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                          {r.spike !== 0 ? `${r.spike >= 0 ? '+' : ''}${r.spike.toFixed(1)}%` : '—'}
                        </td>
                        <td className="col-right">
                          <div style={{ background: '#1a1a1a', borderRadius: 3, height: 10, width: 80, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${Math.min(r.delivPct, 100)}%`,
                              background: r.delivPct >= 70 ? 'var(--green)' : r.delivPct >= 50 ? 'var(--cyan)' : 'var(--amber)',
                              opacity: 0.7, transition: 'width 0.3s',
                            }}/>
                          </div>
                        </td>
                        <td style={{ color: sigColor, fontSize: 10, fontWeight: 700 }}>{signal}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Showing {Math.min(filtered.length, 30)} of {filtered.length} stocks. Data from NSE. Refreshes every 5 min.
              </div>
            </div>
          )}
        </>
      )}
    </TerminalCard>
  )
}

/* ─── Tiny helpers ─────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>{children}</div>
}

function CheckRow({ f, filters, setF }: { f: { key: string; label: string }; filters: any; setF: any }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={!!filters[f.key]}
        onChange={e => setF(f.key, e.target.checked)}
        style={{ accentColor: 'var(--green)', width: 13, height: 13 }}/>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{f.label}</span>
    </label>
  )
}

function Tag({ children, c }: { children: React.ReactNode; c: 'green'|'red'|'amber'|'cyan' }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    green: { bg: 'rgba(0,255,65,0.15)',   fg: 'var(--green)' },
    red:   { bg: 'rgba(255,0,64,0.15)',   fg: 'var(--red)'   },
    amber: { bg: 'rgba(255,170,0,0.15)',  fg: 'var(--amber)' },
    cyan:  { bg: 'rgba(0,212,255,0.15)',  fg: 'var(--cyan)'  },
  }
  return (
    <span style={{
      fontSize: 9, padding: '1px 4px', borderRadius: 3,
      background: colors[c].bg, color: colors[c].fg,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</div>
      <div className="font-mono font-bold" style={{ color: color ?? 'var(--text)', fontSize: 12 }}>{value}</div>
    </div>
  )
}
