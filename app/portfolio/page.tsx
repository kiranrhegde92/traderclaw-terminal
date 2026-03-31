'use client'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { useAuthStore } from '@/store'
import { openOrderModal } from '@/components/trade/OrderModal'
import TerminalCard  from '@/components/ui/TerminalCard'
import Topbar        from '@/components/layout/Topbar'
import Spinner       from '@/components/ui/Spinner'
import DailyReportCard from '@/components/reports/DailyReportCard'
import ReportSettings from '@/components/reports/ReportSettings'
import IntradayPnlChart from '@/components/portfolio/IntradayPnlChart'
import { formatINR, formatCompact, formatPct } from '@/lib/utils/format'
import {
  Briefcase, TrendingUp, TrendingDown, Upload, RefreshCw,
  ArrowUpRight, ArrowDownRight, BarChart2, PieChart,
  AlertTriangle, CheckCircle, Activity, Shield,
  DollarSign, Grid3x3, GitCompare, Sliders,
} from 'lucide-react'
import Link from 'next/link'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/* ─── Sector mapping for common Indian stocks ─────────────────────────── */
const SECTOR_MAP: Record<string, string> = {
  // IT
  TCS:'IT', INFY:'IT', WIPRO:'IT', HCLTECH:'IT', TECHM:'IT', LTIM:'IT', MPHASIS:'IT', COFORGE:'IT', PERSISTENT:'IT', LTTS:'IT',
  // Banking
  HDFCBANK:'Banking', ICICIBANK:'Banking', KOTAKBANK:'Banking', SBIN:'Banking', AXISBANK:'Banking', BANDHANBNK:'Banking', IDFCFIRSTB:'Banking', FEDERALBNK:'Banking', INDUSINDBK:'Banking', AUBANK:'Banking',
  // Finance / NBFC
  BAJFINANCE:'Finance', BAJAJFINSV:'Finance', CHOLAFIN:'Finance', MUTHOOTFIN:'Finance', SBICARD:'Finance', PFC:'Finance', RECLTD:'Finance', HDFCAMC:'Finance', ICICIGI:'Finance', HDFCLIFE:'Finance',
  // Pharma
  SUNPHARMA:'Pharma', DRREDDY:'Pharma', CIPLA:'Pharma', DIVISLAB:'Pharma', APOLLOHOSP:'Pharma', TORNTPHARM:'Pharma', LUPIN:'Pharma', BIOCON:'Pharma', AUROPHARMA:'Pharma', ALKEM:'Pharma',
  // Auto
  MARUTI:'Auto', TATAMOTORS:'Auto', M_M:'Auto', HEROMOTOCO:'Auto', BAJAJ_AUTO:'Auto', EICHERMOT:'Auto', ASHOKLEY:'Auto', TVSMOTOR:'Auto', BHARATFORG:'Auto', MOTHERSON:'Auto',
  // Energy / Oil
  RELIANCE:'Energy', ONGC:'Energy', NTPC:'Energy', POWERGRID:'Energy', BPCL:'Energy', IOC:'Energy', GAIL:'Energy', TATAPOWER:'Energy', ADANIGREEN:'Energy', ADANIPOWER:'Energy',
  // Metal & Mining
  TATASTEEL:'Metals', JSWSTEEL:'Metals', HINDALCO:'Metals', VEDL:'Metals', COALINDIA:'Metals', NMDC:'Metals', SAIL:'Metals', JINDALSTEL:'Metals',
  // FMCG
  HINDUNILVR:'FMCG', ITC:'FMCG', NESTLEIND:'FMCG', BRITANNIA:'FMCG', DABUR:'FMCG', GODREJCP:'FMCG', MARICO:'FMCG', COLPAL:'FMCG', EMAMILTD:'FMCG', VBL:'FMCG',
  // Infra / Cement
  ULTRACEMCO:'Cement', GRASIM:'Cement', AMBUJACEM:'Cement', ACC:'Cement', SHREECEM:'Cement',
  LT:'Infra', ADANIENT:'Infra', DLF:'Realty', GODREJPROP:'Realty', OBEROIRLTY:'Realty', PRESTIGE:'Realty',
  // Telecom
  BHARTIARTL:'Telecom', IDEA:'Telecom',
  // Consumer / Retail
  TITAN:'Consumer', TRENT:'Consumer', DMART:'Consumer', NYKAA:'Consumer', ZOMATO:'Consumer', JUBLFOOD:'Consumer',
  // Chemicals
  PIDILITIND:'Chemicals', ASIANPAINT:'Chemicals', BERGERPAINTS:'Chemicals', NAVINFLUOR:'Chemicals', DEEPAKNTR:'Chemicals',
}

function getSector(sym: string): string {
  const clean = sym.replace(/-EQ$/i, '').replace(/[&]/g, '_')
  return SECTOR_MAP[clean] ?? 'Others'
}

interface Holding {
  tradingsymbol:     string
  companynamewithexchange?: string
  quantity:          number
  averageprice:      number
  ltp:               number
  profitandloss:     number
  pnlpercentage:     number
  exchange:          string
  instrumenttype?:   string
  product?:          string
}

interface UploadedHolding {
  symbol:   string
  name:     string
  quantity: number
  avgPrice: number
  exchange: string
}

interface DisplayHolding {
  symbol:   string
  name:     string
  qty:      number
  avg:      number
  ltp:      number
  pnl:      number
  pnlPct:   number
  exchange: string
  invested: number
  current:  number
  sector:   string
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function PortfolioPage() {
  const [tab,          setTab]         = useState<'live' | 'upload' | 'analysis' | 'returns' | 'correlation' | 'dividends' | 'rebalancing'>('live')
  const [uploadData,   setUploadData]  = useState<UploadedHolding[] | null>(null)
  const [uploading,    setUploading]   = useState(false)
  const [uploadError,  setUploadError] = useState('')
  const [sortKey,      setSortKey]     = useState<'pnlPct'|'pnl'|'current'|'symbol'>('current')
  const [sortDir,      setSortDir]     = useState<1|-1>(-1)
  const [reportSettingsOpen, setReportSettingsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isConnected, isOfflineMode, setSession } = useAuthStore()

  // Always fetch — the API returns source:'unavailable' when no broker is connected.
  // Never gate the SWR key on Zustand state: Zustand's persist hydrates async and
  // causes a stale-null-key race with React SSR hydration suppression.
  const { data, isLoading, mutate } = useSWR(
    '/api/portfolio/holdings',
    fetcher,
    { refreshInterval: 30000 }
  )

  // Portfolio summary gives us today's P&L (change from previous close), not total unrealized
  const { data: summaryData } = useSWR('/api/portfolio/summary', fetcher, { refreshInterval: 30000 })
  const todayPnL    = summaryData?.todayPnl    ?? 0
  const todayPnLPct = summaryData?.todayPnlPct ?? 0
  const totalCost   = summaryData?.totalCost   ?? 0

  // Sync session: if the API says connected but Zustand doesn't know yet, restore it
  useEffect(() => {
    if (isConnected) return
    if (data?.source && data.source !== 'unavailable' && data.source !== 'error') {
      // Holdings came back from a live broker — restore Zustand session from DB
      fetch('/api/auth/session')
        .then(r => r.json())
        .then(sessionData => {
          if (sessionData.connected && sessionData.jwtToken) {
            setSession({
              jwtToken:  sessionData.jwtToken,
              feedToken: sessionData.feedToken ?? '',
              clientId:  sessionData.clientCode ?? '',
              profile:   sessionData.profile ?? { name: '', email: '' },
            })
          }
        })
        .catch(() => {})
    }
  }, [data?.source]) // eslint-disable-line react-hooks/exhaustive-deps

  const source      = data?.source ?? 'unavailable'
  const rawHoldings = (Array.isArray(data?.data?.holdings) ? data.data.holdings : []) as Holding[]
  const positions   = (data?.data?.positions ?? []) as any[]

  const holdings = rawHoldings.filter(h => !h.instrumenttype || h.instrumenttype === 'EQ')

  /* ── derived totals ── */
  const totalInvested = holdings.reduce((s, h) => s + h.quantity * h.averageprice, 0)
  const totalCurrent  = holdings.reduce((s, h) => s + h.quantity * (h.ltp || h.averageprice), 0)
  const totalPnL      = totalCurrent - totalInvested
  const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  const gainers = [...holdings].sort((a, b) => b.pnlpercentage - a.pnlpercentage).slice(0, 5)
  const losers  = [...holdings].sort((a, b) => a.pnlpercentage - b.pnlpercentage).slice(0, 5)

  // Record intraday P&L snapshot — uses todayPnL (change from prev close), not total unrealized
  const lastSnappedPnl = useRef<number | null>(null)
  useEffect(() => {
    if (!isConnected || totalCost === 0) return
    if (lastSnappedPnl.current === todayPnL) return
    lastSnappedPnl.current = todayPnL
    fetch('/api/portfolio/pnl-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnl: todayPnL, invested: totalCost }),
    }).catch(() => {})
  }, [todayPnL, totalCost, isConnected])

  /* ── normalised display list ── */
  const allDisplay: DisplayHolding[] = useMemo(() => {
    const base =
      tab !== 'upload' || !uploadData
        ? holdings.map(h => ({
            symbol:   h.tradingsymbol.replace(/-EQ$/i, ''),
            name:     h.companynamewithexchange ?? h.tradingsymbol.replace(/-EQ$/i, ''),
            qty:      h.quantity,
            avg:      h.averageprice,
            ltp:      h.ltp || h.averageprice,
            pnl:      h.profitandloss,
            pnlPct:   h.pnlpercentage,
            exchange: h.exchange,
            invested: h.quantity * h.averageprice,
            current:  h.quantity * (h.ltp || h.averageprice),
            sector:   getSector(h.tradingsymbol),
          }))
        : uploadData.map(h => ({
            symbol:   h.symbol,
            name:     h.name,
            qty:      h.quantity,
            avg:      h.avgPrice,
            ltp:      h.avgPrice,
            pnl:      0,
            pnlPct:   0,
            exchange: h.exchange,
            invested: h.quantity * h.avgPrice,
            current:  h.quantity * h.avgPrice,
            sector:   getSector(h.symbol),
          }))

    return [...base].sort((a, b) => {
      const va = a[sortKey] as number | string
      const vb = b[sortKey] as number | string
      if (typeof va === 'string') return sortDir * va.localeCompare(vb as string)
      return sortDir * ((va as number) - (vb as number))
    })
  }, [holdings, uploadData, tab, sortKey, sortDir])

  const displayHoldings = allDisplay  // alias for table

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(k); setSortDir(-1) }
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/portfolio/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setUploadData(json.data?.holdings ?? [])
      setTab('upload')
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  /* ──────────────────────────────────────────── */

  return (
    <>
      <Topbar title="Portfolio" />
      <div className="page-content space-y-4">

        {/* Source badge + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`badge ${['openalgo','angelone','zerodha'].includes(source) ? 'badge-green' : source === 'error' ? 'badge-red' : 'badge-dim'}`}>
            {source === 'openalgo'  ? '● OpenAlgo Live'
              : source === 'angelone' ? '● Angel One Live'
              : source === 'zerodha'  ? '● Zerodha Live'
              : source === 'error'    ? '⚠ Broker Error'
              : '○ Not Connected'}
          </span>
          {(source === 'unavailable' || source === 'error') && (
            <Link href="/connect" className="btn btn-sm btn-cyan" style={{ textDecoration: 'none' }}>
              Connect Broker →
            </Link>
          )}
          <button onClick={() => mutate()} className="btn btn-sm btn-ghost ml-auto">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab('live')}          className={`btn btn-sm ${tab === 'live'          ? 'btn-cyan'  : 'btn-ghost'}`}>
            <Briefcase size={11}/> Live Holdings
          </button>
          <button onClick={() => setTab('analysis')}      className={`btn btn-sm ${tab === 'analysis'      ? 'btn-amber' : 'btn-ghost'}`}>
            <BarChart2 size={11}/> Analysis
          </button>
          <button onClick={() => setTab('returns')}       className={`btn btn-sm ${tab === 'returns'       ? 'btn-green' : 'btn-ghost'}`}>
            <TrendingUp size={11}/> Returns
          </button>
          <button onClick={() => setTab('correlation')}   className={`btn btn-sm ${tab === 'correlation'   ? 'btn-amber' : 'btn-ghost'}`}>
            <Grid3x3 size={11}/> Correlation
          </button>
          <button onClick={() => setTab('dividends')}     className={`btn btn-sm ${tab === 'dividends'     ? 'btn-cyan'  : 'btn-ghost'}`}>
            <DollarSign size={11}/> Dividends
          </button>
          <button onClick={() => setTab('rebalancing')}   className={`btn btn-sm ${tab === 'rebalancing'   ? 'btn-green' : 'btn-ghost'}`}>
            <Sliders size={11}/> Rebalancing
          </button>
          <button onClick={() => setTab('upload')}        className={`btn btn-sm ${tab === 'upload'        ? 'btn-ghost' : 'btn-ghost'}`}>
            <Upload size={11}/> Uploaded
          </button>
          <div className="ml-auto flex gap-2 items-center">
            {uploading && <Spinner size={14}/>}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf"
              onChange={handleFileUpload} className="hidden" id="portfolio-upload"/>
            <label htmlFor="portfolio-upload" className="btn btn-sm btn-ghost cursor-pointer">
              <Upload size={11}/> Import File
            </label>
            {uploadError && <span className="text-xs" style={{ color: 'var(--red)' }}>{uploadError}</span>}
          </div>
        </div>

        {isLoading && tab !== 'upload' && (
          <div className="flex justify-center py-16">
            <Spinner size={24}/>
            <span className="ml-3 text-xs" style={{ color: 'var(--text-muted)' }}>Loading portfolio…</span>
          </div>
        )}

        {/* ── Not Connected / Error empty state ── */}
        {!isLoading && tab === 'live' && (source === 'unavailable' || source === 'error') && (
          <TerminalCard title="Portfolio" icon={<Briefcase size={12}/>} accent="cyan">
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div style={{ fontSize: 48 }}>📡</div>
              <div className="text-center">
                <div className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                  {source === 'error' ? 'Broker Connection Error' : 'No Broker Connected'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {data?.error ?? data?.message ?? 'Connect OpenAlgo or Angel One to see your real holdings'}
                </div>
              </div>
              <Link href="/connect" className="btn btn-cyan" style={{ textDecoration: 'none' }}>
                Connect Broker →
              </Link>
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Or use <strong>Import File</strong> above to upload your broker statement
              </div>
            </div>
          </TerminalCard>
        )}

        {/* ── Daily Report Card ── */}
        {tab === 'live' && !isLoading && (
          <DailyReportCard
            accountId={1}
            onSettingsClick={() => setReportSettingsOpen(true)}
            brokerUnrealizedPnl={isConnected ? todayPnL : undefined}
            brokerInvested={isConnected ? totalCost : undefined}
          />
        )}

        {/* ── Intraday P&L Chart ── */}
        {tab === 'live' && !isLoading && isConnected && (
          <IntradayPnlChart
            currentPnl={todayPnL}
            currentInvested={totalCost}
          />
        )}

        {/* ── Summary Cards (all tabs except upload) ── */}
        {tab !== 'upload' && !isLoading && holdings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Invested"      value={formatINR(totalInvested, true)} />
            <SummaryCard label="Current Value" value={formatINR(totalCurrent, true)} />
            <SummaryCard label="Total P&L"     value={formatINR(Math.abs(totalPnL), true)}
              sign={totalPnL} prefix={totalPnL >= 0 ? '+' : '−'} />
            <SummaryCard label="Returns"       value={`${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`}
              sign={totalPnLPct} />
          </div>
        )}

        {/* ══ LIVE HOLDINGS TAB ══════════════════════════════════════════ */}
        {(tab === 'live' || tab === 'upload') && !isLoading && (holdings.length > 0 || tab === 'upload') && (
          <div className="grid grid-cols-12 gap-4">

            {/* Holdings Table */}
            <div className="col-span-12 lg:col-span-8">
              <TerminalCard
                title={`Holdings (${displayHoldings.length})`}
                icon={<Briefcase size={12}/>} accent="cyan" noPadding>
                <div className="overflow-auto">
                  <table className="term-table text-xs">
                    <thead>
                      <tr>
                        <th className="col-left cursor-pointer" onClick={() => toggleSort('symbol')}>
                          Symbol {sortKey==='symbol' ? (sortDir===1?'↑':'↓') : ''}
                        </th>
                        <th className="col-right">Qty</th>
                        <th className="col-right">Avg</th>
                        {tab === 'live' && <th className="col-right">LTP</th>}
                        {tab === 'live' && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('pnl')}>
                            P&L {sortKey==='pnl' ? (sortDir===1?'↑':'↓') : ''}
                          </th>
                        )}
                        {tab === 'live' && (
                          <th className="col-right cursor-pointer" onClick={() => toggleSort('pnlPct')}>
                            P&L% {sortKey==='pnlPct' ? (sortDir===1?'↑':'↓') : ''}
                          </th>
                        )}
                        <th className="col-right cursor-pointer" onClick={() => toggleSort('current')}>
                          Value {sortKey==='current' ? (sortDir===1?'↑':'↓') : ''}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayHoldings.map(h => (
                        <tr key={h.symbol}>
                          <td>
                            <div className="font-bold" style={{ color: 'var(--cyan)' }}>{h.symbol}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                              {h.sector} · {h.exchange}
                            </div>
                          </td>
                          <td className="col-right font-mono">{h.qty}</td>
                          <td className="col-right font-mono">₹{h.avg.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          {tab === 'live' && (
                            <td className="col-right font-mono">₹{h.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          )}
                          {tab === 'live' && (
                            <td className="col-right font-mono" style={{ color: h.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {h.pnl >= 0 ? '+' : '−'}{formatINR(Math.abs(h.pnl), true)}
                            </td>
                          )}
                          {tab === 'live' && (
                            <td className="col-right" style={{ color: h.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {h.pnlPct >= 0
                                ? <ArrowUpRight size={10} className="inline"/>
                                : <ArrowDownRight size={10} className="inline"/>}
                              {Math.abs(h.pnlPct).toFixed(2)}%
                            </td>
                          )}
                          <td className="col-right font-mono">
                            {formatINR(h.current, true)}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Link href={`/monitor?symbol=${h.symbol}`}
                                className="btn btn-sm btn-ghost" style={{ textDecoration:'none', padding:'2px 5px', fontSize:10 }}>
                                Chart
                              </Link>
                              <Link href={`/options?symbol=${h.symbol}`}
                                className="btn btn-sm btn-ghost" style={{ textDecoration:'none', padding:'2px 5px', fontSize:10 }}>
                                Opt
                              </Link>
                              <button onClick={() => openOrderModal({ symbol: h.symbol, txnType: 'SELL' })}
                                className="btn btn-sm" style={{ padding:'2px 5px', fontSize:10,
                                  background:'rgba(255,0,64,0.1)', color:'var(--red)',
                                  border:'1px solid rgba(255,0,64,0.3)', borderRadius:3, cursor:'pointer' }}>
                                Sell
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {displayHoldings.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                            {tab === 'upload' ? 'No file uploaded yet. Click "Import File".' : 'No holdings found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TerminalCard>
            </div>

            {/* Right Panel */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              {tab === 'live' && gainers.length > 0 && (
                <TerminalCard title="Top Gainers" icon={<TrendingUp size={12}/>} accent="green">
                  <div className="space-y-1">
                    {gainers.map(h => (
                      <div key={h.tradingsymbol} className="flex items-center justify-between">
                        <Link href={`/monitor?symbol=${h.tradingsymbol.replace(/-EQ$/i,'')}`}
                          className="text-xs font-bold" style={{ color:'var(--cyan)', textDecoration:'none' }}>
                          {h.tradingsymbol.replace(/-EQ$/i,'')}
                        </Link>
                        <span className="text-xs font-mono" style={{ color:'var(--green)' }}>
                          +{h.pnlpercentage.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </TerminalCard>
              )}

              {tab === 'live' && losers.length > 0 && (
                <TerminalCard title="Top Losers" icon={<TrendingDown size={12}/>} accent="red">
                  <div className="space-y-1">
                    {losers.map(h => (
                      <div key={h.tradingsymbol} className="flex items-center justify-between">
                        <Link href={`/monitor?symbol=${h.tradingsymbol.replace(/-EQ$/i,'')}`}
                          className="text-xs font-bold" style={{ color:'var(--cyan)', textDecoration:'none' }}>
                          {h.tradingsymbol.replace(/-EQ$/i,'')}
                        </Link>
                        <span className="text-xs font-mono" style={{ color:'var(--red)' }}>
                          {h.pnlpercentage.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </TerminalCard>
              )}

              {displayHoldings.length > 0 && (
                <TerminalCard title="Allocation" accent="cyan">
                  <AllocationBars holdings={displayHoldings} />
                </TerminalCard>
              )}

              {tab === 'live' && positions.length > 0 && (
                <TerminalCard title={`Positions (${positions.length})`} accent="amber">
                  <div className="space-y-1">
                    {positions.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded"
                        style={{ background:'#0a0a0a', border:'1px solid #1e1e1e' }}>
                        <div>
                          <span className="font-bold" style={{ color:'var(--amber)' }}>{p.tradingsymbol}</span>
                          <span className="ml-2" style={{ color:'var(--text-dim)' }}>{p.netqty ?? p.quantity} qty</span>
                        </div>
                        <span style={{ color:(p.unrealised ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontFamily:'JetBrains Mono' }}>
                          {(p.unrealised ?? 0) >= 0 ? '+' : '−'}{formatINR(Math.abs(p.unrealised ?? 0), true)}
                        </span>
                      </div>
                    ))}
                  </div>
                </TerminalCard>
              )}

              <TerminalCard title="Quick Actions" >
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/screener"    className="btn btn-ghost text-center" style={{ textDecoration:'none', fontSize:11 }}>📊 Screener</Link>
                  <Link href="/options"     className="btn btn-cyan  text-center" style={{ textDecoration:'none', fontSize:11 }}>⚡ Options</Link>
                  <Link href="/strategies"  className="btn btn-amber text-center" style={{ textDecoration:'none', fontSize:11 }}>🎯 Strategies</Link>
                  <Link href="/paper-trade" className="btn btn-green text-center" style={{ textDecoration:'none', fontSize:11 }}>📋 Paper Trade</Link>
                </div>
              </TerminalCard>
            </div>
          </div>
        )}

        {/* ══ ANALYSIS TAB ═══════════════════════════════════════════════ */}
        {tab === 'analysis' && !isLoading && displayHoldings.length > 0 && (
          <AnalysisPanel holdings={displayHoldings} totalInvested={totalInvested} totalCurrent={totalCurrent} totalPnL={totalPnL} />
        )}
        {tab === 'analysis' && !isLoading && displayHoldings.length === 0 && (
          <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>
            No holdings to analyse. Connect a broker or upload a file.
          </div>
        )}

        {/* ══ RETURNS TAB ════════════════════════════════════════════════ */}
        {tab === 'returns' && !isLoading && displayHoldings.length > 0 && (
          <ReturnsPanel holdings={displayHoldings} totalInvested={totalInvested} totalCurrent={totalCurrent} />
        )}
        {tab === 'returns' && !isLoading && displayHoldings.length === 0 && (
          <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>No holdings. Connect a broker or upload a file.</div>
        )}

        {/* ══ CORRELATION TAB ════════════════════════════════════════════ */}
        {tab === 'correlation' && !isLoading && displayHoldings.length > 0 && (
          <CorrelationPanel holdings={displayHoldings} />
        )}
        {tab === 'correlation' && !isLoading && displayHoldings.length === 0 && (
          <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>No holdings. Connect a broker or upload a file.</div>
        )}

        {/* ══ DIVIDENDS TAB ══════════════════════════════════════════════ */}
        {tab === 'dividends' && (
          <DividendsPanel holdings={displayHoldings} />
        )}

        {/* ══ REBALANCING TAB ════════════════════════════════════════════ */}
        {tab === 'rebalancing' && !isLoading && displayHoldings.length > 0 && (
          <RebalancingPanel holdings={displayHoldings} totalCurrent={totalCurrent} />
        )}
        {tab === 'rebalancing' && !isLoading && displayHoldings.length === 0 && (
          <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>No holdings. Connect a broker or upload a file.</div>
        )}

      </div>

      {/* Report Settings Modal */}
      <ReportSettings
        accountId={1}
        isOpen={reportSettingsOpen}
        onClose={() => setReportSettingsOpen(false)}
      />
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Analysis Panel ─────────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

function AnalysisPanel({ holdings, totalInvested, totalCurrent, totalPnL }:
  { holdings: DisplayHolding[]; totalInvested: number; totalCurrent: number; totalPnL: number }) {

  /* ── Health Score ── */
  const n              = holdings.length
  const winners        = holdings.filter(h => h.pnlPct >= 0)
  const losersL        = holdings.filter(h => h.pnlPct < 0)
  const winRate        = n > 0 ? (winners.length / n) * 100 : 0
  const sorted         = [...holdings].sort((a, b) => b.current - a.current)
  const top3Pct        = sorted.slice(0, 3).reduce((s, h) => s + h.current, 0) / (totalCurrent || 1) * 100
  const top1Pct        = sorted[0] ? sorted[0].current / (totalCurrent || 1) * 100 : 0
  const avgPnlPct      = n > 0 ? holdings.reduce((s, h) => s + h.pnlPct, 0) / n : 0
  const bestH          = [...holdings].sort((a, b) => b.pnlPct - a.pnlPct)[0]
  const worstH         = [...holdings].sort((a, b) => a.pnlPct - b.pnlPct)[0]

  // Herfindahl concentration index (0=diverse, 1=concentrated)
  const hhi = holdings.reduce((s, h) => {
    const wt = totalCurrent > 0 ? h.current / totalCurrent : 0
    return s + wt * wt
  }, 0)
  const diversScore = Math.max(0, Math.min(100, (1 - hhi) * 100 * (n / Math.max(n, 10))))

  // health score: diversification(30) + win-rate(30) + return(40)
  const retScore   = Math.min(40, Math.max(0, 20 + avgPnlPct * 2))
  const winScore   = (winRate / 100) * 30
  const divScore2  = (diversScore / 100) * 30
  const healthScore = Math.round(retScore + winScore + divScore2)

  const healthColor = healthScore >= 70 ? 'var(--green)' : healthScore >= 45 ? 'var(--amber)' : 'var(--red)'
  const healthLabel = healthScore >= 70 ? 'Strong' : healthScore >= 45 ? 'Moderate' : 'Weak'

  /* ── Sector allocation ── */
  const sectorMap: Record<string, number> = {}
  holdings.forEach(h => {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.current
  })
  const sectors = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1])

  /* ── Return distribution buckets ── */
  const buckets: Record<string, DisplayHolding[]> = {
    '>+20%': [], '+10-20%': [], '+5-10%': [], '0-+5%': [],
    '0 to −5%': [], '−5-10%': [], '−10-20%': [], '<−20%': [],
  }
  holdings.forEach(h => {
    const p = h.pnlPct
    if (p > 20)       buckets['>+20%'].push(h)
    else if (p > 10)  buckets['+10-20%'].push(h)
    else if (p > 5)   buckets['+5-10%'].push(h)
    else if (p >= 0)  buckets['0-+5%'].push(h)
    else if (p > -5)  buckets['0 to −5%'].push(h)
    else if (p > -10) buckets['−5-10%'].push(h)
    else if (p > -20) buckets['−10-20%'].push(h)
    else              buckets['<−20%'].push(h)
  })
  const maxBucket = Math.max(...Object.values(buckets).map(b => b.length), 1)

  /* ── Invested vs Current per stock ── */
  const maxVal = Math.max(...holdings.map(h => Math.max(h.invested, h.current)), 1)

  return (
    <div className="space-y-4">

      {/* Row 1: Health + Risk + Return Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Portfolio Health */}
        <TerminalCard title="Portfolio Health" icon={<Activity size={12}/>} accent="cyan">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl font-bold font-mono" style={{ color: healthColor }}>{healthScore}</div>
            <div>
              <div className="text-sm font-bold" style={{ color: healthColor }}>{healthLabel}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>out of 100</div>
            </div>
          </div>
          <div className="h-2 rounded-full mb-4" style={{ background: '#1a1a1a' }}>
            <div className="h-full rounded-full" style={{ width:`${healthScore}%`, background: healthColor }}/>
          </div>
          <div className="space-y-1 text-xs">
            <MetricRow label="Win Rate"       value={`${winRate.toFixed(0)}%`}           color={winRate >= 60 ? 'var(--green)' : winRate >= 40 ? 'var(--amber)' : 'var(--red)'} />
            <MetricRow label="Diversification" value={`${diversScore.toFixed(0)}/100`}   color={diversScore >= 60 ? 'var(--green)' : 'var(--amber)'} />
            <MetricRow label="Avg Return"     value={formatPct(avgPnlPct)}               color={avgPnlPct >= 0 ? 'var(--green)' : 'var(--red)'} />
            <MetricRow label="Holdings"       value={`${n} stocks`}                      color="var(--text-dim)" />
          </div>
        </TerminalCard>

        {/* Risk Metrics */}
        <TerminalCard title="Risk Metrics" icon={<Shield size={12}/>} accent="amber">
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ color:'var(--text-dim)' }}>Concentration (Top 1)</span>
                <span className="font-mono" style={{ color: top1Pct > 30 ? 'var(--red)' : 'var(--amber)' }}>{top1Pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background:'#1a1a1a' }}>
                <div className="h-full rounded-full" style={{ width:`${Math.min(top1Pct, 100)}%`, background: top1Pct > 30 ? 'var(--red)' : 'var(--amber)' }}/>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ color:'var(--text-dim)' }}>Top 3 Concentration</span>
                <span className="font-mono" style={{ color: top3Pct > 60 ? 'var(--red)' : 'var(--green)' }}>{top3Pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background:'#1a1a1a' }}>
                <div className="h-full rounded-full" style={{ width:`${Math.min(top3Pct, 100)}%`, background: top3Pct > 60 ? 'var(--red)' : 'var(--green)' }}/>
              </div>
            </div>
            <div className="pt-2 space-y-1.5" style={{ borderTop:'1px solid #1a1a1a' }}>
              <MetricRow label="Winners / Losers" value={`${winners.length} / ${losersL.length}`} color="var(--text)" />
              <MetricRow label="Best Stock"
                value={bestH ? `${bestH.symbol} +${bestH.pnlPct.toFixed(1)}%` : '—'}
                color="var(--green)" />
              <MetricRow label="Worst Stock"
                value={worstH ? `${worstH.symbol} ${worstH.pnlPct.toFixed(1)}%` : '—'}
                color="var(--red)" />
              <MetricRow label="Unrealised P&L"
                value={`${totalPnL >= 0 ? '+' : '−'}${formatINR(Math.abs(totalPnL), true)}`}
                color={totalPnL >= 0 ? 'var(--green)' : 'var(--red)'} />
            </div>
          </div>
        </TerminalCard>

        {/* Sector Allocation */}
        <TerminalCard title="Sector Allocation" icon={<PieChart size={12}/>} accent="green">
          <div className="space-y-2">
            {sectors.slice(0, 8).map(([sec, val], i) => {
              const pct = totalCurrent > 0 ? val / totalCurrent * 100 : 0
              const COLORS = ['var(--cyan)','var(--green)','var(--amber)','var(--red)',
                              '#a78bfa','#f472b6','#34d399','#fb923c']
              return (
                <div key={sec}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: COLORS[i % COLORS.length] }}>{sec}</span>
                    <span style={{ color:'var(--text-dim)' }}>{pct.toFixed(1)}% · {formatINR(val, true)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background:'#1a1a1a' }}>
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background: COLORS[i % COLORS.length] }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </TerminalCard>
      </div>

      {/* Row 2: P&L Heatmap */}
      <TerminalCard title="P&L Heatmap" icon={<Activity size={12}/>} >
        <div className="flex flex-wrap gap-2">
          {[...holdings]
            .sort((a, b) => b.current - a.current)
            .map(h => {
              const intensity = Math.min(Math.abs(h.pnlPct) / 20, 1)
              const bg = h.pnlPct >= 0
                ? `rgba(0,255,65,${0.08 + intensity * 0.35})`
                : `rgba(255,0,64,${0.08 + intensity * 0.35})`
              const border = h.pnlPct >= 0 ? 'rgba(0,255,65,0.3)' : 'rgba(255,0,64,0.3)'
              const sizePx = Math.max(60, Math.min(120, (h.current / (totalCurrent || 1)) * 1500))
              return (
                <Link key={h.symbol} href={`/monitor?symbol=${h.symbol}`} style={{ textDecoration:'none' }}>
                  <div className="rounded p-2 text-center cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: bg, border: `1px solid ${border}`, width: sizePx, minHeight: 56 }}>
                    <div className="text-xs font-bold truncate" style={{ color:'var(--text)' }}>{h.symbol}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: h.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%
                    </div>
                    <div className="text-xs mt-0.5" style={{ color:'var(--text-muted)', fontSize:9 }}>
                      {formatINR(h.current, true)}
                    </div>
                  </div>
                </Link>
              )
            })}
        </div>
      </TerminalCard>

      {/* Row 3: Invested vs Current + Return Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Invested vs Current per stock */}
        <TerminalCard title="Invested vs Current Value" icon={<BarChart2 size={12}/>} accent="cyan">
          <div className="space-y-2">
            {[...holdings]
              .sort((a, b) => b.current - a.current)
              .slice(0, 12)
              .map(h => (
                <div key={h.symbol}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color:'var(--text-dim)' }}>{h.symbol}</span>
                    <span style={{ color: h.pnlPct >= 0 ? 'var(--green)' : 'var(--red)', fontFamily:'JetBrains Mono' }}>
                      {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%
                    </span>
                  </div>
                  {/* Invested bar */}
                  <div className="h-2 rounded-full mb-0.5" style={{ background:'#1a1a1a' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${(h.invested / maxVal) * 100}%`,
                      background: 'rgba(100,100,120,0.6)',
                    }}/>
                  </div>
                  {/* Current bar */}
                  <div className="h-2 rounded-full" style={{ background:'#1a1a1a' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(h.current / maxVal) * 100}%`,
                      background: h.pnlPct >= 0 ? 'rgba(0,255,65,0.6)' : 'rgba(255,0,64,0.6)',
                    }}/>
                  </div>
                </div>
              ))}
            <div className="flex gap-4 pt-1 text-xs" style={{ color:'var(--text-muted)' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span className="inline-block w-3 h-2 rounded" style={{ background:'rgba(100,100,120,0.6)' }}/>Invested
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span className="inline-block w-3 h-2 rounded" style={{ background:'rgba(0,255,65,0.6)' }}/>Current
              </span>
            </div>
          </div>
        </TerminalCard>

        {/* Return Distribution */}
        <TerminalCard title="Return Distribution" icon={<BarChart2 size={12}/>} accent="amber">
          <div className="space-y-2">
            {Object.entries(buckets).map(([label, items]) => {
              const pct = (items.length / maxBucket) * 100
              const isPos = label.startsWith('+') || label.startsWith('>')
              const color = isPos ? 'var(--green)' : label.startsWith('0-') ? 'var(--cyan)' : 'var(--red)'
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className="text-xs w-20 text-right font-mono" style={{ color, flexShrink:0 }}>{label}</div>
                  <div className="flex-1 h-5 rounded" style={{ background:'#1a1a1a', position:'relative' }}>
                    <div className="h-full rounded transition-all" style={{ width:`${pct}%`, background: color, opacity:0.7 }}/>
                    {items.length > 0 && (
                      <div className="absolute inset-0 flex items-center px-2 text-xs font-mono"
                        style={{ color:'var(--text)' }}>
                        {items.length} · {items.slice(0,3).map(h=>h.symbol).join(', ')}{items.length > 3 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-mono w-4 text-right" style={{ color:'var(--text-dim)' }}>{items.length}</div>
                </div>
              )
            })}
          </div>
        </TerminalCard>

      </div>

      {/* Row 3b: Sector P&L Attribution */}
      <SectorPnLPanel holdings={holdings} totalPnL={totalPnL} />

      {/* Row 3c: Benchmark Comparison */}
      <BenchmarkPanel holdings={holdings} />

      {/* Row 4: Full sorted table with gain/loss bars */}
      <TerminalCard title="Stock Performance Ranking" icon={<TrendingUp size={12}/>}  noPadding>
        <div className="overflow-auto">
          <table className="term-table text-xs">
            <thead>
              <tr>
                <th className="col-left">#</th>
                <th className="col-left">Symbol</th>
                <th className="col-left">Sector</th>
                <th className="col-right">Invested</th>
                <th className="col-right">Current</th>
                <th className="col-right">P&L</th>
                <th className="col-right">Return</th>
                <th style={{ minWidth:120 }}>Performance</th>
              </tr>
            </thead>
            <tbody>
              {[...holdings]
                .sort((a, b) => b.pnlPct - a.pnlPct)
                .map((h, i) => {
                  const barMax  = Math.max(...holdings.map(x => Math.abs(x.pnlPct)), 1)
                  const barWide = (Math.abs(h.pnlPct) / barMax) * 100
                  return (
                    <tr key={h.symbol}>
                      <td className="col-left font-mono" style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td>
                        <Link href={`/monitor?symbol=${h.symbol}`} style={{ color:'var(--cyan)', textDecoration:'none', fontWeight:700 }}>
                          {h.symbol}
                        </Link>
                      </td>
                      <td style={{ color:'var(--text-muted)' }}>{h.sector}</td>
                      <td className="col-right font-mono">{formatINR(h.invested, true)}</td>
                      <td className="col-right font-mono">{formatINR(h.current, true)}</td>
                      <td className="col-right font-mono" style={{ color: h.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {h.pnl >= 0 ? '+' : '−'}{formatINR(Math.abs(h.pnl), true)}
                      </td>
                      <td className="col-right font-mono" style={{ color: h.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                      </td>
                      <td>
                        <div className="h-3 rounded" style={{ background:'#1a1a1a', maxWidth:120 }}>
                          <div className="h-full rounded" style={{
                            width:`${barWide}%`,
                            background: h.pnlPct >= 0 ? 'rgba(0,255,65,0.65)' : 'rgba(255,0,64,0.65)',
                          }}/>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </TerminalCard>

    </div>
  )
}

/* ── Sector P&L Attribution Panel ───────────────────────────────────── */

function SectorPnLPanel({ holdings, totalPnL }: { holdings: DisplayHolding[]; totalPnL: number }) {
  const sectorData = useMemo(() => {
    const map: Record<string, { pnl: number; invested: number; current: number; count: number; symbols: string[] }> = {}
    for (const h of holdings) {
      if (!map[h.sector]) map[h.sector] = { pnl: 0, invested: 0, current: 0, count: 0, symbols: [] }
      map[h.sector].pnl      += h.pnl
      map[h.sector].invested += h.invested
      map[h.sector].current  += h.current
      map[h.sector].count    += 1
      map[h.sector].symbols.push(h.symbol)
    }
    return Object.entries(map)
      .map(([sector, d]) => ({
        sector,
        pnl:      d.pnl,
        invested: d.invested,
        current:  d.current,
        count:    d.count,
        symbols:  d.symbols,
        pnlPct:   d.invested > 0 ? (d.pnl / d.invested) * 100 : 0,
        contribution: totalPnL !== 0 ? (d.pnl / Math.abs(totalPnL)) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl)
  }, [holdings, totalPnL])

  const maxAbsPnl = Math.max(...sectorData.map(s => Math.abs(s.pnl)), 1)

  if (!sectorData.length) return null

  const COLORS = ['var(--cyan)', 'var(--green)', 'var(--amber)', 'var(--red)',
                  '#a78bfa', '#f472b6', '#34d399', '#fb923c']

  return (
    <TerminalCard title="Sector P&L Attribution" icon={<PieChart size={12}/>} accent="amber">
      <div className="space-y-4">

        {/* Sector P&L waterfall bars */}
        <div className="space-y-2">
          {sectorData.map((s, i) => {
            const barWidth = (Math.abs(s.pnl) / maxAbsPnl) * 100
            const color    = s.pnl >= 0 ? 'var(--green)' : 'var(--red)'
            const colorI   = COLORS[i % COLORS.length]
            return (
              <div key={s.sector} className="flex items-center gap-3 text-xs">
                {/* Sector name + stocks */}
                <div style={{ width: 90, flexShrink: 0 }}>
                  <div style={{ color: colorI, fontWeight: 700 }}>{s.sector}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>{s.count} stocks</div>
                </div>
                {/* Bar */}
                <div className="flex-1" style={{ background: '#1a1a1a', borderRadius: 3, height: 20, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${barWidth}%`, height: '100%',
                    background: s.pnl >= 0 ? 'rgba(0,255,65,0.4)' : 'rgba(255,0,64,0.4)',
                    borderRight: `2px solid ${color}`,
                    transition: 'width 0.4s ease',
                  }}/>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                    paddingLeft: 8, fontSize: 9, color: 'var(--text-muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    {s.symbols.slice(0, 4).join(', ')}{s.symbols.length > 4 ? ` +${s.symbols.length - 4}` : ''}
                  </div>
                </div>
                {/* P&L */}
                <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color, fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                    {s.pnl >= 0 ? '+' : '−'}{formatINR(Math.abs(s.pnl), true)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                    {s.pnlPct >= 0 ? '+' : ''}{s.pnlPct.toFixed(1)}%
                  </div>
                </div>
                {/* Contribution */}
                <div style={{ width: 55, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                    {s.contribution >= 0 ? '+' : ''}{s.contribution.toFixed(1)}%
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>contrib</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Best: <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
              {sectorData[0]?.sector} ({sectorData[0]?.pnlPct >= 0 ? '+' : ''}{sectorData[0]?.pnlPct.toFixed(1)}%)
            </span>
          </div>
          {sectorData[sectorData.length - 1]?.pnl < 0 && (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Worst: <span style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                {sectorData[sectorData.length - 1].sector} ({sectorData[sectorData.length - 1].pnlPct.toFixed(1)}%)
              </span>
            </div>
          )}
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Profitable sectors: <span style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
              {sectorData.filter(s => s.pnl >= 0).length}/{sectorData.length}
            </span>
          </div>
        </div>
      </div>
    </TerminalCard>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Sub-components ──────────────────────────────────────────────────── */

function SummaryCard({ label, value, sign, prefix }: { label: string; value: string; sign?: number; prefix?: string }) {
  const color = sign === undefined ? 'var(--text)' : sign >= 0 ? 'var(--green)' : 'var(--red)'
  return (
    <div className="term-card p-4">
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {prefix}{value}
      </div>
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-mono" style={{ color }}>{value}</span>
    </div>
  )
}

function AllocationBars({ holdings }: { holdings: DisplayHolding[] }) {
  const totalVal = holdings.reduce((s, h) => s + h.current, 0)
  if (totalVal === 0) return null
  const sorted = [...holdings].sort((a, b) => b.current - a.current).slice(0, 8)
  const COLORS = ['var(--cyan)','var(--green)','var(--amber)','var(--red)',
                  '#a78bfa','#f472b6','#34d399','#fb923c']
  return (
    <div className="space-y-2">
      {sorted.map((h, i) => {
        const pct = (h.current / totalVal) * 100
        return (
          <div key={h.symbol}>
            <div className="flex justify-between text-xs mb-0.5">
              <span style={{ color: COLORS[i] }}>{h.symbol}</span>
              <span style={{ color: 'var(--text-dim)' }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: '#1a1a1a' }}>
              <div className="h-full rounded-full" style={{ width:`${pct}%`, background: COLORS[i] }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Feature 36: XIRR / Absolute Returns ────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

/* Approximate XIRR: (current/invested)^(365/days) - 1 */
function calcXIRR(invested: number, current: number, daysHeld: number): number {
  if (invested <= 0 || daysHeld <= 0) return 0
  const ratio = current / invested
  if (ratio <= 0) return -1
  return Math.pow(ratio, 365 / daysHeld) - 1
}

/* Mock buy dates — in real app these come from the broker API */
const MOCK_BUY_DATES: Record<string, string> = {
  TCS: '2022-03-15', INFY: '2022-06-10', HDFCBANK: '2021-11-20',
  ICICIBANK: '2023-01-05', WIPRO: '2022-09-18', RELIANCE: '2021-08-12',
  HINDUNILVR: '2022-04-22', ITC: '2023-03-30', SBIN: '2022-07-14',
  BAJFINANCE: '2021-12-08', KOTAKBANK: '2023-02-16', AXISBANK: '2022-10-25',
  SUNPHARMA: '2023-04-11', TITAN: '2022-01-19', NESTLEIND: '2021-09-03',
}

function getBuyDate(symbol: string): Date {
  if (MOCK_BUY_DATES[symbol]) return new Date(MOCK_BUY_DATES[symbol])
  // fallback: random date 180-900 days ago
  const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const daysAgo = 180 + (seed % 720)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d
}

function ReturnsPanel({ holdings, totalInvested, totalCurrent }:
  { holdings: DisplayHolding[]; totalInvested: number; totalCurrent: number }) {

  const today = new Date()

  const rows = holdings.map(h => {
    const buyDate  = getBuyDate(h.symbol)
    const daysHeld = Math.max(1, Math.floor((today.getTime() - buyDate.getTime()) / 86400000))
    const absReturn = h.current - h.invested
    const absReturnPct = h.invested > 0 ? (absReturn / h.invested) * 100 : 0
    const xirr = calcXIRR(h.invested, h.current, daysHeld) * 100
    return { ...h, buyDate, daysHeld, absReturn, absReturnPct, xirr }
  })

  /* Portfolio-level weighted XIRR */
  const portfolioXIRR = (() => {
    const totalDays = rows.reduce((s, r) => s + r.daysHeld * r.invested, 0)
    const weightedDays = totalInvested > 0 ? totalDays / totalInvested : 365
    return calcXIRR(totalInvested, totalCurrent, weightedDays) * 100
  })()

  const totalAbs    = totalCurrent - totalInvested
  const totalAbsPct = totalInvested > 0 ? (totalAbs / totalInvested) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="term-card p-4">
          <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Total Invested</div>
          <div className="text-lg font-bold font-mono" style={{ color:'var(--text)' }}>{formatINR(totalInvested, true)}</div>
        </div>
        <div className="term-card p-4">
          <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Current Value</div>
          <div className="text-lg font-bold font-mono" style={{ color:'var(--cyan)' }}>{formatINR(totalCurrent, true)}</div>
        </div>
        <div className="term-card p-4">
          <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Absolute Return</div>
          <div className="text-lg font-bold font-mono" style={{ color: totalAbs >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {totalAbs >= 0 ? '+' : '−'}{formatINR(Math.abs(totalAbs), true)}
            <span className="text-sm ml-1">({totalAbsPct >= 0 ? '+' : ''}{totalAbsPct.toFixed(2)}%)</span>
          </div>
        </div>
        <div className="term-card p-4">
          <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Portfolio XIRR</div>
          <div className="text-lg font-bold font-mono" style={{ color: portfolioXIRR >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {portfolioXIRR >= 0 ? '+' : ''}{portfolioXIRR.toFixed(2)}%
            <span className="text-xs ml-1" style={{ color:'var(--text-muted)' }}>p.a.</span>
          </div>
        </div>
      </div>

      {/* Holdings returns table */}
      <TerminalCard title="Returns per Holding" icon={<TrendingUp size={12}/>} noPadding>
        <div className="overflow-auto">
          <table className="term-table text-xs">
            <thead>
              <tr>
                <th className="col-left">Symbol</th>
                <th className="col-right">Buy Date</th>
                <th className="col-right">Days Held</th>
                <th className="col-right">Invested</th>
                <th className="col-right">Current</th>
                <th className="col-right">Abs Return (₹)</th>
                <th className="col-right">Abs Return (%)</th>
                <th className="col-right">XIRR (p.a.)</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.xirr - a.xirr).map(r => (
                <tr key={r.symbol}>
                  <td>
                    <div className="font-bold" style={{ color:'var(--cyan)' }}>{r.symbol}</div>
                    <div style={{ color:'var(--text-muted)', fontSize:10 }}>{r.sector}</div>
                  </td>
                  <td className="col-right font-mono" style={{ color:'var(--text-dim)' }}>
                    {r.buyDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                  </td>
                  <td className="col-right font-mono" style={{ color:'var(--text-dim)' }}>{r.daysHeld}d</td>
                  <td className="col-right font-mono">{formatINR(r.invested, true)}</td>
                  <td className="col-right font-mono">{formatINR(r.current, true)}</td>
                  <td className="col-right font-mono" style={{ color: r.absReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r.absReturn >= 0 ? '+' : '−'}{formatINR(Math.abs(r.absReturn), true)}
                  </td>
                  <td className="col-right font-mono" style={{ color: r.absReturnPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r.absReturnPct >= 0 ? '+' : ''}{r.absReturnPct.toFixed(2)}%
                  </td>
                  <td className="col-right font-mono font-bold" style={{ color: r.xirr >= 15 ? 'var(--green)' : r.xirr >= 0 ? 'var(--amber)' : 'var(--red)' }}>
                    {r.xirr >= 0 ? '+' : ''}{r.xirr.toFixed(2)}%
                  </td>
                </tr>
              ))}
              {/* Summary row */}
              <tr style={{ borderTop:'2px solid #2a2a2a', background:'#0d0d0d' }}>
                <td colSpan={3} className="font-bold" style={{ color:'var(--text)' }}>Portfolio Total</td>
                <td className="col-right font-mono font-bold">{formatINR(totalInvested, true)}</td>
                <td className="col-right font-mono font-bold" style={{ color:'var(--cyan)' }}>{formatINR(totalCurrent, true)}</td>
                <td className="col-right font-mono font-bold" style={{ color: totalAbs >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalAbs >= 0 ? '+' : '−'}{formatINR(Math.abs(totalAbs), true)}
                </td>
                <td className="col-right font-mono font-bold" style={{ color: totalAbsPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalAbsPct >= 0 ? '+' : ''}{totalAbsPct.toFixed(2)}%
                </td>
                <td className="col-right font-mono font-bold" style={{ color: portfolioXIRR >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {portfolioXIRR >= 0 ? '+' : ''}{portfolioXIRR.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </TerminalCard>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Feature 38: Benchmark Comparison (SVG line chart) ───────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

function BenchmarkPanel({ holdings }: { holdings: DisplayHolding[] }) {
  const { data } = useSWR('/api/market/index-history?symbol=NIFTY', fetcher)
  const niftyHistory: { date: string; close: number }[] = data?.data ?? []

  /* Generate mock portfolio cumulative return (30 days) */
  const portfolioHistory = useMemo(() => {
    if (holdings.length === 0) return []
    const today = new Date()
    const seed = holdings.reduce((s, h) => s + h.pnlPct, 0)
    const result: { date: string; value: number }[] = []
    let cum = 0
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      // Simulate portfolio drift based on overall PnL
      const noise = Math.sin((29 - i + seed) * 0.7) * 0.4
      cum += (holdings.reduce((s, h) => s + h.pnlPct, 0) / holdings.length / 30) + noise
      result.push({ date: d.toISOString().slice(0, 10), value: parseFloat(cum.toFixed(4)) })
    }
    return result
  }, [holdings])

  if (niftyHistory.length === 0 || portfolioHistory.length === 0) {
    return (
      <TerminalCard title="vs Benchmark (NIFTY 50)" icon={<GitCompare size={12}/>} accent="cyan">
        <div className="flex justify-center py-8"><Spinner size={16}/></div>
      </TerminalCard>
    )
  }

  const n = Math.min(niftyHistory.length, portfolioHistory.length)
  if (n < 2) return null
  const niftyVals = niftyHistory.slice(-n).map(d => d.close)
  const portVals  = portfolioHistory.slice(-n).map(d => d.value)
  const allVals   = [...niftyVals, ...portVals]
  const minV = allVals.length > 0 ? Math.min(...allVals) : 0
  const maxV = allVals.length > 0 ? Math.max(...allVals) : 1
  const range = maxV - minV || 1

  const W = 600, H = 180, PL = 48, PR = 16, PT = 12, PB = 32

  function toX(i: number) { return PL + (i / Math.max(n - 1, 1)) * (W - PL - PR) }
  function toY(v: number) { return PT + (1 - (v - minV) / range) * (H - PT - PB) }

  const portPath  = portVals.map((v, i)  => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const niftyPath = niftyVals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)}`+`,${toY(v).toFixed(1)}`).join(' ')

  /* Shaded area under portfolio line */
  const areaPath = portPath + ` L${toX(n-1).toFixed(1)},${(H-PB).toFixed(1)} L${toX(0).toFixed(1)},${(H-PB).toFixed(1)} Z`

  const portFinal  = portVals[portVals.length - 1]
  const niftyFinal = niftyVals[niftyVals.length - 1]
  const alpha      = portFinal - niftyFinal

  /* Y-axis labels */
  const yTicks = [minV, (minV + maxV) / 2, maxV]

  /* X-axis labels: first, mid, last */
  const xLabels = [
    { i: 0,        label: niftyHistory[niftyHistory.length - n]?.date?.slice(5) ?? '' },
    { i: Math.floor(n / 2), label: niftyHistory[niftyHistory.length - Math.floor(n / 2)]?.date?.slice(5) ?? '' },
    { i: n - 1,   label: niftyHistory[niftyHistory.length - 1]?.date?.slice(5) ?? '' },
  ]

  return (
    <TerminalCard title="vs Benchmark — Last 30 Days" icon={<GitCompare size={12}/>} accent="cyan">
      {/* Summary */}
      <div className="flex gap-6 mb-4 text-xs flex-wrap">
        <span>
          <span style={{ color:'var(--text-muted)' }}>Portfolio: </span>
          <span className="font-mono font-bold" style={{ color: portFinal >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {portFinal >= 0 ? '+' : ''}{portFinal.toFixed(2)}%
          </span>
        </span>
        <span>
          <span style={{ color:'var(--text-muted)' }}>NIFTY 50: </span>
          <span className="font-mono font-bold" style={{ color: niftyFinal >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {niftyFinal >= 0 ? '+' : ''}{niftyFinal.toFixed(2)}%
          </span>
        </span>
        <span>
          <span style={{ color:'var(--text-muted)' }}>Alpha: </span>
          <span className="font-mono font-bold" style={{ color: alpha >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
          </span>
        </span>
      </div>

      {/* SVG Chart */}
      <div style={{ overflowX:'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:320, height:'auto', display:'block' }}>
          <defs>
            <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)}
                stroke="#1e1e1e" strokeWidth="1"/>
              <text x={PL - 4} y={toY(v) + 4} textAnchor="end"
                fill="var(--text-muted)" fontSize="9">
                {v >= 0 ? '+' : ''}{v.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#portGrad)"/>

          {/* NIFTY line */}
          <path d={niftyPath} fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2"/>

          {/* Portfolio line */}
          <path d={portPath} fill="none" stroke="#3b82f6" strokeWidth="2"/>

          {/* X-axis labels */}
          {xLabels.map(({ i, label }) => (
            <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
              fill="var(--text-muted)" fontSize="9">{label}</text>
          ))}

          {/* Legend */}
          <g transform={`translate(${PL + 8}, ${PT + 6})`}>
            <line x1="0" y1="6" x2="18" y2="6" stroke="#3b82f6" strokeWidth="2"/>
            <text x="22" y="10" fill="var(--text-dim)" fontSize="9">Portfolio</text>
            <line x1="70" y1="6" x2="88" y2="6" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 2"/>
            <text x="92" y="10" fill="var(--text-dim)" fontSize="9">NIFTY 50</text>
          </g>
        </svg>
      </div>
    </TerminalCard>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Feature 37: Correlation Matrix ─────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

/* Deterministic pseudo-random from a string seed */
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

/* Stable deterministic correlation from symbol pair */
function stableCorr(sA: string, sB: string, secA: string, secB: string): number {
  if (sA === sB) return 1
  // Ensure symmetric: sort the pair
  const [p1, p2] = [sA, sB].sort()
  const seed = (p1 + p2).split('').reduce((s, c, i) => s + c.charCodeAt(0) * (i + 1), 0)
  const noise = (seededRand(seed) - 0.5) * 0.12

  const adjacent: Record<string, string[]> = {
    Banking: ['Finance'], Finance: ['Banking'],
    IT: ['Telecom'], Telecom: ['IT'],
    Pharma: ['Chemicals'], Chemicals: ['Pharma'],
    Energy: ['Metals'], Metals: ['Energy'],
    FMCG: ['Consumer'], Consumer: ['FMCG'],
  }

  let base: number
  if (secA === secB)                base = 0.70 + seededRand(seed + 1) * 0.20   // 0.70–0.90
  else if (adjacent[secA]?.includes(secB)) base = 0.35 + seededRand(seed + 2) * 0.15  // 0.35–0.50
  else                               base = 0.10 + seededRand(seed + 3) * 0.25  // 0.10–0.35

  return Math.max(-1, Math.min(1, base + noise))
}

function corrColor(v: number): string {
  // deep red (1), white (0), deep blue (-1)
  if (v > 0) {
    const r = Math.round(180 + v * 75)
    const gb = Math.round(255 - v * 200)
    return `rgb(${r},${gb},${gb})`
  } else {
    const b = Math.round(180 + Math.abs(v) * 75)
    const rg = Math.round(255 - Math.abs(v) * 200)
    return `rgb(${rg},${rg},${b})`
  }
}

function CorrelationPanel({ holdings }: { holdings: DisplayHolding[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Cap at 15 symbols for readability
  const syms = holdings.slice(0, 15)

  return (
    <TerminalCard title="Sector-Based Correlation Matrix" icon={<Grid3x3 size={12}/>} accent="amber">
      <p className="text-xs mb-3" style={{ color:'var(--text-muted)' }}>
        Correlation estimated from sector proximity. Same sector = high (0.7–0.9). Hover a cell for value.
      </p>
      <div style={{ overflowX:'auto', position:'relative' }}
        onMouseLeave={() => setTooltip(null)}>
        {/* Tooltip */}
        {tooltip && (
          <div className="fixed z-50 text-xs px-2 py-1 rounded pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 4, background:'#1a1a1a', border:'1px solid #333', color:'var(--text)', whiteSpace:'nowrap' }}>
            {tooltip.text}
          </div>
        )}
        <table style={{ borderCollapse:'collapse', fontSize:10 }}>
          <thead>
            <tr>
              <th style={{ minWidth:56, padding:'2px 4px', color:'var(--text-muted)', textAlign:'left' }}></th>
              {syms.map(s => (
                <th key={s.symbol} style={{ minWidth:44, maxWidth:52, padding:'2px 4px', color:'var(--text-dim)', fontSize:9, textAlign:'center', fontWeight:600 }}>
                  <div style={{ writingMode:'vertical-rl', transform:'rotate(180deg)', maxHeight:56, overflow:'hidden' }}>{s.symbol}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {syms.map(row => (
              <tr key={row.symbol}>
                <td style={{ padding:'2px 4px', color:'var(--text-dim)', fontSize:9, fontWeight:600, whiteSpace:'nowrap' }}>{row.symbol}</td>
                {syms.map(col => {
                  const v = stableCorr(row.symbol, col.symbol, row.sector, col.sector)
                  const bg = corrColor(v)
                  const textColor = Math.abs(v) > 0.5 ? '#fff' : '#888'
                  return (
                    <td key={col.symbol}
                      onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${row.symbol} vs ${col.symbol}: ${v.toFixed(2)}` })}
                      style={{ background: bg, width:44, height:28, textAlign:'center', cursor:'default', color: textColor, fontFamily:'JetBrains Mono', fontWeight:600, border:'1px solid #111' }}>
                      {v.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 text-xs" style={{ color:'var(--text-muted)' }}>
          <span>Correlation scale:</span>
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            <div style={{ width:16, height:12, background:'rgb(105,55,55)', borderRadius:2 }}/><span>+1.0</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            <div style={{ width:16, height:12, background:'rgb(255,255,255)', borderRadius:2 }}/><span>0</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            <div style={{ width:16, height:12, background:'rgb(55,55,105)', borderRadius:2 }}/><span>−1.0</span>
          </div>
        </div>
      </div>
    </TerminalCard>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Feature 39: Dividend Tracker ───────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

interface DividendRecord {
  symbol: string
  name: string
  exDate: string
  dividendPerShare: number
  yield: number
}

function DividendsPanel({ holdings }: { holdings: DisplayHolding[] }) {
  const { data, isLoading } = useSWR('/api/portfolio/dividends', fetcher)
  const dividends: DividendRecord[] = data?.data ?? []

  /* Match dividends to held stocks */
  const heldSymbols = new Set(holdings.map(h => h.symbol))

  const enriched = dividends
    .filter(d => heldSymbols.has(d.symbol))
    .map(d => {
      const holding = holdings.find(h => h.symbol === d.symbol)!
      const yourIncome = (holding?.qty ?? 0) * d.dividendPerShare
      return { ...d, qty: holding?.qty ?? 0, yourIncome }
    })
    .sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime())

  /* Also show upcoming dividends for stocks we might not hold */
  const upcomingAll = dividends
    .filter(d => !heldSymbols.has(d.symbol))
    .slice(0, 6)

  const totalExpected = enriched.reduce((s, d) => s + d.yourIncome, 0)

  if (isLoading) {
    return (
      <TerminalCard title="Dividend Tracker" icon={<DollarSign size={12}/>} accent="cyan">
        <div className="flex justify-center py-8"><Spinner size={16}/></div>
      </TerminalCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Your upcoming dividends */}
      <TerminalCard title="Upcoming Dividends — Your Holdings" icon={<DollarSign size={12}/>} accent="green" noPadding>
        <div className="overflow-auto">
          <table className="term-table text-xs">
            <thead>
              <tr>
                <th className="col-left">Stock</th>
                <th className="col-right">Ex-Date</th>
                <th className="col-right">Div/Share</th>
                <th className="col-right">Yield %</th>
                <th className="col-right">Your Shares</th>
                <th className="col-right">Your Income</th>
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center" style={{ color:'var(--text-muted)' }}>
                    No dividend-paying stocks found in your holdings.
                  </td>
                </tr>
              ) : (
                enriched.map(d => (
                  <tr key={d.symbol}>
                    <td>
                      <div className="font-bold" style={{ color:'var(--cyan)' }}>{d.symbol}</div>
                      <div style={{ color:'var(--text-muted)', fontSize:10 }}>{d.name}</div>
                    </td>
                    <td className="col-right font-mono" style={{ color:'var(--amber)' }}>
                      {new Date(d.exDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                    </td>
                    <td className="col-right font-mono">₹{d.dividendPerShare.toFixed(2)}</td>
                    <td className="col-right font-mono" style={{ color:'var(--green)' }}>{d.yield.toFixed(2)}%</td>
                    <td className="col-right font-mono">{d.qty}</td>
                    <td className="col-right font-mono font-bold" style={{ color:'var(--green)' }}>
                      {formatINR(d.yourIncome, true)}
                    </td>
                  </tr>
                ))
              )}
              {enriched.length > 0 && (
                <tr style={{ borderTop:'2px solid #2a2a2a', background:'#0d0d0d' }}>
                  <td colSpan={5} className="font-bold" style={{ color:'var(--text)' }}>Total Expected Income</td>
                  <td className="col-right font-mono font-bold" style={{ color:'var(--green)', fontSize:13 }}>
                    {formatINR(totalExpected, true)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TerminalCard>

      {/* Watch: dividends for stocks not in portfolio */}
      {upcomingAll.length > 0 && (
        <TerminalCard title="Dividend Opportunities (Not Held)" icon={<DollarSign size={12}/>} accent="amber" noPadding>
          <div className="overflow-auto">
            <table className="term-table text-xs">
              <thead>
                <tr>
                  <th className="col-left">Stock</th>
                  <th className="col-right">Ex-Date</th>
                  <th className="col-right">Div/Share</th>
                  <th className="col-right">Yield %</th>
                </tr>
              </thead>
              <tbody>
                {upcomingAll.map(d => (
                  <tr key={d.symbol}>
                    <td>
                      <div className="font-bold" style={{ color:'var(--amber)' }}>{d.symbol}</div>
                      <div style={{ color:'var(--text-muted)', fontSize:10 }}>{d.name}</div>
                    </td>
                    <td className="col-right font-mono" style={{ color:'var(--amber)' }}>
                      {new Date(d.exDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                    </td>
                    <td className="col-right font-mono">₹{d.dividendPerShare.toFixed(2)}</td>
                    <td className="col-right font-mono" style={{ color:'var(--green)' }}>{d.yield.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TerminalCard>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Feature 35: Sector Rebalancing Suggestions ─────────────────────── */
/* ══════════════════════════════════════════════════════════════════════ */

const TARGET_ALLOCATION: Record<string, number> = {
  IT:        25,
  Banking:   20,
  Finance:   10,
  Pharma:    10,
  FMCG:      15,
  Energy:     8,
  Auto:       7,
  Metals:     5,
  Others:     0,  // flexible
}

const SECTOR_COLORS: Record<string, string> = {
  IT:'var(--cyan)', Banking:'var(--green)', Finance:'#a78bfa', Pharma:'#f472b6',
  FMCG:'var(--amber)', Energy:'#fb923c', Auto:'var(--red)', Metals:'#34d399',
  Telecom:'#60a5fa', Cement:'#c084fc', Infra:'#e879f9', Realty:'#4ade80',
  Consumer:'#facc15', Chemicals:'#38bdf8', Others:'var(--text-dim)',
}

function RebalancingPanel({ holdings, totalCurrent }: { holdings: DisplayHolding[]; totalCurrent: number }) {
  /* Current allocation per sector */
  const currentSectors: Record<string, number> = {}
  holdings.forEach(h => {
    currentSectors[h.sector] = (currentSectors[h.sector] ?? 0) + h.current
  })

  const currentPct: Record<string, number> = {}
  Object.entries(currentSectors).forEach(([sec, val]) => {
    currentPct[sec] = totalCurrent > 0 ? (val / totalCurrent) * 100 : 0
  })

  /* All sectors from target + current */
  const allSectors = Array.from(new Set([...Object.keys(TARGET_ALLOCATION), ...Object.keys(currentPct)]))
    .filter(s => s !== 'Others' || (currentPct['Others'] ?? 0) > 0)

  const suggestions: string[] = []
  allSectors.forEach(sec => {
    const cur = currentPct[sec] ?? 0
    const tgt = TARGET_ALLOCATION[sec] ?? 0
    if (tgt === 0) return
    const diff = cur - tgt
    if (diff > 3)        suggestions.push(`Reduce ${sec} by ${diff.toFixed(1)}% (currently ${cur.toFixed(1)}%, target ${tgt}%)`)
    else if (diff < -3)  suggestions.push(`Add ${sec} exposure by ${Math.abs(diff).toFixed(1)}% (currently ${cur.toFixed(1)}%, target ${tgt}%)`)
  })

  const maxBar = Math.max(...allSectors.map(s => Math.max(currentPct[s] ?? 0, TARGET_ALLOCATION[s] ?? 0)), 1)

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <TerminalCard title="Sector Allocation vs Target" icon={<Sliders size={12}/>} accent="green">
        <div className="space-y-3">
          {allSectors.map(sec => {
            const cur = currentPct[sec] ?? 0
            const tgt = TARGET_ALLOCATION[sec] ?? 0
            const diff = cur - tgt
            const color = SECTOR_COLORS[sec] ?? 'var(--text-dim)'
            const overUnder = tgt > 0 ? (diff > 3 ? 'over' : diff < -3 ? 'under' : 'ok') : 'none'
            return (
              <div key={sec}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color }}>{sec}</span>
                  <span className="font-mono" style={{ color: overUnder === 'over' ? 'var(--red)' : overUnder === 'under' ? 'var(--amber)' : 'var(--green)' }}>
                    {cur.toFixed(1)}%
                    {tgt > 0 && <span style={{ color:'var(--text-muted)' }}> / {tgt}% target</span>}
                    {overUnder === 'over'  && <span style={{ color:'var(--red)' }}> ▲ +{diff.toFixed(1)}%</span>}
                    {overUnder === 'under' && <span style={{ color:'var(--amber)' }}> ▼ {diff.toFixed(1)}%</span>}
                    {overUnder === 'ok'    && <span style={{ color:'var(--green)' }}> ✓</span>}
                  </span>
                </div>
                {/* Current bar */}
                <div className="relative h-4 rounded" style={{ background:'#1a1a1a', marginBottom:2 }}>
                  <div className="absolute left-0 top-0 h-full rounded transition-all"
                    style={{ width:`${(cur / maxBar) * 100}%`, background: color, opacity:0.7 }}/>
                  {/* Target marker */}
                  {tgt > 0 && (
                    <div className="absolute top-0 h-full w-0.5"
                      style={{ left:`${(tgt / maxBar) * 100}%`, background:'rgba(255,255,255,0.5)' }}/>
                  )}
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-mono" style={{ color:'var(--text)', fontSize:9 }}>
                    {cur.toFixed(1)}% {tgt > 0 ? `| target ${tgt}%` : '(no target)'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs" style={{ color:'var(--text-muted)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span className="inline-block w-3 h-3 rounded" style={{ background:'rgba(255,255,255,0.5)' }}/> Target line
          </span>
        </div>
      </TerminalCard>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <TerminalCard title="Rebalancing Suggestions" icon={<AlertTriangle size={12}/>} accent="amber">
          <div className="space-y-2">
            {suggestions.map((s, i) => {
              const isReduce = s.startsWith('Reduce')
              return (
                <div key={i} className="flex items-start gap-2 text-xs p-2 rounded"
                  style={{ background: isReduce ? 'rgba(255,0,64,0.08)' : 'rgba(255,179,0,0.08)', border:`1px solid ${isReduce ? 'rgba(255,0,64,0.2)' : 'rgba(255,179,0,0.2)'}` }}>
                  <span style={{ color: isReduce ? 'var(--red)' : 'var(--amber)', fontSize:16, lineHeight:1 }}>
                    {isReduce ? '↓' : '↑'}
                  </span>
                  <span style={{ color:'var(--text)' }}>{s}</span>
                </div>
              )
            })}
          </div>
        </TerminalCard>
      )}
      {suggestions.length === 0 && (
        <TerminalCard title="Rebalancing Suggestions" icon={<CheckCircle size={12}/>} accent="green">
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color:'var(--green)' }}>
            <CheckCircle size={16}/> Portfolio is well-balanced across target allocations.
          </div>
        </TerminalCard>
      )}
    </div>
  )
}
