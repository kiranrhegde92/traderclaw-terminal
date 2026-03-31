'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const INTERVALS = [
  { value: '1m',  label: '1M'  },
  { value: '5m',  label: '5M'  },
  { value: '15m', label: '15M' },
  { value: '60m', label: '1H'  },
  { value: '1d',  label: '1D'  },
  { value: '1wk', label: '1W'  },
]

const INDICATORS = ['EMA20', 'EMA50', 'EMA200', 'RSI', 'MACD', 'BB', 'VWAP'] as const
type Indicator = typeof INDICATORS[number]

interface OHLCV { time: number; open: number; high: number; low: number; close: number; volume: number }

interface Props {
  symbol:            string
  height?:           number
  showVolume?:       boolean
  showToolbar?:      boolean
  defaultInterval?:  string
  defaultIndicators?: Indicator[]
  markers?:          Array<{ time: number; position: 'belowBar'|'aboveBar'; color: string; shape: string; text: string }>
  onIntervalChange?: (i: string) => void
}

/* ── Indicator math ─────────────────────────────────────────────────── */

function calcEMA(closes: number[], period: number): (number | null)[] {
  const k  = 2 / (period + 1)
  const out: (number | null)[] = new Array(Math.min(period - 1, closes.length)).fill(null)
  if (closes.length < period) return new Array(closes.length).fill(null)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  out.push(ema)
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
    out.push(ema)
  }
  return out
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(period).fill(null)
  if (closes.length <= period) return new Array(closes.length).fill(null)
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let avgG = gains / period, avgL = losses / period
  out.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL))
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    avgG = (avgG * (period - 1) + g) / period
    avgL = (avgL * (period - 1) + l) / period
    out.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL))
  }
  return out
}

function calcMACD(closes: number[]): { macd: (number|null)[]; signal: (number|null)[]; hist: (number|null)[] } {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macd  = ema12.map((v, i) => (v != null && ema26[i] != null) ? v - ema26[i]! : null)
  // signal = 9-period EMA of MACD
  const macdValid = macd.filter(v => v != null) as number[]
  const sigArr    = calcEMA(macdValid, 9)
  const signal: (number|null)[] = new Array(macd.length).fill(null)
  let vi = 0
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] != null) { signal[i] = sigArr[vi++] ?? null }
  }
  const hist = macd.map((v, i) => (v != null && signal[i] != null) ? v - signal[i]! : null)
  return { macd, signal, hist }
}

function calcBB(closes: number[], period = 20, mult = 2): { mid: (number|null)[]; upper: (number|null)[]; lower: (number|null)[] } {
  const mid: (number|null)[] = [], upper: (number|null)[] = [], lower: (number|null)[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { mid.push(null); upper.push(null); lower.push(null); continue }
    const slice = closes.slice(i - period + 1, i + 1)
    const avg   = slice.reduce((a, b) => a + b, 0) / period
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - avg) ** 2, 0) / period)
    mid.push(avg); upper.push(avg + mult * std); lower.push(avg - mult * std)
  }
  return { mid, upper, lower }
}

function calcVWAP(candles: OHLCV[]): (number|null)[] {
  let cumTV = 0, cumV = 0
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3
    cumTV += tp * c.volume
    cumV  += c.volume
    return cumV > 0 ? cumTV / cumV : null
  })
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function CandlestickChart({
  symbol, height = 420, showVolume = true, showToolbar = true,
  defaultInterval = '1d', defaultIndicators = [],
  markers = [], onIntervalChange,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const volRef        = useRef<HTMLDivElement>(null)
  const rsiRef        = useRef<HTMLDivElement>(null)
  const macdRef       = useRef<HTMLDivElement>(null)

  const chartRef      = useRef<any>(null)
  const seriesRef     = useRef<any>(null)
  const volChartRef   = useRef<any>(null)
  const volSeriesRef  = useRef<any>(null)
  const rsiChartRef   = useRef<any>(null)
  const rsiSeriesRef  = useRef<any>(null)
  const macdChartRef  = useRef<any>(null)

  const overlayRefs   = useRef<any[]>([])

  const [interval,   setIntervalState] = useState(defaultInterval)
  const [loading,    setLoading]       = useState(false)
  const [error,      setError]         = useState('')
  const [active,     setActive]        = useState<Set<Indicator>>(new Set(defaultIndicators))
  const [ohlcv,      setOhlcv]         = useState<OHLCV[]>([])
  const [crosshair,  setCrosshair]     = useState<{ o:number; h:number; l:number; c:number; v:number; t:number } | null>(null)

  const CHART_BG = '#0d0d0d'
  const GRID     = '#161616'
  const TEXT     = '#666'

  const showRSI  = active.has('RSI')
  const showMACD = active.has('MACD')

  /* ── Main chart init ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    ;(async () => {
      const LW = await import('lightweight-charts')
      if (!mounted || !containerRef.current) return

      const mainH = height - (showVolume ? 70 : 0) - (showRSI ? 90 : 0) - (showMACD ? 90 : 0)

      // Main chart
      const chart = LW.createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: mainH,
        layout:    { background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: TEXT, fontFamily: 'JetBrains Mono', fontSize: 10 },
        grid:      { vertLines: { color: GRID }, horzLines: { color: GRID } },
        crosshair: { mode: LW.CrosshairMode.Normal,
          vertLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
          horzLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
        },
        rightPriceScale: { borderColor: '#1e1e1e', scaleMargins: { top: 0.08, bottom: showVolume ? 0 : 0.05 } },
        timeScale: { borderColor: '#1e1e1e', timeVisible: true, secondsVisible: false },
      })

      const candles = chart.addSeries(LW.CandlestickSeries, {
        upColor: '#00ff41', downColor: '#ff0040',
        borderUpColor: '#00ff41', borderDownColor: '#ff0040',
        wickUpColor: '#00ff4180', wickDownColor: '#ff004080',
      })
      chartRef.current  = chart
      seriesRef.current = candles

      // Crosshair subscription for OHLCV tooltip
      chart.subscribeCrosshairMove((param: any) => {
        if (!param.point || !param.time) { setCrosshair(null); return }
        const c = param.seriesData.get(candles)
        if (!c) return
        const bar = ohlcv.find(d => d.time === param.time)
        setCrosshair({ o: c.open, h: c.high, l: c.low, c: c.close, v: bar?.volume ?? 0, t: param.time })
      })

      // Responsive resize
      const ro = new ResizeObserver(([e]) => {
        chart.resize(e.contentRect.width, mainH)
        volChartRef.current?.resize(e.contentRect.width, 70)
        rsiChartRef.current?.resize(e.contentRect.width, 90)
        macdChartRef.current?.resize(e.contentRect.width, 90)
      })
      ro.observe(containerRef.current)

      // Volume chart
      if (showVolume && volRef.current) {
        const vc = LW.createChart(volRef.current, {
          width:  volRef.current.clientWidth,
          height: 70,
          layout: { background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: TEXT, fontFamily: 'JetBrains Mono', fontSize: 9 },
          grid:   { vertLines: { color: GRID }, horzLines: { visible: false } },
          rightPriceScale: { borderColor: '#1e1e1e', scaleMargins: { top: 0.1, bottom: 0 } },
          timeScale: { borderColor: '#1e1e1e', visible: false },
          crosshair: { mode: LW.CrosshairMode.Normal,
            vertLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
            horzLine: { visible: false },
          },
        })
        volChartRef.current  = vc
        volSeriesRef.current = vc.addSeries(LW.HistogramSeries, {
          color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        })
        vc.priceScale('volume').applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } })
        // Sync timescales
        chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (range) vc.timeScale().setVisibleLogicalRange(range)
        })
        vc.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (range) chart.timeScale().setVisibleLogicalRange(range)
        })
      }

      // RSI chart
      if (showRSI && rsiRef.current) {
        const rc = LW.createChart(rsiRef.current, {
          width:  rsiRef.current.clientWidth,
          height: 90,
          layout: { background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: TEXT, fontFamily: 'JetBrains Mono', fontSize: 9 },
          grid:   { vertLines: { color: GRID }, horzLines: { color: GRID } },
          rightPriceScale: { borderColor: '#1e1e1e', scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { borderColor: '#1e1e1e', visible: false },
          crosshair: { mode: LW.CrosshairMode.Normal,
            vertLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
            horzLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
          },
        })
        rsiChartRef.current = rc
        rsiSeriesRef.current = rc.addSeries(LW.LineSeries, { color: '#00e5ff', lineWidth: 1, priceLineVisible: false })
        // Overbought/oversold bands
        rc.addSeries(LW.LineSeries, { color: '#ff004040', lineWidth: 1, lineStyle: LW.LineStyle.Dashed, priceLineVisible: false })
        rc.addSeries(LW.LineSeries, { color: '#00ff4140', lineWidth: 1, lineStyle: LW.LineStyle.Dashed, priceLineVisible: false })
        chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (range) rc.timeScale().setVisibleLogicalRange(range)
        })
      }

      // MACD chart
      if (showMACD && macdRef.current) {
        const mc = LW.createChart(macdRef.current, {
          width:  macdRef.current.clientWidth,
          height: 90,
          layout: { background: { type: LW.ColorType.Solid, color: CHART_BG }, textColor: TEXT, fontFamily: 'JetBrains Mono', fontSize: 9 },
          grid:   { vertLines: { color: GRID }, horzLines: { color: GRID } },
          rightPriceScale: { borderColor: '#1e1e1e', scaleMargins: { top: 0.2, bottom: 0.1 } },
          timeScale: { borderColor: '#1e1e1e', visible: false },
          crosshair: { mode: LW.CrosshairMode.Normal,
            vertLine: { color: '#00ff4130', width: 1, style: LW.LineStyle.Dashed, labelBackgroundColor: '#1a1a1a' },
            horzLine: { visible: false },
          },
        })
        macdChartRef.current = mc
        // MACD histogram
        mc.addSeries(LW.HistogramSeries, { color: '#00ff4180', priceLineVisible: false })
        // MACD line
        mc.addSeries(LW.LineSeries, { color: '#00e5ff', lineWidth: 1, priceLineVisible: false })
        // Signal line
        mc.addSeries(LW.LineSeries, { color: '#ff6b6b', lineWidth: 1, priceLineVisible: false })
        chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
          if (range) mc.timeScale().setVisibleLogicalRange(range)
        })
      }

      await loadData(symbol, interval)
    })()

    return () => {
      mounted = false
      chartRef.current?.remove();     chartRef.current     = null
      volChartRef.current?.remove();  volChartRef.current  = null
      rsiChartRef.current?.remove();  rsiChartRef.current  = null
      macdChartRef.current?.remove(); macdChartRef.current = null
      seriesRef.current = null; volSeriesRef.current = null; rsiSeriesRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, showRSI, showMACD, showVolume, height])

  /* ── Load + overlay data ─────────────────────────────────────────── */
  const loadData = useCallback(async (sym: string, itv: string) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/data/historical?symbol=${sym}&interval=${itv}`)
      const json = await res.json()
      if (!res.ok || !json.data?.length) throw new Error(json.error || 'No data')

      const candles: OHLCV[] = json.data
      setOhlcv(candles)

      if (!seriesRef.current) return

      // Main candles
      seriesRef.current.setData(candles.map(c => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })))
      if (markers.length) seriesRef.current.setMarkers(markers)
      chartRef.current?.timeScale().fitContent()

      // Volume
      if (volSeriesRef.current) {
        volSeriesRef.current.setData(candles.map(c => ({
          time: c.time as any, value: c.volume,
          color: c.close >= c.open ? '#00ff4160' : '#ff004060',
        })))
      }

      // Remove old overlays
      overlayRefs.current.forEach(s => { try { chartRef.current?.removeSeries(s) } catch {} })
      overlayRefs.current = []

      const closes = candles.map(c => c.close)
      const times  = candles.map(c => c.time as any)
      const LW     = (await import('lightweight-charts'))

      const addLine = (values: (number|null)[], color: string, width = 1) => {
        if (!chartRef.current) return
        const s = chartRef.current.addSeries(LW.LineSeries, { color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        s.setData(values.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value != null) as any)
        overlayRefs.current.push(s)
      }

      if (active.has('EMA20'))  addLine(calcEMA(closes, 20),  '#00e5ff', 1)
      if (active.has('EMA50'))  addLine(calcEMA(closes, 50),  '#ffa726', 1)
      if (active.has('EMA200')) addLine(calcEMA(closes, 200), '#ab47bc', 1)
      if (active.has('VWAP'))   addLine(calcVWAP(candles),    '#f06292', 1)

      if (active.has('BB')) {
        const bb = calcBB(closes)
        addLine(bb.upper, '#26a69a80', 1)
        addLine(bb.mid,   '#26a69a',   1)
        addLine(bb.lower, '#26a69a80', 1)
      }

      // RSI
      if (showRSI && rsiChartRef.current) {
        const rsiVals = calcRSI(closes)
        const rsiSeries = rsiChartRef.current.series()[0]
        const obSeries  = rsiChartRef.current.series()[1]
        const osSeries  = rsiChartRef.current.series()[2]
        if (rsiSeries) rsiSeries.setData(rsiVals.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value != null) as any)
        if (obSeries)  obSeries.setData(times.map(t => ({ time: t, value: 70 })))
        if (osSeries)  osSeries.setData(times.map(t => ({ time: t, value: 30 })))
      }

      // MACD
      if (showMACD && macdChartRef.current) {
        const { macd, signal, hist } = calcMACD(closes)
        const mc = macdChartRef.current
        const histS = mc.series()[0], macdS = mc.series()[1], sigS = mc.series()[2]
        if (histS) histS.setData(hist.map((v, i) => ({ time: times[i], value: v, color: (v ?? 0) >= 0 ? '#00ff4180' : '#ff004080' })).filter(d => d.value != null) as any)
        if (macdS) macdS.setData(macd.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value != null) as any)
        if (sigS)  sigS.setData( signal.map((v, i) => ({ time: times[i], value: v })).filter(d => d.value != null) as any)
      }

    } catch (e: any) { setError(e.message) }
    finally           { setLoading(false) }
  }, [active, markers, showRSI, showMACD])

  function handleInterval(itv: string) {
    setIntervalState(itv)
    onIntervalChange?.(itv)
    loadData(symbol, itv)
  }

  function toggleIndicator(ind: Indicator) {
    setActive(prev => {
      const next = new Set(prev)
      next.has(ind) ? next.delete(ind) : next.add(ind)
      return next
    })
  }

  // Reload when active indicators change
  useEffect(() => {
    if (seriesRef.current) loadData(symbol, interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const fmt  = (n: number) => n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtV = (n: number) => n > 1e7 ? `${(n/1e7).toFixed(1)}Cr` : n > 1e5 ? `${(n/1e5).toFixed(1)}L` : String(n)

  return (
    <div style={{ background: CHART_BG, borderRadius: 4, overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      {showToolbar && (
        <div style={{ borderBottom: '1px solid #1e1e1e' }}>
          {/* Row 1: Symbol + interval + OHLCV tooltip */}
          <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
            <span style={{ color: '#00ff41', fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>{symbol}</span>
            <div className="flex gap-0.5">
              {INTERVALS.map(iv => (
                <button key={iv.value} onClick={() => handleInterval(iv.value)}
                  style={{
                    padding: '2px 7px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'JetBrains Mono',
                    color:      interval === iv.value ? '#00ff41'              : '#444',
                    background: interval === iv.value ? 'rgba(0,255,65,0.12)' : 'transparent',
                    border:    `1px solid ${interval === iv.value ? '#00ff41' : 'transparent'}`,
                  }}
                >{iv.label}</button>
              ))}
            </div>
            {loading && <span style={{ color: '#444', fontSize: 10, fontFamily: 'JetBrains Mono' }}>loading…</span>}
            {error   && <span style={{ color: '#ff0040', fontSize: 10, fontFamily: 'JetBrains Mono' }}>{error}</span>}
            {crosshair && (
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#888', marginLeft: 4 }}>
                O <span style={{ color: '#ccc' }}>{fmt(crosshair.o)}</span>
                {'  '}H <span style={{ color: '#00ff41' }}>{fmt(crosshair.h)}</span>
                {'  '}L <span style={{ color: '#ff0040' }}>{fmt(crosshair.l)}</span>
                {'  '}C <span style={{ color: crosshair.c >= crosshair.o ? '#00ff41' : '#ff0040' }}>{fmt(crosshair.c)}</span>
                {'  '}V <span style={{ color: '#888' }}>{fmtV(crosshair.v)}</span>
              </span>
            )}
          </div>
          {/* Row 2: Indicator toggles */}
          <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
            <span style={{ color: '#444', fontSize: 9, fontFamily: 'JetBrains Mono', marginRight: 4 }}>INDICATORS</span>
            {INDICATORS.map(ind => (
              <button key={ind} onClick={() => toggleIndicator(ind)}
                style={{
                  padding: '1px 7px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'JetBrains Mono',
                  color:      active.has(ind) ? '#00e5ff'              : '#444',
                  background: active.has(ind) ? 'rgba(0,229,255,0.10)' : 'transparent',
                  border:    `1px solid ${active.has(ind) ? 'rgba(0,229,255,0.4)' : '#222'}`,
                }}
              >{ind}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chart panes ── */}
      <div ref={containerRef} />
      {showVolume && <div ref={volRef} style={{ borderTop: '1px solid #161616' }} />}
      {showRSI    && (
        <div style={{ borderTop: '1px solid #161616', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 3, left: 6, fontSize: 9, color: '#444', fontFamily: 'JetBrains Mono', zIndex: 1 }}>RSI 14</span>
          <div ref={rsiRef} />
        </div>
      )}
      {showMACD   && (
        <div style={{ borderTop: '1px solid #161616', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 3, left: 6, fontSize: 9, color: '#444', fontFamily: 'JetBrains Mono', zIndex: 1 }}>MACD 12/26/9</span>
          <div ref={macdRef} />
        </div>
      )}
    </div>
  )
}
