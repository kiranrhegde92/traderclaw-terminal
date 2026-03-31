'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { formatPct, formatINR } from '@/lib/utils/format'
import {
  Radio, Plus, Bell, BellOff, ExternalLink, RefreshCw,
  LayoutDashboard, Rows2, Grid2x2, History, Trash2, Minus, TrendingUp, XCircle,
} from 'lucide-react'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ─── Pearson correlation ────────────────────────────────────────────────────
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ax = a.slice(-n), bx = b.slice(-n)
  const ma = ax.reduce((s, v) => s + v, 0) / n
  const mb = bx.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const ea = ax[i] - ma, eb = bx[i] - mb
    num += ea * eb; da += ea * ea; db += eb * eb
  }
  const denom = Math.sqrt(da * db)
  return denom === 0 ? 0 : num / denom
}

// ─── SVG Line Chart with overlay & drawing tools ───────────────────────────
interface DrawnLine { price: number }

interface SvgChartProps {
  symbol: string
  overlaySymbol?: string
  timeframe?: string
  height?: number
  drawnLines: DrawnLine[]
  activeTool: 'none' | 'hline' | 'trendline'
  onAddLine: (price: number) => void
}

function SvgChart({ symbol, overlaySymbol, timeframe = '1d', height = 240, drawnLines, activeTool, onAddLine }: SvgChartProps) {
  const [prices, setPrices]       = useState<number[]>([])
  const [times, setTimes]         = useState<string[]>([])
  const [overlay, setOverlay]     = useState<number[]>([])
  const [corr, setCorr]           = useState<number | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgW, setSvgW] = useState(600)

  // Observe width
  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(([e]) => setSvgW(e.contentRect.width))
    ro.observe(svgRef.current.parentElement!)
    setSvgW(svgRef.current.parentElement!.clientWidth || 600)
    return () => ro.disconnect()
  }, [])

  // Load primary series
  useEffect(() => {
    if (!symbol) return
    setLoading(true); setError('')
    fetch(`/api/data/historical?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}`)
      .then(r => r.json())
      .then(j => {
        if (!j.data?.length) throw new Error('No data')
        const pts: number[] = j.data.map((c: any) => c.close)
        const ts: string[]  = j.data.map((c: any) => String(c.time))
        setPrices(pts); setTimes(ts)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [symbol, timeframe])

  // Load overlay series
  useEffect(() => {
    if (!overlaySymbol) { setOverlay([]); setCorr(null); return }
    fetch(`/api/data/historical?symbol=${encodeURIComponent(overlaySymbol)}&interval=${timeframe}`)
      .then(r => r.json())
      .then(j => {
        if (!j.data?.length) { setOverlay([]); setCorr(null); return }
        const pts: number[] = j.data.map((c: any) => c.close)
        setOverlay(pts)
      })
      .catch(() => { setOverlay([]); setCorr(null) })
  }, [overlaySymbol, timeframe])

  // Compute correlation when both series are available
  useEffect(() => {
    if (prices.length > 1 && overlay.length > 1) {
      setCorr(pearson(prices, overlay))
    } else {
      setCorr(null)
    }
  }, [prices, overlay])

  const H = height
  const pad = { top: 10, bottom: 24, left: 8, right: 8 }
  const W = svgW

  // Normalize to 100 at start
  function normalize(arr: number[]): number[] {
    if (!arr.length) return []
    const base = arr[0] || 1
    return arr.map(v => (v / base) * 100)
  }

  const normMain    = overlaySymbol ? normalize(prices)  : prices
  const normOverlay = overlaySymbol ? normalize(overlay) : []

  // Combined min/max for Y scale
  const allVals = [...normMain, ...normOverlay].filter(v => isFinite(v))
  const minV = allVals.length ? Math.min(...allVals) : 0
  const maxV = allVals.length ? Math.max(...allVals) : 1
  const rangeV = maxV - minV || 1

  function toX(i: number, total: number): number {
    return pad.left + (i / Math.max(total - 1, 1)) * (W - pad.left - pad.right)
  }
  function toY(v: number): number {
    return pad.top + (1 - (v - minV) / rangeV) * (H - pad.top - pad.bottom)
  }

  // Price from SVG Y coordinate (for drawn lines)
  function priceFromY(y: number): number {
    // Invert toY: v = minV + (1 - (y - pad.top) / (H - pad.top - pad.bottom)) * rangeV
    const frac = (y - pad.top) / (H - pad.top - pad.bottom)
    const normPrice = minV + (1 - frac) * rangeV
    if (overlaySymbol) {
      // normPrice is in normalized scale; convert back to actual price
      const base = prices[0] || 1
      return (normPrice / 100) * base
    }
    return normPrice
  }

  function buildPath(series: number[]): string {
    if (series.length < 2) return ''
    return series
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i, series.length).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ')
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (activeTool !== 'hline' || !svgRef.current || !prices.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const price = priceFromY(y)
    onAddLine(price)
  }

  // Last price label
  const lastPrice = prices[prices.length - 1]

  // Tick labels on X axis (show ~5)
  const xTicks = times.length > 1
    ? [0, Math.floor(times.length * 0.25), Math.floor(times.length * 0.5), Math.floor(times.length * 0.75), times.length - 1]
    : []

  return (
    <div className="relative w-full" style={{ background: '#111' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>loading…</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {/* Correlation badge */}
      {corr !== null && (
        <div className="absolute top-1 right-2 z-10 text-xs px-1.5 py-0.5 rounded"
          style={{ background: '#1a1a1a', border: '1px solid #333', color: Math.abs(corr) > 0.7 ? 'var(--green)' : Math.abs(corr) > 0.4 ? 'var(--amber)' : 'var(--red)', fontFamily: 'JetBrains Mono' }}>
          ρ {corr.toFixed(3)}
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={H}
        style={{ display: 'block', cursor: activeTool === 'hline' ? 'crosshair' : 'default' }}
        onClick={handleSvgClick}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i}
            x1={pad.left} x2={W - pad.right}
            y1={pad.top + f * (H - pad.top - pad.bottom)}
            y2={pad.top + f * (H - pad.top - pad.bottom)}
            stroke="#1e1e1e" strokeWidth={1} />
        ))}

        {/* Primary series */}
        {normMain.length > 1 && (
          <path d={buildPath(normMain)} fill="none" stroke="#00d4ff" strokeWidth={1.5} />
        )}

        {/* Overlay series */}
        {normOverlay.length > 1 && (
          <path d={buildPath(normOverlay)} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" />
        )}

        {/* Drawn horizontal lines */}
        {drawnLines.map((dl, i) => {
          const dispVal = overlaySymbol ? (dl.price / (prices[0] || 1)) * 100 : dl.price
          const y = toY(dispVal)
          if (y < pad.top || y > H - pad.bottom) return null
          return (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y}
                stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 3" />
              <text x={W - pad.right - 4} y={y - 3} textAnchor="end"
                style={{ fill: '#f59e0b', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>
                {dl.price.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* Last price line */}
        {lastPrice !== undefined && normMain.length > 0 && (
          <line
            x1={pad.left} x2={W - pad.right}
            y1={toY(normMain[normMain.length - 1])} y2={toY(normMain[normMain.length - 1])}
            stroke="#00ff4140" strokeWidth={1} strokeDasharray="2 2" />
        )}

        {/* X axis tick labels */}
        {xTicks.map((idx, i) => (
          times[idx] ? (
            <text key={i} x={toX(idx, times.length)} y={H - 4} textAnchor="middle"
              style={{ fill: '#444', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>
              {times[idx].length > 10 ? times[idx].slice(5, 10) : times[idx].slice(0, 5)}
            </text>
          ) : null
        ))}

        {/* Y min/max labels */}
        {allVals.length > 0 && (
          <>
            <text x={W - pad.right - 2} y={pad.top + 8} textAnchor="end"
              style={{ fill: '#444', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>
              {overlaySymbol ? maxV.toFixed(1) : maxV.toFixed(2)}
            </text>
            <text x={W - pad.right - 2} y={H - pad.bottom - 4} textAnchor="end"
              style={{ fill: '#444', fontSize: '9px', fontFamily: 'JetBrains Mono' }}>
              {overlaySymbol ? minV.toFixed(1) : minV.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

// ─── Chart Panel ────────────────────────────────────────────────────────────
interface ChartPanelProps {
  panelId: number
  watchlistSymbols: string[]
  defaultSymbol?: string
}

function ChartPanel({ panelId, watchlistSymbols, defaultSymbol = '' }: ChartPanelProps) {
  const [symbol, setSymbol]           = useState(defaultSymbol || watchlistSymbols[0] || 'NIFTY 50')
  const [timeframe, setTimeframe]     = useState('1d')
  const [overlaySymbol, setOverlaySym]= useState('')
  const [showOverlayPicker, setShow]  = useState(false)
  const [drawnLines, setDrawnLines]   = useState<DrawnLine[]>([])
  const [activeTool, setActiveTool]   = useState<'none' | 'hline' | 'trendline'>('none')

  const timeframes = ['1m','5m','15m','1h','1d','1wk']

  function addLine(price: number) {
    setDrawnLines(prev => [...prev, { price }])
    setActiveTool('none')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Panel header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-wrap" style={{ borderBottom: '1px solid #1e1e1e', background: '#111' }}>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className="term-select" style={{ fontSize: '11px', padding: '2px 6px', minWidth: 0, flex: '1 1 80px' }}>
          {watchlistSymbols.length > 0
            ? watchlistSymbols.map(s => <option key={s} value={s}>{s}</option>)
            : <option value={symbol}>{symbol}</option>
          }
          {!watchlistSymbols.includes(symbol) && <option value={symbol}>{symbol}</option>}
        </select>

        {/* Timeframes */}
        <div className="flex gap-0.5">
          {timeframes.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className="px-1.5 rounded"
              style={{
                fontSize: '10px', fontFamily: 'JetBrains Mono',
                color: timeframe === tf ? '#00d4ff' : '#555',
                background: timeframe === tf ? 'rgba(0,212,255,0.08)' : 'transparent',
                border: `1px solid ${timeframe === tf ? '#00d4ff40' : 'transparent'}`,
              }}>
              {tf}
            </button>
          ))}
        </div>

        {/* Overlay */}
        {overlaySymbol
          ? (
            <div className="flex items-center gap-1">
              <span style={{ fontSize: '10px', color: '#f97316', fontFamily: 'JetBrains Mono' }}>{overlaySymbol}</span>
              <button onClick={() => setOverlaySym('')} style={{ color: '#555', lineHeight: 1 }}>✕</button>
            </div>
          )
          : (
            <button onClick={() => setShow(!showOverlayPicker)}
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ border: '1px solid #333', color: '#555', background: 'transparent', fontFamily: 'JetBrains Mono', fontSize: '10px' }}>
              + Overlay
            </button>
          )
        }
      </div>

      {/* Overlay picker dropdown */}
      {showOverlayPicker && (
        <div className="px-2 py-1.5 flex gap-1.5 items-center" style={{ borderBottom: '1px solid #1e1e1e', background: '#0a0a0a' }}>
          <select className="term-select flex-1" style={{ fontSize: '11px' }}
            onChange={e => { if (e.target.value) { setOverlaySym(e.target.value); setShow(false) } }}>
            <option value="">Select overlay…</option>
            {watchlistSymbols.filter(s => s !== symbol).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShow(false)} style={{ color: '#555', fontSize: '12px' }}>✕</button>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <SvgChart
          symbol={symbol}
          overlaySymbol={overlaySymbol || undefined}
          timeframe={timeframe}
          height={220}
          drawnLines={drawnLines}
          activeTool={activeTool}
          onAddLine={addLine}
        />
      </div>

      {/* Drawing toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1" style={{ borderTop: '1px solid #1e1e1e', background: '#111' }}>
        <span className="text-xs" style={{ color: '#444', fontSize: '10px', fontFamily: 'JetBrains Mono' }}>Tools:</span>
        <button
          onClick={() => setActiveTool(activeTool === 'hline' ? 'none' : 'hline')}
          title="Horizontal Line — click chart to place"
          className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
          style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono',
            color: activeTool === 'hline' ? '#f59e0b' : '#555',
            background: activeTool === 'hline' ? 'rgba(245,158,11,0.1)' : 'transparent',
            border: `1px solid ${activeTool === 'hline' ? '#f59e0b40' : '#333'}`,
          }}>
          <Minus size={10} /> H-Line
        </button>
        <button
          onClick={() => setActiveTool(activeTool === 'trendline' ? 'none' : 'trendline')}
          title="Trendline (click twice)"
          className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
          style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono',
            color: activeTool === 'trendline' ? '#a78bfa' : '#555',
            background: activeTool === 'trendline' ? 'rgba(167,139,250,0.08)' : 'transparent',
            border: `1px solid ${activeTool === 'trendline' ? '#a78bfa40' : '#333'}`,
          }}>
          <TrendingUp size={10} /> Trend
        </button>
        <button
          onClick={() => { setDrawnLines([]); setActiveTool('none') }}
          title="Clear all drawn lines"
          className="px-2 py-0.5 rounded text-xs flex items-center gap-1"
          style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color: '#555', border: '1px solid #333' }}>
          <XCircle size={10} /> Clear
        </button>
        {activeTool !== 'none' && (
          <span className="text-xs ml-1" style={{ color: '#f59e0b', fontSize: '10px', fontFamily: 'JetBrains Mono' }}>
            Click chart to draw
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Alert History Panel ─────────────────────────────────────────────────────
function AlertHistoryPanel() {
  const { data, mutate } = useSWR('/api/monitor/alert-log', fetcher, { refreshInterval: 15000 })
  const logs = (data?.data ?? []) as any[]

  async function clearAll() {
    await fetch('/api/monitor/alert-log', { method: 'DELETE' })
    mutate()
  }

  return (
    <TerminalCard
      title="Alert History"
      icon={<History size={12} />}
      accent="amber"
      action={
        <button onClick={clearAll} className="btn btn-sm btn-ghost flex items-center gap-1" style={{ color: 'var(--red)', fontSize: '11px' }}>
          <Trash2 size={10} /> Clear
        </button>
      }
    >
      {logs.length === 0 ? (
        <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No triggered alerts yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'collapse', fontFamily: 'JetBrains Mono' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                <th className="py-1 px-1 text-left" style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '10px' }}>Time</th>
                <th className="py-1 px-1 text-left" style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '10px' }}>Symbol</th>
                <th className="py-1 px-1 text-left" style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '10px' }}>Type</th>
                <th className="py-1 px-1 text-right" style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '10px' }}>Price</th>
                <th className="py-1 px-1 text-left" style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '10px' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #111' }}>
                  <td className="py-0.5 px-1" style={{ color: '#555', fontSize: '10px', whiteSpace: 'nowrap' }}>
                    {log.triggered_at ? log.triggered_at.slice(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td className="py-0.5 px-1 font-bold" style={{ color: 'var(--amber)' }}>{log.symbol}</td>
                  <td className="py-0.5 px-1" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{log.alert_type}</td>
                  <td className="py-0.5 px-1 text-right" style={{ color: 'var(--cyan)' }}>
                    {log.trigger_price != null ? Number(log.trigger_price).toFixed(2) : '—'}
                  </td>
                  <td className="py-0.5 px-1" style={{ color: 'var(--text-muted)', fontSize: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.message ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TerminalCard>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────
type Layout = 1 | 2 | 4

function MonitorPageInner() {
  const sp        = useSearchParams()
  const preSymbol = sp.get('symbol') ?? ''

  const [newSymbol, setNewSymbol]   = useState('')
  const [chartSymbol, setChartSymbol] = useState(preSymbol || 'NIFTY 50')
  const [alertForm, setAlertForm]   = useState({ symbol: '', alertType: 'PRICE_ABOVE', value: '' })
  const [layout, setLayout]         = useState<Layout>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('monitor_layout')
      if (saved === '2' || saved === '4') return parseInt(saved) as Layout
    }
    return 1
  })
  const [activeTab, setActiveTab]   = useState<'chart' | 'history'>('chart')

  const { data: wlData,  mutate: mutateWL  } = useSWR('/api/monitor/watchlist', fetcher, { refreshInterval: 60000 })
  const { data: altData, mutate: mutateAlt } = useSWR('/api/monitor/alerts',   fetcher, { refreshInterval: 30000 })
  const { mutate: mutateLog } = useSWR('/api/monitor/alert-log', fetcher)

  const symbols = (wlData?.data?.symbols ?? []) as any[]
  const alerts  = (altData?.data ?? []) as any[]
  const watchlistSymbolNames = symbols.map((s: any) => s.symbol)

  // Persist layout preference
  useEffect(() => {
    localStorage.setItem('monitor_layout', String(layout))
  }, [layout])

  async function addSymbol() {
    if (!newSymbol) return
    await fetch('/api/monitor/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: newSymbol.toUpperCase() })
    })
    setNewSymbol('')
    mutateWL()
  }

  async function removeSymbol(symbol: string) {
    await fetch('/api/monitor/watchlist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    })
    mutateWL()
  }

  async function createAlert() {
    if (!alertForm.symbol || !alertForm.value) return
    await fetch('/api/monitor/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: alertForm.symbol.toUpperCase(),
        alertType: alertForm.alertType,
        condition: { value: +alertForm.value },
      })
    })
    setAlertForm(f => ({ ...f, value: '' }))
    mutateAlt()
  }

  async function deleteAlert(id: number) {
    await fetch('/api/monitor/alerts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    mutateAlt()
  }

  // Auto-add preSymbol to watchlist
  useEffect(() => {
    if (preSymbol) {
      fetch('/api/monitor/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: preSymbol.toUpperCase() })
      }).then(() => mutateWL())
    }
  }, [preSymbol])

  // Layout button style
  function layoutBtnStyle(l: Layout) {
    return {
      fontSize: '11px', fontFamily: 'JetBrains Mono',
      padding: '3px 10px', borderRadius: '4px',
      color: layout === l ? '#00d4ff' : '#555',
      background: layout === l ? 'rgba(0,212,255,0.08)' : 'transparent',
      border: `1px solid ${layout === l ? '#00d4ff40' : '#333'}`,
      cursor: 'pointer',
    } as React.CSSProperties
  }

  // Compute grid for panels
  const panelCount = layout
  const gridCols   = layout === 4 ? 2 : layout === 2 ? 2 : 1
  const panelSymbols = [
    chartSymbol,
    watchlistSymbolNames[1] || chartSymbol,
    watchlistSymbolNames[2] || chartSymbol,
    watchlistSymbolNames[3] || chartSymbol,
  ]

  return (
    <>
      <Topbar title="Live Monitor" />
      <div className="page-content space-y-4">
        <div className="grid grid-cols-12 gap-4">

          {/* ── Left sidebar ── */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <TerminalCard title="Watchlist" icon={<Radio size={12}/>} accent="cyan"
              action={<button onClick={() => mutateWL()} className="btn btn-sm btn-ghost"><RefreshCw size={11}/></button>}>
              <div className="flex gap-2 mb-3">
                <input type="text" placeholder="Add symbol..." value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addSymbol()}
                  className="term-input flex-1" />
                <button onClick={addSymbol} className="btn btn-sm btn-green"><Plus size={12}/></button>
              </div>

              <div className="space-y-1">
                {symbols.map((s: any) => (
                  <div key={s.id ?? s.symbol}
                    className="flex items-center justify-between p-2 rounded cursor-pointer hover:bg-white/5 transition-all"
                    style={{ background: chartSymbol === s.symbol ? 'rgba(0,212,255,0.06)' : undefined }}
                    onClick={() => setChartSymbol(s.symbol)}>
                    <div>
                      <div className="text-xs font-bold" style={{ color: chartSymbol === s.symbol ? 'var(--cyan)' : 'var(--text)' }}>
                        {s.symbol}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{s.exchange}</div>
                    </div>
                    <div className="flex gap-1">
                      <Link href={`/options?symbol=${s.symbol}`}
                        className="btn btn-sm btn-ghost" style={{ textDecoration: 'none', padding: '2px 6px' }}>Opt</Link>
                      <button onClick={(e) => { e.stopPropagation(); removeSymbol(s.symbol) }}
                        className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }}>✕</button>
                    </div>
                  </div>
                ))}
                {symbols.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    Add symbols to track
                  </div>
                )}
              </div>
            </TerminalCard>

            <TerminalCard title="Alerts" icon={<Bell size={12}/>} accent="amber">
              <div className="space-y-2 mb-3">
                <input type="text" placeholder="Symbol" value={alertForm.symbol}
                  onChange={e => setAlertForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                  className="term-input" />
                <select value={alertForm.alertType}
                  onChange={e => setAlertForm(f => ({ ...f, alertType: e.target.value }))}
                  className="term-select w-full">
                  <option value="PRICE_ABOVE">Price Above</option>
                  <option value="PRICE_BELOW">Price Below</option>
                  <option value="VOLUME">Volume Spike</option>
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="Value" value={alertForm.value}
                    onChange={e => setAlertForm(f => ({ ...f, value: e.target.value }))}
                    className="term-input flex-1" />
                  <button onClick={createAlert} className="btn btn-sm btn-amber"><Bell size={11}/></button>
                </div>
              </div>

              <div className="space-y-1">
                {alerts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-1.5 rounded text-xs"
                    style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                    <div>
                      <span className="font-bold" style={{ color: 'var(--amber)' }}>{a.symbol}</span>
                      <span className="ml-2" style={{ color: 'var(--text-dim)' }}>
                        {a.alert_type ?? a.alertType} {JSON.parse(a.condition_json ?? '{}').value}
                      </span>
                    </div>
                    <button onClick={() => deleteAlert(a.id)}
                      className="text-xs" style={{ color: 'var(--red)' }}>✕</button>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>No active alerts</div>
                )}
              </div>
            </TerminalCard>
          </div>

          {/* ── Right content area ── */}
          <div className="col-span-12 lg:col-span-9 space-y-4">

            {/* Tab bar + layout selector */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Tabs */}
              <div className="flex gap-1">
                <button onClick={() => setActiveTab('chart')}
                  className="px-3 py-1.5 rounded text-xs"
                  style={{
                    fontFamily: 'JetBrains Mono', fontSize: '11px',
                    color: activeTab === 'chart' ? '#00d4ff' : '#555',
                    background: activeTab === 'chart' ? 'rgba(0,212,255,0.08)' : 'transparent',
                    border: `1px solid ${activeTab === 'chart' ? '#00d4ff40' : '#333'}`,
                  }}>
                  Charts
                </button>
                <button onClick={() => setActiveTab('history')}
                  className="px-3 py-1.5 rounded text-xs flex items-center gap-1"
                  style={{
                    fontFamily: 'JetBrains Mono', fontSize: '11px',
                    color: activeTab === 'history' ? '#f59e0b' : '#555',
                    background: activeTab === 'history' ? 'rgba(245,158,11,0.08)' : 'transparent',
                    border: `1px solid ${activeTab === 'history' ? '#f59e0b40' : '#333'}`,
                  }}>
                  <History size={11} /> Alert History
                </button>
              </div>

              {/* Layout selector (only in chart tab) */}
              {activeTab === 'chart' && (
                <div className="flex items-center gap-1">
                  <span className="text-xs mr-1" style={{ color: '#444', fontFamily: 'JetBrains Mono' }}>Layout:</span>
                  <button style={layoutBtnStyle(1)} onClick={() => setLayout(1)}>
                    1 Chart
                  </button>
                  <button style={layoutBtnStyle(2)} onClick={() => setLayout(2)}>
                    2 Charts
                  </button>
                  <button style={layoutBtnStyle(4)} onClick={() => setLayout(4)}>
                    4 Charts
                  </button>
                </div>
              )}
            </div>

            {/* Charts tab */}
            {activeTab === 'chart' && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gap: '8px',
                  }}
                >
                  {Array.from({ length: panelCount }).map((_, i) => (
                    <ChartPanel
                      key={i}
                      panelId={i}
                      watchlistSymbols={watchlistSymbolNames.length > 0 ? watchlistSymbolNames : [chartSymbol]}
                      defaultSymbol={panelSymbols[i]}
                    />
                  ))}
                </div>

                {/* Quick actions (only in single-chart mode) */}
                {layout === 1 && chartSymbol && (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/screener?symbol=${chartSymbol}`}   className="btn btn-ghost" style={{ textDecoration: 'none' }}>📊 Full Analysis</Link>
                    <Link href={`/options?symbol=${chartSymbol}`}    className="btn btn-cyan"  style={{ textDecoration: 'none' }}>⚡ Options Chain</Link>
                    <Link href={`/strategies?underlying=${chartSymbol}`} className="btn btn-amber" style={{ textDecoration: 'none' }}>🎯 Build Strategy</Link>
                    <Link href={`/paper-trade?symbol=${chartSymbol}`}className="btn btn-green" style={{ textDecoration: 'none' }}>📋 Paper Trade</Link>
                  </div>
                )}
              </>
            )}

            {/* Alert History tab */}
            {activeTab === 'history' && <AlertHistoryPanel />}
          </div>
        </div>
      </div>
    </>
  )
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="page-content flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>}>
      <MonitorPageInner />
    </Suspense>
  )
}
