'use client'
import { useState, useMemo } from 'react'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { formatINR, formatPct } from '@/lib/utils/format'
import { Play, TrendingUp, TrendingDown, BarChart2, Activity, RefreshCw } from 'lucide-react'

const STRATEGIES = [
  { value: 'ema_cross', label: 'EMA Crossover',       desc: 'Buy when fast EMA crosses above slow EMA, sell on reversal' },
  { value: 'rsi',       label: 'RSI Mean Reversion',  desc: 'Buy on oversold RSI recovery, sell on overbought reversal' },
  { value: 'macd',      label: 'MACD Signal Cross',   desc: 'Buy when MACD crosses above signal line, sell on reversal' },
  { value: 'bb',        label: 'Bollinger Band Bounce',desc: 'Buy on lower band bounce, sell on upper band rejection' },
]

const RANGES = [
  { value: '6mo',  label: '6 Months'  },
  { value: '1y',   label: '1 Year'    },
  { value: '2y',   label: '2 Years'   },
  { value: '5y',   label: '5 Years'   },
]

const QUICK_SYMBOLS = [
  'NIFTY50', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'KOTAKBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'WIPRO', 'LT', 'TATASTEEL', 'AXISBANK',
  'SUNPHARMA', 'TATAMOTORS', 'HINDUNILVR', 'MARUTI', 'BAJFINANCE',
]

interface Metrics {
  totalReturn: number; buyHoldReturn: number; alpha: number
  trades: number; winRate: number; avgWin: number; avgLoss: number
  profitFactor: number; maxDrawdown: number
}

interface Trade {
  entry: string; exit: string; entryPrice: number; exitPrice: number
  pnl: number; pnlPct: number; holding: number; signal: string
}

interface BacktestResult {
  symbol: string; strategy: string; range: string; bars: number
  from: string; to: string
  initialCapital: number; finalCapital: number
  metrics: Metrics
  trades: Trade[]
  equity: { date: string; value: number }[]
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="term-card p-4 text-center">
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function EquityCurve({ equity, initialCapital }: { equity: { date: string; value: number }[]; initialCapital: number }) {
  if (!equity.length) return null
  const W = 640, H = 200
  const PAD = { top: 16, right: 16, bottom: 32, left: 72 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const vals = equity.map(e => e.value)
  const minV = Math.min(...vals) * 0.995
  const maxV = Math.max(...vals) * 1.005
  const range = maxV - minV || 1

  const xPos = (i: number) => PAD.left + (i / Math.max(equity.length - 1, 1)) * cW
  const yPos = (v: number) => PAD.top + cH - ((v - minV) / range) * cH

  const points = equity.map((e, i) => `${xPos(i)},${yPos(e.value)}`).join(' ')
  const finalIsUp = (equity[equity.length - 1]?.value ?? initialCapital) >= initialCapital
  const color = finalIsUp ? 'var(--green)' : 'var(--red)'
  const baseLine = yPos(initialCapital)

  // Show every ~20th label to avoid clutter
  const step = Math.max(1, Math.floor(equity.length / 8))

  // Y ticks
  const yTicks = [minV, (minV + maxV) / 2, maxV]

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="#1f1f1f" strokeWidth={1}/>
            <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor="end" fontSize={8} fill="var(--text-muted)">
              {(v / 1000).toFixed(0)}K
            </text>
          </g>
        ))}

        {/* Baseline (initial capital) */}
        {baseLine >= PAD.top && baseLine <= PAD.top + cH && (
          <line x1={PAD.left} y1={baseLine} x2={W - PAD.right} y2={baseLine}
            stroke="rgba(255,200,0,0.4)" strokeWidth={1} strokeDasharray="5,4"/>
        )}

        {/* Area fill */}
        <polygon
          points={`${xPos(0)},${baseLine} ${points} ${xPos(equity.length - 1)},${baseLine}`}
          fill={finalIsUp ? 'rgba(0,255,65,0.07)' : 'rgba(255,0,64,0.07)'}
        />

        {/* Equity line */}
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"/>

        {/* X labels */}
        {equity.filter((_, i) => i % step === 0 || i === equity.length - 1).map((e, _, arr) => {
          const orig = equity.indexOf(e)
          return (
            <text key={e.date} x={xPos(orig)} y={H - 4}
              textAnchor="middle" fontSize={8} fill="var(--text-muted)">
              {e.date.slice(2, 7)}
            </text>
          )
        })}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + cH} stroke="#333" strokeWidth={1}/>
        <line x1={PAD.left} y1={PAD.top + cH} x2={W - PAD.right} y2={PAD.top + cH} stroke="#333" strokeWidth={1}/>
      </svg>
    </div>
  )
}

export default function BacktestPage() {
  const [symbol,        setSymbol]        = useState('NIFTY50')
  const [symbolInput,   setSymbolInput]   = useState('NIFTY50')
  const [strategy,      setStrategy]      = useState('ema_cross')
  const [range,         setRange]         = useState('2y')
  const [initialCap,    setInitialCap]    = useState(100000)
  const [brokerage,     setBrokerage]     = useState(0.02)
  const [emaFast,       setEmaFast]       = useState(20)
  const [emaSlow,       setEmaSlow]       = useState(50)
  const [rsiOversold,   setRsiOversold]   = useState(30)
  const [rsiOverbought, setRsiOverbought] = useState(70)
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState<BacktestResult | null>(null)
  const [error,         setError]         = useState('')

  const stratDef = STRATEGIES.find(s => s.value === strategy)

  async function runBacktest() {
    setLoading(true); setError(''); setResult(null)
    try {
      const body: any = { symbol, strategy, range, initialCapital: initialCap, brokerage }
      if (strategy === 'ema_cross') { body.emaFast = emaFast; body.emaSlow = emaSlow }
      if (strategy === 'rsi')       { body.rsiOversold; body.rsiOverbought }
      body.rsiOversold   = rsiOversold
      body.rsiOverbought = rsiOverbought

      const res  = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setResult(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const m = result?.metrics

  return (
    <>
      <Topbar title="Backtest" />
      <div className="page-content space-y-4">

        {/* Config panel */}
        <TerminalCard title="Strategy Backtest" icon={<Play size={12}/>} accent="green">
          <div className="space-y-4">

            {/* Symbol + Range */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <div className="text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>Symbol</div>
                <div className="flex gap-2">
                  <input
                    value={symbolInput}
                    onChange={e => setSymbolInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && setSymbol(symbolInput)}
                    className="input-terminal"
                    style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
                    placeholder="e.g. RELIANCE"
                  />
                  <button onClick={() => setSymbol(symbolInput)} className="btn btn-sm btn-ghost">Set</button>
                </div>
              </div>

              <div>
                <div className="text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>Range</div>
                <select value={range} onChange={e => setRange(e.target.value)} className="term-select" style={{ fontSize: 12 }}>
                  {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <div className="text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>Capital (₹)</div>
                <input type="number" value={initialCap} onChange={e => setInitialCap(+e.target.value)}
                  className="input-terminal" style={{ width: 120, padding: '5px 8px', fontSize: 12 }}/>
              </div>

              <div>
                <div className="text-xs mb-1.5" style={{ color: 'var(--text-dim)' }}>Brokerage %</div>
                <input type="number" step="0.01" value={brokerage} onChange={e => setBrokerage(+e.target.value)}
                  className="input-terminal" style={{ width: 90, padding: '5px 8px', fontSize: 12 }}/>
              </div>
            </div>

            {/* Quick symbol picker */}
            <div className="flex flex-wrap gap-1">
              {QUICK_SYMBOLS.map(s => (
                <button key={s} onClick={() => { setSymbol(s); setSymbolInput(s) }}
                  className={`btn btn-sm ${symbol === s ? 'btn-green' : 'btn-ghost'}`}
                  style={{ fontSize: 10 }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Strategy picker */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>Strategy</div>
              <div className="flex flex-wrap gap-2">
                {STRATEGIES.map(s => (
                  <button key={s.value} onClick={() => setStrategy(s.value)}
                    className={`btn btn-sm ${strategy === s.value ? 'btn-green' : 'btn-ghost'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              {stratDef && (
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {stratDef.desc}
                </div>
              )}
            </div>

            {/* Strategy params */}
            {strategy === 'ema_cross' && (
              <div className="flex gap-4">
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Fast EMA</div>
                  <input type="number" min={2} max={200} value={emaFast} onChange={e => setEmaFast(+e.target.value)}
                    className="input-terminal" style={{ width: 80, padding: '4px 8px', fontSize: 12 }}/>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Slow EMA</div>
                  <input type="number" min={2} max={500} value={emaSlow} onChange={e => setEmaSlow(+e.target.value)}
                    className="input-terminal" style={{ width: 80, padding: '4px 8px', fontSize: 12 }}/>
                </div>
              </div>
            )}
            {strategy === 'rsi' && (
              <div className="flex gap-4">
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Oversold (Buy)</div>
                  <input type="number" min={10} max={50} value={rsiOversold} onChange={e => setRsiOversold(+e.target.value)}
                    className="input-terminal" style={{ width: 80, padding: '4px 8px', fontSize: 12 }}/>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Overbought (Sell)</div>
                  <input type="number" min={50} max={90} value={rsiOverbought} onChange={e => setRsiOverbought(+e.target.value)}
                    className="input-terminal" style={{ width: 80, padding: '4px 8px', fontSize: 12 }}/>
                </div>
              </div>
            )}

            {/* Run button */}
            <button onClick={runBacktest} disabled={loading}
              className="btn btn-green"
              style={{ padding: '8px 24px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? <Spinner size={14}/> : <Play size={14}/>}
              {loading ? `Running backtest on ${symbol}…` : `Run Backtest — ${symbol}`}
            </button>

            {error && (
              <div style={{ color: 'var(--red)', fontSize: 12, padding: '8px 12px', background: 'rgba(255,0,64,0.08)', borderRadius: 6, border: '1px solid rgba(255,0,64,0.25)' }}>
                {error}
              </div>
            )}
          </div>
        </TerminalCard>

        {/* Results */}
        {result && m && (
          <>
            {/* Summary header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-muted)' }}>
                {result.symbol} · {stratDef?.label} · {result.from} → {result.to} · {result.bars} bars
              </span>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Total Return"
                value={`${m.totalReturn >= 0 ? '+' : ''}${m.totalReturn.toFixed(2)}%`}
                color={m.totalReturn >= 0 ? 'var(--green)' : 'var(--red)'}
                sub={formatINR(result.finalCapital - result.initialCapital)}
              />
              <MetricCard
                label="Buy & Hold"
                value={`${m.buyHoldReturn >= 0 ? '+' : ''}${m.buyHoldReturn.toFixed(2)}%`}
                color={m.buyHoldReturn >= 0 ? 'var(--green)' : 'var(--red)'}
              />
              <MetricCard
                label="Alpha"
                value={`${m.alpha >= 0 ? '+' : ''}${m.alpha.toFixed(2)}%`}
                color={m.alpha >= 0 ? 'var(--cyan)' : 'var(--red)'}
                sub="vs Buy & Hold"
              />
              <MetricCard
                label="Win Rate"
                value={`${m.winRate.toFixed(1)}%`}
                color={m.winRate >= 55 ? 'var(--green)' : m.winRate >= 40 ? 'var(--amber)' : 'var(--red)'}
                sub={`${m.trades} trades`}
              />
              <MetricCard
                label="Max Drawdown"
                value={`−${m.maxDrawdown.toFixed(2)}%`}
                color={m.maxDrawdown > 20 ? 'var(--red)' : m.maxDrawdown > 10 ? 'var(--amber)' : 'var(--green)'}
              />
              <MetricCard label="Profit Factor" value={m.profitFactor >= 99 ? '∞' : m.profitFactor.toFixed(2)} color={m.profitFactor >= 1.5 ? 'var(--green)' : m.profitFactor >= 1 ? 'var(--amber)' : 'var(--red)'}/>
              <MetricCard label="Avg Win" value={`+${m.avgWin.toFixed(2)}%`} color="var(--green)"/>
              <MetricCard label="Avg Loss" value={`${m.avgLoss.toFixed(2)}%`} color="var(--red)"/>
              <MetricCard label="Final Capital" value={formatINR(result.finalCapital)} color={result.finalCapital >= result.initialCapital ? 'var(--green)' : 'var(--red)'}/>
            </div>

            {/* Equity curve */}
            <TerminalCard title="Equity Curve" icon={<Activity size={12}/>} accent="green">
              <EquityCurve equity={result.equity} initialCapital={result.initialCapital} />
              <div className="flex gap-6 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Start: {formatINR(result.initialCapital)}</span>
                <span style={{ color: result.finalCapital >= result.initialCapital ? 'var(--green)' : 'var(--red)' }}>
                  End: {formatINR(result.finalCapital)}
                </span>
                <span>Yellow dashed = initial capital</span>
              </div>
            </TerminalCard>

            {/* Trade log */}
            {result.trades.length > 0 && (
              <TerminalCard title={`Trade Log (${result.trades.length} trades)`} icon={<BarChart2 size={12}/>} accent="amber" noPadding>
                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                  <table className="term-table text-xs w-full">
                    <thead style={{ position: 'sticky', top: 0, background: '#111', zIndex: 5 }}>
                      <tr>
                        <th className="col-left">#</th>
                        <th className="col-left">Entry Date</th>
                        <th className="col-left">Exit Date</th>
                        <th className="col-right">Entry ₹</th>
                        <th className="col-right">Exit ₹</th>
                        <th className="col-right">P&L</th>
                        <th className="col-right">P&L %</th>
                        <th className="col-right">Holding</th>
                        <th className="col-left">Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : undefined }}>
                          <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>{t.entry}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>{t.exit}</td>
                          <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>₹{t.entryPrice.toFixed(2)}</td>
                          <td className="col-right" style={{ fontFamily: 'JetBrains Mono' }}>₹{t.exitPrice.toFixed(2)}</td>
                          <td className="col-right font-bold" style={{ fontFamily: 'JetBrains Mono', color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toFixed(2)}
                          </td>
                          <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: t.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                          </td>
                          <td className="col-right" style={{ color: 'var(--text-muted)' }}>{t.holding}d</td>
                          <td style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.signal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TerminalCard>
            )}

            {result.trades.length === 0 && (
              <TerminalCard title="Trade Log" accent="amber">
                <div className="py-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  No trades generated for this strategy and range. Try a longer range or different parameters.
                </div>
              </TerminalCard>
            )}
          </>
        )}
      </div>
    </>
  )
}
