'use client'
import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import { formatPct, formatCompact } from '@/lib/utils/format'
import {
  TrendingUp, TrendingDown, Activity, BarChart2, Globe,
  ChevronUp, ChevronDown, Layers, RefreshCw, Zap,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Approximate market caps (₹ Lakh Cr) for treemap sizing
const SECTOR_MCAP: Record<string, number> = {
  'Nifty IT':          42,
  'Nifty Bank':        38,
  'Nifty Financial Services': 34,
  'Nifty Auto':        18,
  'Nifty Pharma':      17,
  'Nifty FMCG':        20,
  'Nifty Metal':       14,
  'Nifty Realty':       8,
  'Nifty Energy':      22,
  'Nifty Infra':       12,
  'Nifty Media':        3,
  'Nifty PSU Bank':    11,
  'Nifty Oil & Gas':   16,
  'Nifty Healthcare':  15,
  'Nifty Consumer Durables': 10,
}

const TABS = ['Overview', 'Indices', 'Movers', 'Sectors', 'FII / DII', 'Global', 'Heatmap', 'A/D Chart', '52W Extremes', 'Health History', 'Futures Premium'] as const
type Tab = typeof TABS[number]

/* ══════════════════════════════════════════════════════════════════════ */

export default function MarketPage() {
  const [tab,     setTab]     = useState<Tab>('Overview')
  const [glSort,  setGLSort]  = useState<{ key: string; dir: 1|-1 }>({ key: 'changePct', dir: -1 })
  const [llSort,  setLLSort]  = useState<{ key: string; dir: 1|-1 }>({ key: 'changePct', dir:  1 })
  const [idxSort, setIdxSort] = useState<{ key: string; dir: 1|-1 }>({ key: 'changePct', dir: -1 })

  const { data: idxRes, mutate: refIdx } = useSWR('/api/market/indices',           fetcher, { refreshInterval: 15000  })
  const { data: glRes,  mutate: refGL  } = useSWR('/api/market/gainers-losers',    fetcher, { refreshInterval: 30000  })
  const { data: fiiRes }                 = useSWR('/api/market/fii-dii',           fetcher, { refreshInterval: 3600000 })
  const { data: secRes }                 = useSWR('/api/market/sectors',           fetcher, { refreshInterval: 60000  })
  const { data: brdRes }                 = useSWR('/api/market/breadth',           fetcher, { refreshInterval: 30000  })
  const { data: gblRes }                 = useSWR('/api/market/global',            fetcher, { refreshInterval: 120000 })
  const { data: adRes  }                 = useSWR('/api/market/advance-decline',   fetcher, { refreshInterval: 60000  })
  const { data: w52Res }                 = useSWR('/api/market/52week',            fetcher, { refreshInterval: 300000 })
  const { data: hhRes  }                 = useSWR('/api/market/health-history',    fetcher, { refreshInterval: 300000 })
  const { data: giftRes }                = useSWR(tab === 'Futures Premium' ? '/api/market/gift-nifty' : null, fetcher, { refreshInterval: 30000 })

  const indices   = idxRes?.data  ?? []
  const gainers   = glRes?.data?.gainers  ?? []
  const losers    = glRes?.data?.losers   ?? []
  const fiidii    = fiiRes?.data ?? []
  const sectors   = secRes?.data ?? []
  const breadth   = brdRes?.data ?? { advances: 0, declines: 0, unchanged: 0 }
  const global    = gblRes?.data ?? []
  const adHistory = adRes?.data  ?? []
  const w52Near   = w52Res?.data ?? { nearHigh: [], nearLow: [] }
  const hhHistory = hhRes?.data  ?? []

  const todayFII   = fiidii[0]
  const recentFII  = fiidii.slice(0, 7)

  /* ── derived ── */
  const vix    = indices.find((i: any) => i.symbol === 'INDIA VIX')
  const nifty  = indices.find((i: any) => i.symbol === 'NIFTY 50')
  const bank   = indices.find((i: any) => i.symbol === 'NIFTY BANK')
  const vixVal = vix?.ltp ?? 0

  const vixCtx = vixVal > 25 ? { label:'Extreme Fear', c:'var(--red)' }
    : vixVal > 18 ? { label:'Fear',    c:'var(--red)' }
    : vixVal > 14 ? { label:'Neutral', c:'var(--amber)' }
    : vixVal > 10 ? { label:'Greed',   c:'var(--green)' }
    : { label:'Extreme Greed', c:'var(--green)' }

  const total  = breadth.advances + breadth.declines + breadth.unchanged || 1
  const adRatio = breadth.declines > 0 ? breadth.advances / breadth.declines : 0

  // Cumulative FII flow
  const cumFII = recentFII.reduce((s: number, d: any) => s + (d.fii_net ?? 0), 0)
  const cumDII = recentFII.reduce((s: number, d: any) => s + (d.dii_net ?? 0), 0)

  // Market health score (0-100)
  const healthScore = Math.round(
    Math.min(100, Math.max(0,
      (adRatio > 1 ? 30 : adRatio * 30) +
      (vixVal < 14 ? 20 : vixVal < 18 ? 15 : vixVal < 25 ? 8 : 0) +
      (cumFII > 0 ? 20 : 10) +
      (nifty?.changePct > 0 ? 30 : nifty?.changePct > -1 ? 20 : 10)
    ))
  )
  const healthColor = healthScore >= 65 ? 'var(--green)' : healthScore >= 40 ? 'var(--amber)' : 'var(--red)'
  const healthLabel = healthScore >= 65 ? 'Bullish' : healthScore >= 40 ? 'Neutral' : 'Bearish'

  // Sortable tables
  function sortedList(arr: any[], s: { key: string; dir: 1|-1 }) {
    return [...arr].sort((a, b) => s.dir * ((a[s.key] ?? 0) - (b[s.key] ?? 0)))
  }

  const sortedGainers  = useMemo(() => sortedList(gainers, glSort),  [gainers,  glSort])
  const sortedLosers   = useMemo(() => sortedList(losers,  llSort),  [losers,   llSort])
  const sortedIndices  = useMemo(() => sortedList(indices, idxSort), [indices,  idxSort])
  const sortedSectors  = useMemo(() => [...sectors].sort((a:any, b:any) => b.changePct - a.changePct), [sectors])

  function SortHdr({ label, k, state, set }: { label:string; k:string; state:any; set:any }) {
    return (
      <th className="col-right cursor-pointer select-none" onClick={() => set((p: any) => ({
        key: k, dir: p.key === k ? -p.dir as 1|-1 : -1
      }))}>
        {label} {state.key === k ? (state.dir === -1 ? <ChevronDown size={9} className="inline"/> : <ChevronUp size={9} className="inline"/>) : ''}
      </th>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════ */

  return (
    <>
      <Topbar title="Market" />
      <div className="page-content space-y-4">

        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`btn btn-sm ${tab === t ? 'btn-cyan' : 'btn-ghost'}`}>
              {t}
            </button>
          ))}
          <button onClick={() => { refIdx(); refGL() }} className="btn btn-sm btn-ghost ml-auto">
            <RefreshCw size={10}/> Refresh
          </button>
        </div>

        {/* ══ OVERVIEW ═══════════════════════════════════════════════════ */}
        {tab === 'Overview' && (
          <div className="space-y-4">

            {/* Market health + key stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Market Health" value={`${healthScore}/100`} sub={healthLabel} color={healthColor}/>
              <StatCard label="Nifty 50"
                value={nifty ? nifty.ltp.toLocaleString('en-IN') : '—'}
                sub={nifty ? `${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct.toFixed(2)}%` : ''}
                color={nifty?.changePct >= 0 ? 'var(--green)' : 'var(--red)'}/>
              <StatCard label="India VIX"
                value={vixVal.toFixed(2)}
                sub={vixCtx.label}
                color={vixCtx.c}/>
              <StatCard label="A/D Ratio"
                value={adRatio.toFixed(2)}
                sub={`${breadth.advances}↑ / ${breadth.declines}↓`}
                color={adRatio > 1.2 ? 'var(--green)' : adRatio < 0.8 ? 'var(--red)' : 'var(--amber)'}/>
            </div>

            {/* Sector heatmap full */}
            <TerminalCard title="Sector Heatmap" icon={<BarChart2 size={12}/>}  noPadding>
              <div className="flex flex-wrap">
                {sortedSectors.map((s: any) => {
                  const up  = s.changePct >= 0
                  const mag = Math.min(Math.abs(s.changePct) / 3, 1)
                  return (
                    <div key={s.name} className="flex-1 text-center py-4 px-3 border-r border-b last:border-r-0"
                      style={{
                        minWidth: 90,
                        background: up ? `rgba(0,255,65,${0.05 + mag*0.25})` : `rgba(255,0,64,${0.05 + mag*0.25})`,
                        borderColor: '#1a1a1a',
                      }}>
                      <div className="text-xs font-bold" style={{ color:'var(--text-dim)', fontSize:10 }}>{s.name}</div>
                      <div className="text-sm font-bold font-mono mt-1"
                        style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                        {up ? '+' : ''}{s.changePct.toFixed(2)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </TerminalCard>

            {/* Breadth + FII + Quick movers */}
            <div className="grid grid-cols-12 gap-4">

              {/* Breadth */}
              <div className="col-span-12 md:col-span-4">
                <TerminalCard title="Market Breadth" icon={<Activity size={12}/>} accent="cyan">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color:'var(--green)' }}>▲ {breadth.advances}</span>
                        <span style={{ color:'var(--text-muted)' }}>— {breadth.unchanged}</span>
                        <span style={{ color:'var(--red)' }}>{breadth.declines} ▼</span>
                      </div>
                      <div className="h-4 rounded overflow-hidden flex" style={{ background:'#1a1a1a' }}>
                        <div style={{ width:`${(breadth.advances/total)*100}%`, background:'var(--green)', opacity:0.75 }}/>
                        <div style={{ width:`${(breadth.unchanged/total)*100}%`, background:'#333' }}/>
                        <div style={{ width:`${(breadth.declines/total)*100}%`, background:'var(--red)', opacity:0.75 }}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><div className="font-bold font-mono" style={{ color:'var(--green)' }}>{breadth.advances}</div><div style={{ color:'var(--text-muted)' }}>Adv</div></div>
                      <div><div className="font-bold font-mono" style={{ color:'var(--text-dim)' }}>{breadth.unchanged}</div><div style={{ color:'var(--text-muted)' }}>Unch</div></div>
                      <div><div className="font-bold font-mono" style={{ color:'var(--red)' }}>{breadth.declines}</div><div style={{ color:'var(--text-muted)' }}>Dec</div></div>
                    </div>
                    <div className="space-y-1 text-xs pt-1" style={{ borderTop:'1px solid #1a1a1a' }}>
                      <MRow label="A/D Ratio" value={adRatio.toFixed(2)} color={adRatio>1?'var(--green)':'var(--red)'}/>
                      <MRow label="VIX" value={`${vixVal.toFixed(2)} — ${vixCtx.label}`} color={vixCtx.c}/>
                      {nifty && <MRow label="Nifty PE" value={nifty.pe != null ? (+nifty.pe).toFixed(1) : '—'} color="var(--text-dim)"/>}
                      {nifty && <MRow label="Nifty PB" value={nifty.pb != null ? (+nifty.pb).toFixed(1) : '—'} color="var(--text-dim)"/>}
                    </div>
                  </div>
                </TerminalCard>
              </div>

              {/* FII/DII */}
              <div className="col-span-12 md:col-span-4">
                <TerminalCard title="FII / DII Today" icon={<Activity size={12}/>} accent="amber">
                  {todayFII ? (
                    <div className="space-y-3">
                      <FIIBar label="FII Net" value={todayFII.fii_net}/>
                      <FIIBar label="DII Net" value={todayFII.dii_net}/>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1" style={{ borderTop:'1px solid #1a1a1a' }}>
                        <MRow label="FII Buy"  value={`${formatCompact(todayFII.fii_buy)}Cr`}  color="var(--green)"/>
                        <MRow label="FII Sell" value={`${formatCompact(todayFII.fii_sell)}Cr`} color="var(--red)"/>
                        <MRow label="DII Buy"  value={`${formatCompact(todayFII.dii_buy)}Cr`}  color="var(--green)"/>
                        <MRow label="DII Sell" value={`${formatCompact(todayFII.dii_sell)}Cr`} color="var(--red)"/>
                      </div>
                    </div>
                  ) : <Placeholder/>}
                </TerminalCard>
              </div>

              {/* Quick gainers */}
              <div className="col-span-12 md:col-span-4">
                <TerminalCard title="Top 5 Movers" icon={<Zap size={12}/>} accent="green">
                  <div className="space-y-1">
                    <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>Gainers</div>
                    {gainers.slice(0,3).map((s:any) => (
                      <QuickRow key={s.symbol} s={s} up/>
                    ))}
                    <div className="text-xs mt-2 mb-1" style={{ color:'var(--text-muted)', borderTop:'1px solid #1a1a1a', paddingTop:6 }}>Losers</div>
                    {losers.slice(0,3).map((s:any) => (
                      <QuickRow key={s.symbol} s={s} up={false}/>
                    ))}
                  </div>
                </TerminalCard>
              </div>
            </div>
          </div>
        )}

        {/* ══ INDICES ════════════════════════════════════════════════════ */}
        {tab === 'Indices' && (
          <TerminalCard title={`All Indices (${indices.length})`} icon={<Globe size={12}/>} accent="green" noPadding>
            <div className="overflow-auto">
              <table className="term-table text-xs">
                <thead>
                  <tr>
                    <th className="col-left">Index</th>
                    <SortHdr label="LTP"     k="ltp"       state={idxSort} set={setIdxSort}/>
                    <SortHdr label="Chg"     k="change"    state={idxSort} set={setIdxSort}/>
                    <SortHdr label="Chg%"    k="changePct" state={idxSort} set={setIdxSort}/>
                    <th className="col-right">Open</th>
                    <th className="col-right">High</th>
                    <th className="col-right">Low</th>
                    <th className="col-right">Prev</th>
                    <th className="col-right">PE</th>
                    <th style={{ minWidth: 100 }}>Day Range</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedIndices.map((idx: any) => {
                    const up     = idx.changePct >= 0
                    const rangePct = idx.high !== idx.low
                      ? ((idx.ltp - idx.low) / (idx.high - idx.low)) * 100
                      : 50
                    return (
                      <tr key={idx.symbol}>
                        <td>
                          <div className="font-bold" style={{ color:'var(--cyan)' }}>{idx.symbol}</div>
                        </td>
                        <td className="col-right font-mono">{idx.ltp.toLocaleString('en-IN', { maximumFractionDigits:1 })}</td>
                        <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {up ? '+' : ''}{idx.change?.toFixed(1)}
                        </td>
                        <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {up ? '+' : ''}{idx.changePct?.toFixed(2)}%
                        </td>
                        <td className="col-right font-mono" style={{ color:'var(--text-dim)' }}>{idx.open?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</td>
                        <td className="col-right font-mono" style={{ color:'var(--green)' }}>{idx.high?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</td>
                        <td className="col-right font-mono" style={{ color:'var(--red)' }}>{idx.low?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</td>
                        <td className="col-right font-mono" style={{ color:'var(--text-muted)' }}>{idx.prevClose?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</td>
                        <td className="col-right font-mono" style={{ color:'var(--text-dim)' }}>{idx.pe != null ? (+idx.pe).toFixed(1) : '—'}</td>
                        <td>
                          <div className="h-2 rounded overflow-hidden" style={{ background:'#1a1a1a', minWidth:80 }}>
                            <div className="h-full rounded"
                              style={{ width:`${rangePct}%`, background: up ? 'var(--green)' : 'var(--red)', opacity:0.7 }}/>
                          </div>
                          <div className="flex justify-between text-xs mt-0.5" style={{ fontSize:9, color:'var(--text-muted)' }}>
                            <span>{idx.low?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</span>
                            <span>{idx.high?.toLocaleString('en-IN', { maximumFractionDigits:0 })}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </TerminalCard>
        )}

        {/* ══ MOVERS ═════════════════════════════════════════════════════ */}
        {tab === 'Movers' && (
          <div className="grid grid-cols-12 gap-4">
            {/* Gainers */}
            <div className="col-span-12 lg:col-span-6">
              <TerminalCard title={`Top Gainers (${gainers.length})`} icon={<TrendingUp size={12}/>} accent="green" noPadding>
                <div className="overflow-auto">
                  <table className="term-table text-xs">
                    <thead>
                      <tr>
                        <th className="col-left">Symbol</th>
                        <SortHdr label="LTP"   k="ltp"       state={glSort} set={setGLSort}/>
                        <SortHdr label="Chg%"  k="changePct" state={glSort} set={setGLSort}/>
                        <SortHdr label="Vol"   k="volume"    state={glSort} set={setGLSort}/>
                        <SortHdr label="52wH"  k="high52w"   state={glSort} set={setGLSort}/>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGainers.map((s: any) => (
                        <tr key={s.symbol}>
                          <td className="font-bold" style={{ color:'var(--green)' }}>{s.symbol}</td>
                          <td className="col-right font-mono">₹{s.ltp?.toLocaleString('en-IN')}</td>
                          <td className="col-right font-mono" style={{ color:'var(--green)' }}>+{formatPct(s.changePct)}</td>
                          <td className="col-right" style={{ color:'var(--text-dim)' }}>{formatCompact(s.volume)}</td>
                          <td className="col-right font-mono" style={{ color:'var(--text-muted)' }}>
                            {s.high52w ? `₹${s.high52w.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td><ActionBtns sym={s.symbol}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TerminalCard>
            </div>

            {/* Losers */}
            <div className="col-span-12 lg:col-span-6">
              <TerminalCard title={`Top Losers (${losers.length})`} icon={<TrendingDown size={12}/>} accent="red" noPadding>
                <div className="overflow-auto">
                  <table className="term-table text-xs">
                    <thead>
                      <tr>
                        <th className="col-left">Symbol</th>
                        <SortHdr label="LTP"   k="ltp"       state={llSort} set={setLLSort}/>
                        <SortHdr label="Chg%"  k="changePct" state={llSort} set={setLLSort}/>
                        <SortHdr label="Vol"   k="volume"    state={llSort} set={setLLSort}/>
                        <SortHdr label="52wL"  k="low52w"    state={llSort} set={setLLSort}/>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLosers.map((s: any) => (
                        <tr key={s.symbol}>
                          <td className="font-bold" style={{ color:'var(--red)' }}>{s.symbol}</td>
                          <td className="col-right font-mono">₹{s.ltp?.toLocaleString('en-IN')}</td>
                          <td className="col-right font-mono" style={{ color:'var(--red)' }}>{formatPct(s.changePct)}</td>
                          <td className="col-right" style={{ color:'var(--text-dim)' }}>{formatCompact(s.volume)}</td>
                          <td className="col-right font-mono" style={{ color:'var(--text-muted)' }}>
                            {s.low52w ? `₹${s.low52w.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td><ActionBtns sym={s.symbol}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TerminalCard>
            </div>

            {/* Most Active by Volume */}
            <div className="col-span-12">
              <TerminalCard title="Most Active by Volume" icon={<BarChart2 size={12}/>} accent="amber" noPadding>
                <div className="overflow-auto">
                  <table className="term-table text-xs">
                    <thead>
                      <tr>
                        <th className="col-left">#</th>
                        <th className="col-left">Symbol</th>
                        <th className="col-right">LTP</th>
                        <th className="col-right">Chg%</th>
                        <th className="col-right">Volume</th>
                        <th>Vol Bar</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...gainers, ...losers]
                        .sort((a: any, b: any) => (b.volume ?? 0) - (a.volume ?? 0))
                        .slice(0, 20)
                        .map((s: any, i: number) => {
                          const maxVol = Math.max(...[...gainers,...losers].map((x:any) => x.volume ?? 0), 1)
                          const up = s.changePct >= 0
                          return (
                            <tr key={s.symbol}>
                              <td className="col-left font-mono" style={{ color:'var(--text-muted)' }}>{i+1}</td>
                              <td className="font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>{s.symbol}</td>
                              <td className="col-right font-mono">₹{s.ltp?.toLocaleString('en-IN')}</td>
                              <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                                {up ? '+' : ''}{formatPct(s.changePct)}
                              </td>
                              <td className="col-right font-mono" style={{ color:'var(--amber)' }}>{formatCompact(s.volume)}</td>
                              <td style={{ minWidth:120 }}>
                                <div className="h-2 rounded" style={{ background:'#1a1a1a' }}>
                                  <div className="h-full rounded" style={{ width:`${(s.volume/maxVol)*100}%`, background:'rgba(255,170,0,0.5)' }}/>
                                </div>
                              </td>
                              <td><ActionBtns sym={s.symbol}/></td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </TerminalCard>
            </div>
          </div>
        )}

        {/* ══ SECTORS ════════════════════════════════════════════════════ */}
        {tab === 'Sectors' && (
          <div className="space-y-4">
            {/* Sector bar chart */}
            <TerminalCard title="Sector Rotation" icon={<BarChart2 size={12}/>} accent="cyan">
              <div className="space-y-2">
                {sortedSectors.map((s: any) => {
                  const up   = s.changePct >= 0
                  const maxAbs = Math.max(...sectors.map((x:any) => Math.abs(x.changePct)), 1)
                  const pct  = (Math.abs(s.changePct) / maxAbs) * 100
                  return (
                    <div key={s.name} className="flex items-center gap-3">
                      <div className="text-xs w-24 text-right shrink-0" style={{ color:'var(--text-dim)' }}>{s.name}</div>
                      <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ background:'#1a1a1a' }}>
                        <div className="h-full rounded transition-all" style={{
                          width:`${pct}%`,
                          background: up ? 'rgba(0,255,65,0.55)' : 'rgba(255,0,64,0.55)',
                        }}/>
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-mono font-bold"
                          style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {up ? '+' : ''}{s.changePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TerminalCard>

            {/* Sector cards grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))' }}>
              {sortedSectors.map((s: any) => {
                const up  = s.changePct >= 0
                const mag = Math.min(Math.abs(s.changePct) / 3, 1)
                return (
                  <div key={s.name} className="p-3 rounded border"
                    style={{
                      background: up ? `rgba(0,255,65,${0.04 + mag*0.12})` : `rgba(255,0,64,${0.04 + mag*0.12})`,
                      border: `1px solid ${up ? 'rgba(0,255,65,0.2)' : 'rgba(255,0,64,0.2)'}`,
                    }}>
                    <div className="text-xs font-bold" style={{ color:'var(--text-dim)' }}>{s.name}</div>
                    <div className="text-xl font-bold font-mono mt-1"
                      style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                      {up ? '+' : ''}{s.changePct.toFixed(2)}%
                    </div>
                    <Link href={`/screener`} className="text-xs mt-1 block" style={{ color:'var(--text-muted)', textDecoration:'none' }}>
                      Scan sector →
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ FII / DII ══════════════════════════════════════════════════ */}
        {tab === 'FII / DII' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="FII Today"  value={todayFII ? `${todayFII.fii_net>=0?'+':''}${formatCompact(todayFII.fii_net)}Cr` : '—'} sub="Net" color={todayFII?.fii_net>=0?'var(--green)':'var(--red)'}/>
              <StatCard label="DII Today"  value={todayFII ? `${todayFII.dii_net>=0?'+':''}${formatCompact(todayFII.dii_net)}Cr` : '—'} sub="Net" color={todayFII?.dii_net>=0?'var(--green)':'var(--red)'}/>
              <StatCard label="FII 7-Day"  value={`${cumFII>=0?'+':''}${formatCompact(cumFII)}Cr`} sub="Cumulative" color={cumFII>=0?'var(--green)':'var(--red)'}/>
              <StatCard label="DII 7-Day"  value={`${cumDII>=0?'+':''}${formatCompact(cumDII)}Cr`} sub="Cumulative" color={cumDII>=0?'var(--green)':'var(--red)'}/>
            </div>

            {/* 7-day bar charts */}
            {recentFII.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label:'FII Net Flow (7 Days)',  key:'fii_net' },
                  { label:'DII Net Flow (7 Days)',  key:'dii_net' },
                ].map(({ label, key }) => {
                  const maxAbs = Math.max(...recentFII.map((d:any) => Math.abs(d[key] ?? 0)), 1)
                  return (
                    <TerminalCard key={key} title={label} icon={<Activity size={12}/>} accent="amber">
                      <div className="flex items-end gap-2 h-28 mt-2">
                        {[...recentFII].reverse().map((d: any, i: number) => {
                          const val  = d[key] ?? 0
                          const hPct = Math.max(8, (Math.abs(val) / maxAbs) * 90)
                          const up   = val >= 0
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                              <div className="text-xs font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize:9 }}>
                                {up ? '+' : ''}{formatCompact(val)}
                              </div>
                              <div className="w-full rounded-t" style={{
                                height: `${hPct}%`,
                                background: up ? 'rgba(0,255,65,0.6)' : 'rgba(255,0,64,0.6)',
                              }}/>
                              <div style={{ color:'var(--text-muted)', fontSize:9 }}>
                                {d.date?.slice(5) ?? i}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </TerminalCard>
                  )
                })}
              </div>
            )}

            {/* Full historical table */}
            <TerminalCard title="FII / DII History" icon={<Activity size={12}/>} accent="cyan" noPadding>
              <div className="overflow-auto">
                <table className="term-table text-xs">
                  <thead>
                    <tr>
                      <th className="col-left">Date</th>
                      <th className="col-right">FII Buy</th>
                      <th className="col-right">FII Sell</th>
                      <th className="col-right">FII Net</th>
                      <th className="col-right">DII Buy</th>
                      <th className="col-right">DII Sell</th>
                      <th className="col-right">DII Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiidii.map((d: any, i: number) => (
                      <tr key={i}>
                        <td style={{ color:'var(--text-dim)' }}>{d.date}</td>
                        <td className="col-right font-mono" style={{ color:'var(--green)' }}>{formatCompact(d.fii_buy)}Cr</td>
                        <td className="col-right font-mono" style={{ color:'var(--red)' }}>{formatCompact(d.fii_sell)}Cr</td>
                        <td className="col-right font-mono" style={{ color: d.fii_net>=0?'var(--green)':'var(--red)' }}>
                          {d.fii_net>=0?'+':''}{formatCompact(d.fii_net)}Cr
                        </td>
                        <td className="col-right font-mono" style={{ color:'var(--green)' }}>{formatCompact(d.dii_buy)}Cr</td>
                        <td className="col-right font-mono" style={{ color:'var(--red)' }}>{formatCompact(d.dii_sell)}Cr</td>
                        <td className="col-right font-mono" style={{ color: d.dii_net>=0?'var(--green)':'var(--red)' }}>
                          {d.dii_net>=0?'+':''}{formatCompact(d.dii_net)}Cr
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TerminalCard>
          </div>
        )}

        {/* ══ HEATMAP (Feature 6) ════════════════════════════════════════ */}
        {tab === 'Heatmap' && (
          <SectorHeatmap sectors={sectors} />
        )}

        {/* ══ A/D CHART (Feature 8) ══════════════════════════════════════ */}
        {tab === 'A/D Chart' && (
          <ADChart history={adHistory} breadth={breadth} />
        )}

        {/* ══ 52W EXTREMES (Feature 9) ═══════════════════════════════════ */}
        {tab === '52W Extremes' && (
          <W52Extremes nearHigh={w52Near.nearHigh} nearLow={w52Near.nearLow} />
        )}

        {/* ══ HEALTH HISTORY (Feature 10) ════════════════════════════════ */}
        {tab === 'Health History' && (
          <HealthHistory history={hhHistory} currentScore={healthScore} currentLabel={healthLabel} />
        )}

        {/* ══ FUTURES PREMIUM ════════════════════════════════════════════ */}
        {tab === 'Futures Premium' && (
          <FuturesPremium data={giftRes?.data ?? []} loading={!giftRes} nifty={nifty} />
        )}

        {/* ══ GLOBAL ═════════════════════════════════════════════════════ */}
        {tab === 'Global' && (
          <div className="space-y-4">
            {/* Heatmap */}
            <TerminalCard title="Global Markets" icon={<Globe size={12}/>} accent="amber" noPadding>
              <div className="flex flex-wrap">
                {global.map((g: any) => {
                  const up  = g.changePct >= 0
                  const mag = Math.min(Math.abs(g.changePct) / 3, 1)
                  return (
                    <div key={g.symbol} className="flex-1 text-center py-4 px-2 border-r border-b"
                      style={{
                        minWidth: 100,
                        background: up ? `rgba(0,255,65,${0.05 + mag*0.2})` : `rgba(255,0,64,${0.05 + mag*0.2})`,
                        borderColor: '#1a1a1a',
                      }}>
                      <div className="text-xs font-bold" style={{ color:'var(--text-dim)', fontSize:10 }}>{g.name}</div>
                      <div className="text-sm font-bold font-mono mt-1" style={{ color:'var(--text)' }}>
                        {g.price >= 10000
                          ? g.price.toLocaleString('en-US', { maximumFractionDigits:0 })
                          : g.price.toFixed(g.price < 10 ? 3 : 2)}
                      </div>
                      <div className="text-xs font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                        {up ? '+' : ''}{g.changePct.toFixed(2)}%
                      </div>
                      <div style={{ color:'var(--text-muted)', fontSize:9 }}>{g.currency}</div>
                    </div>
                  )
                })}
              </div>
            </TerminalCard>

            {/* Global table */}
            <TerminalCard title="Global Details" icon={<Globe size={12}/>}  noPadding>
              <table className="term-table text-xs">
                <thead>
                  <tr>
                    <th className="col-left">Market</th>
                    <th className="col-right">Price</th>
                    <th className="col-right">Change</th>
                    <th className="col-right">Chg%</th>
                    <th className="col-right">Currency</th>
                    <th style={{ minWidth:100 }}>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {[...global].sort((a:any, b:any) => b.changePct - a.changePct).map((g: any) => {
                    const up = g.changePct >= 0
                    return (
                      <tr key={g.symbol}>
                        <td className="font-bold" style={{ color:'var(--amber)' }}>{g.name}</td>
                        <td className="col-right font-mono">
                          {g.price >= 10000
                            ? g.price.toLocaleString('en-US', { maximumFractionDigits:0 })
                            : g.price.toFixed(g.price < 10 ? 3 : 2)}
                        </td>
                        <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {up ? '+' : ''}{g.change.toFixed(g.price < 100 ? 3 : 1)}
                        </td>
                        <td className="col-right font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                          {up ? '+' : ''}{g.changePct.toFixed(2)}%
                        </td>
                        <td className="col-right" style={{ color:'var(--text-muted)' }}>{g.currency}</td>
                        <td>
                          <div className="h-2 rounded" style={{ background:'#1a1a1a' }}>
                            <div className="h-full rounded" style={{
                              width:`${Math.min(Math.abs(g.changePct)/3*100,100)}%`,
                              background: up ? 'rgba(0,255,65,0.5)' : 'rgba(255,0,64,0.5)',
                            }}/>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TerminalCard>
          </div>
        )}
      </div>
    </>
  )
}

/* ─── Futures Premium ───────────────────────────────────────────────── */

function FuturesPremium({ data, loading, nifty }: { data: any[]; loading: boolean; nifty: any }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
      Loading futures data...
    </div>
  )

  const giftNifty = data.find(d => d.symbol === 'GIFT NIFTY')
  const sgxNifty  = data.find(d => d.symbol === 'SGX NIFTY')
  const others    = data.filter(d => d.symbol !== 'GIFT NIFTY' && d.symbol !== 'SGX NIFTY')

  function premiumColor(pct: number | null) {
    if (pct == null) return 'var(--text-dim)'
    if (pct > 0.3) return 'var(--green)'
    if (pct > 0)   return 'rgba(0,255,65,0.7)'
    if (pct > -0.3) return 'var(--amber)'
    return 'var(--red)'
  }

  function premiumLabel(pct: number | null) {
    if (pct == null) return 'N/A'
    if (pct > 0.5)  return 'Strong Premium — Bullish Gap-Up Signal'
    if (pct > 0.2)  return 'Mild Premium — Slight Positive Bias'
    if (pct > -0.2) return 'Flat — Neutral'
    if (pct > -0.5) return 'Mild Discount — Slight Negative Bias'
    return 'Strong Discount — Bearish Gap-Down Signal'
  }

  const spot = nifty?.ltp ?? 0

  return (
    <div className="space-y-4">

      {/* Hero: GIFT Nifty Premium */}
      {giftNifty && (
        <TerminalCard title="GIFT Nifty vs Nifty 50 Spot" icon={<Zap size={12}/>} accent="cyan">
          <div className="flex flex-wrap gap-6 items-start">

            {/* Premium metric */}
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Premium / Discount</div>
              <div style={{
                fontFamily: 'JetBrains Mono', fontSize: 32, fontWeight: 700,
                color: premiumColor(giftNifty.premiumPct),
              }}>
                {giftNifty.premium != null
                  ? `${giftNifty.premium >= 0 ? '+' : ''}${giftNifty.premium.toLocaleString('en-IN', { minimumFractionDigits: 2 })} pts`
                  : '—'}
              </div>
              {giftNifty.premiumPct != null && (
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, color: premiumColor(giftNifty.premiumPct), marginTop: 2 }}>
                  {giftNifty.premiumPct >= 0 ? '+' : ''}{giftNifty.premiumPct.toFixed(2)}%
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                {premiumLabel(giftNifty.premiumPct)}
              </div>
            </div>

            {/* Prices */}
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>GIFT Nifty</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, color: 'var(--cyan)' }}>
                  {giftNifty.ltp > 0 ? giftNifty.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', color: giftNifty.changePct >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>
                  {giftNifty.changePct >= 0 ? '+' : ''}{giftNifty.changePct.toFixed(2)}%
                </div>
              </div>
              {spot > 0 && (
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Nifty 50 Spot (Last)</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                    {spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>

            {/* Interpretation guide */}
            <div className="flex-1" style={{ minWidth: 200 }}>
              <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Interpretation Guide</div>
              <div className="space-y-1">
                {[
                  ['> +0.5%', 'Strong bullish bias for next open', 'var(--green)'],
                  ['+0.2 to +0.5%', 'Mild positive bias', 'rgba(0,255,65,0.7)'],
                  ['−0.2 to +0.2%', 'Flat / neutral', 'var(--amber)'],
                  ['−0.5 to −0.2%', 'Mild negative bias', 'rgba(255,183,0,0.7)'],
                  ['< −0.5%', 'Strong bearish bias for next open', 'var(--red)'],
                ].map(([range, desc, color]) => (
                  <div key={range} className="flex items-center gap-3" style={{ fontSize: 10 }}>
                    <span style={{ fontFamily: 'JetBrains Mono', color: color as string, minWidth: 100 }}>{range}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* Global Futures Table */}
      <TerminalCard title="Global Futures Overview" icon={<Activity size={12}/>} accent="amber" noPadding>
        <table className="term-table text-xs w-full">
          <thead>
            <tr>
              <th className="col-left">Contract</th>
              <th className="col-right">Price</th>
              <th className="col-right">Change</th>
              <th className="col-right">Chg %</th>
              <th className="col-right">Nifty Premium</th>
              <th className="col-left">Bias</th>
              <th className="col-left" style={{ color: 'var(--text-muted)', fontSize: 9 }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, i: number) => {
              const up = item.changePct >= 0
              return (
                <tr key={item.symbol} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : undefined }}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{item.symbol}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{item.name}</div>
                  </td>
                  <td className="col-right" style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--text)' }}>
                    {item.ltp > 0 ? item.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: up ? 'var(--green)' : 'var(--red)' }}>
                    {item.change >= 0 ? '+' : ''}{item.change?.toFixed(2) ?? '—'}
                  </td>
                  <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: up ? 'var(--green)' : 'var(--red)' }}>
                    {item.changePct >= 0 ? '+' : ''}{item.changePct?.toFixed(2) ?? '—'}%
                  </td>
                  <td className="col-right" style={{ fontFamily: 'JetBrains Mono', color: premiumColor(item.premiumPct) }}>
                    {item.premiumPct != null
                      ? `${item.premiumPct >= 0 ? '+' : ''}${item.premiumPct.toFixed(2)}%`
                      : '—'}
                  </td>
                  <td style={{ fontSize: 10, color: premiumColor(item.premiumPct) }}>
                    {item.premiumPct != null ? premiumLabel(item.premiumPct).split(' — ')[0] : '—'}
                  </td>
                  <td style={{ fontSize: 9, color: 'var(--text-muted)' }}>{item.source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TerminalCard>

      {/* Context note */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--border)' }}>
        <strong style={{ color: 'var(--text-dim)' }}>Note:</strong> GIFT Nifty (formerly SGX Nifty) trades on NSE IFSC, Singapore.
        Its premium/discount vs Nifty 50 spot indicates likely gap-up or gap-down at market open (9:15 AM IST).
        Prices refresh every 30 seconds. Data sourced from Yahoo Finance.
      </div>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatCard({ label, value, sub, color }: { label:string; value:string; sub?:string; color?:string }) {
  return (
    <div className="term-card p-4">
      <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function MRow({ label, value, color }: { label:string; value:string; color:string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color:'var(--text-muted)' }}>{label}</span>
      <span className="font-mono" style={{ color }}>{value}</span>
    </div>
  )
}

function FIIBar({ label, value }: { label:string; value:number }) {
  const pct  = Math.min(100, (Math.abs(value) / 5000) * 100)
  const isPos = value >= 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color:'var(--text-dim)' }}>{label}</span>
        <span className="font-mono" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
          {isPos ? '+' : ''}{formatCompact(value)} Cr
        </span>
      </div>
      <div className="h-2 rounded overflow-hidden" style={{ background:'#1a1a1a' }}>
        <div className="h-full rounded" style={{ width:`${pct}%`, background: isPos ? 'var(--green)' : 'var(--red)', opacity:0.7 }}/>
      </div>
    </div>
  )
}

function QuickRow({ s, up }: { s:any; up:boolean }) {
  return (
    <Link href={`/monitor?symbol=${s.symbol}`}
      className="flex justify-between items-center py-0.5 hover:opacity-80"
      style={{ textDecoration:'none' }}>
      <span className="text-xs font-bold" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>{s.symbol}</span>
      <span className="text-xs font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
        {up ? '+' : ''}{formatPct(s.changePct)}
      </span>
    </Link>
  )
}

function ActionBtns({ sym }: { sym:string }) {
  return (
    <div className="flex gap-1">
      <Link href={`/monitor?symbol=${sym}`}     className="btn btn-sm btn-ghost" style={{ textDecoration:'none', fontSize:10, padding:'2px 5px' }}>Chart</Link>
      <Link href={`/options?symbol=${sym}`}     className="btn btn-sm btn-cyan"  style={{ textDecoration:'none', fontSize:10, padding:'2px 5px' }}>Opt</Link>
      <Link href={`/strategies?underlying=${sym}`} className="btn btn-sm btn-amber" style={{ textDecoration:'none', fontSize:10, padding:'2px 5px' }}>Strat</Link>
    </div>
  )
}

function Placeholder() {
  return <div className="text-xs py-4 text-center" style={{ color:'var(--text-muted)' }}>Loading…</div>
}

/* ─── Feature 6: Sector Heatmap Treemap ─────────────────────────────── */

function SectorHeatmap({ sectors }: { sectors: any[] }) {
  // Merge live changePct with static market-cap weights
  const items = sectors.map((s: any) => ({
    name: s.name,
    changePct: s.changePct,
    mcap: SECTOR_MCAP[s.name] ?? 8,
  }))

  const totalMcap = items.reduce((s, i) => s + i.mcap, 0)

  // Simple row-based treemap layout (single row, width proportional to mcap)
  // We'll lay out items in a flex container with flex-basis proportional to mcap
  function heatColor(pct: number) {
    if (pct >=  3) return 'rgba(0,200,60,0.85)'
    if (pct >=  1.5) return 'rgba(0,200,60,0.55)'
    if (pct >=  0) return 'rgba(0,200,60,0.25)'
    if (pct >= -1.5) return 'rgba(255,30,60,0.25)'
    if (pct >= -3) return 'rgba(255,30,60,0.55)'
    return 'rgba(255,30,60,0.85)'
  }
  function textColor(pct: number) {
    return pct >= 0 ? 'var(--green)' : 'var(--red)'
  }

  // Sort by mcap descending for better visual
  const sorted = [...items].sort((a, b) => b.mcap - a.mcap)

  // Build a two-row treemap: top row large caps, bottom row smaller caps
  const large = sorted.slice(0, 8)
  const small = sorted.slice(8)

  function TreeRow({ row }: { row: typeof sorted }) {
    const rowMcap = row.reduce((s, i) => s + i.mcap, 0)
    return (
      <div className="flex w-full" style={{ minHeight: 80 }}>
        {row.map(item => {
          const widthPct = (item.mcap / rowMcap) * 100
          return (
            <div
              key={item.name}
              style={{
                width: `${widthPct}%`,
                background: heatColor(item.changePct),
                border: '1px solid #111',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 4px',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {item.name.replace('Nifty ', '')}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: textColor(item.changePct), marginTop: 2 }}>
                {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                ₹{item.mcap}L Cr
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <TerminalCard title="Sector Heatmap — Market Cap Weighted" icon={<BarChart2 size={12}/>} accent="cyan" noPadding>
        <div style={{ padding: '8px 0 0' }}>
          {/* Legend */}
          <div className="flex gap-3 px-3 pb-2 items-center flex-wrap">
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Color scale:</span>
            {[
              { label: '< -3%',       bg: 'rgba(255,30,60,0.85)' },
              { label: '-1.5%',       bg: 'rgba(255,30,60,0.55)' },
              { label: 'Neutral',     bg: 'rgba(0,200,60,0.25)'  },
              { label: '+1.5%',       bg: 'rgba(0,200,60,0.55)'  },
              { label: '> +3%',       bg: 'rgba(0,200,60,0.85)'  },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div style={{ width: 12, height: 12, background: l.bg, border: '1px solid #333', borderRadius: 2 }}/>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l.label}</span>
              </div>
            ))}
          </div>
          <TreeRow row={large} />
          {small.length > 0 && <TreeRow row={small} />}
        </div>
      </TerminalCard>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sorted.slice(0, 4).map(s => (
          <div key={s.name} className="term-card p-3">
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.name.replace('Nifty ', '')}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: s.changePct >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
              {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>MCap ₹{s.mcap}L Cr</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Feature 8: Advance/Decline Breadth Chart ───────────────────────── */

function ADChart({ history, breadth }: {
  history: { date: string; ratio: number; advances: number; declines: number; unchanged: number }[]
  breadth: { advances: number; declines: number; unchanged: number }
}) {
  if (!history.length) return <Placeholder />

  // ── Breadth metrics ──────────────────────────────────────────────────────
  const latest     = history[history.length - 1]
  const adv        = breadth.advances  || latest.advances
  const dec        = breadth.declines  || latest.declines
  const unch       = breadth.unchanged || latest.unchanged
  const tickValue  = adv - dec          // TICK proxy: advances − declines
  const totalAD    = adv + dec + unch || 1
  const thrust     = ((adv / (adv + dec || 1)) * 100)  // Breadth Thrust %

  // Net Breadth Line (cumulative advances − declines)
  let cumNBL = 0
  const nblData = history.map(d => {
    cumNBL += (d.advances - d.declines)
    return { date: d.date, nbl: cumNBL, tick: d.advances - d.declines, thrust: (d.advances / (d.advances + d.declines || 1)) * 100 }
  })

  const tickColor  = tickValue > 200 ? 'var(--green)' : tickValue < -200 ? 'var(--red)' : 'var(--amber)'
  const thrustColor = thrust > 62 ? 'var(--green)' : thrust < 40 ? 'var(--red)' : 'var(--amber)'
  const thrustLabel = thrust > 62 ? 'Overbought (Bullish)' : thrust < 40 ? 'Oversold (Bearish)' : 'Neutral Zone'

  // ── Chart helpers ────────────────────────────────────────────────────────
  const W = 600, H = 180
  const PAD = { top: 16, right: 16, bottom: 36, left: 50 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top  - PAD.bottom

  const ratios = history.map(d => d.ratio)
  const minR   = Math.max(0, Math.min(...ratios) - 0.05)
  const maxR   = Math.min(1, Math.max(...ratios) + 0.05)

  function xPos(i: number) {
    return PAD.left + (i / Math.max(history.length - 1, 1)) * chartW
  }
  function yPos(r: number) {
    return PAD.top + chartH - ((r - minR) / (maxR - minR || 1)) * chartH
  }

  const points   = history.map((d, i) => `${xPos(i)},${yPos(d.ratio)}`).join(' ')
  const neutral50 = yPos(0.5)
  const yTicks   = [0.3, 0.4, 0.5, 0.6, 0.7].filter(v => v >= minR && v <= maxR)

  // TICK bar chart helpers
  const maxTick = Math.max(...nblData.map(d => Math.abs(d.tick)), 1)
  const TH = 100, TPAD = { top: 10, bottom: 24, left: 50, right: 16 }
  const TchartH = TH - TPAD.top - TPAD.bottom
  const barW    = chartW / Math.max(nblData.length, 1)

  return (
    <div className="space-y-4">

      {/* ── Live Breadth Stats: TICK + Breadth Thrust ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Advances</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--green)' }}>{adv}</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Declines</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--red)' }}>{dec}</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TICK (A−D)</div>
          <div className="text-2xl font-bold font-mono" style={{ color: tickColor }}>
            {tickValue >= 0 ? '+' : ''}{tickValue}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {tickValue > 200 ? 'Broad advance' : tickValue < -200 ? 'Broad decline' : 'Mixed'}
          </div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Breadth Thrust</div>
          <div className="text-2xl font-bold font-mono" style={{ color: thrustColor }}>
            {thrust.toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: thrustColor, marginTop: 2 }}>{thrustLabel}</div>
        </div>
      </div>

      {/* Breadth Thrust bar */}
      <TerminalCard title="Breadth Thrust Bar (Advances / Total Active)" icon={<Activity size={12}/>} accent="cyan">
        <div>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--green)' }}>Advances: {adv} ({((adv/totalAD)*100).toFixed(1)}%)</span>
            <span style={{ color: 'var(--text-muted)' }}>Unchanged: {unch}</span>
            <span style={{ color: 'var(--red)' }}>Declines: {dec} ({((dec/totalAD)*100).toFixed(1)}%)</span>
          </div>
          <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ width: `${(adv/totalAD)*100}%`, background: 'rgba(0,255,65,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontFamily: 'JetBrains Mono', transition: 'width 0.5s ease' }}>
              {adv > 10 ? adv : ''}
            </div>
            <div style={{ width: `${(unch/totalAD)*100}%`, background: '#2a2a2a' }}/>
            <div style={{ width: `${(dec/totalAD)*100}%`, background: 'rgba(255,0,64,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontFamily: 'JetBrains Mono', transition: 'width 0.5s ease' }}>
              {dec > 10 ? dec : ''}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
            <span>Oversold (&lt; 40%)</span>
            <span style={{ color: 'var(--amber)' }}>Neutral (40–62%)</span>
            <span>Overbought (&gt; 62%)</span>
          </div>
        </div>
      </TerminalCard>

      {/* ── A/D Ratio Line Chart ── */}
      <TerminalCard title="A/D Ratio — Last 10 Trading Days" icon={<Activity size={12}/>} accent="cyan">
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="#1f1f1f" strokeWidth={1}/>
                <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{v.toFixed(1)}</text>
              </g>
            ))}
            {neutral50 >= PAD.top && neutral50 <= PAD.top + chartH && (
              <line x1={PAD.left} y1={neutral50} x2={W - PAD.right} y2={neutral50} stroke="rgba(255,200,0,0.5)" strokeWidth={1} strokeDasharray="5,4"/>
            )}
            <text x={W - PAD.right + 2} y={neutral50 + 4} fontSize={9} fill="rgba(255,200,0,0.8)">0.5</text>
            <polygon points={`${xPos(0)},${PAD.top + chartH} ${points} ${xPos(history.length - 1)},${PAD.top + chartH}`} fill="rgba(0,200,255,0.08)"/>
            <polyline points={points} fill="none" stroke="var(--cyan)" strokeWidth={2} strokeLinejoin="round"/>
            {history.map((d, i) => (
              <circle key={i} cx={xPos(i)} cy={yPos(d.ratio)} r={3.5} fill={d.ratio >= 0.5 ? 'var(--green)' : 'var(--red)'} stroke="#0a0a0a" strokeWidth={1}/>
            ))}
            {history.map((d, i) => (
              <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize={8} fill="var(--text-muted)">{d.date.slice(5)}</text>
            ))}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#333" strokeWidth={1}/>
            <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke="#333" strokeWidth={1}/>
          </svg>
        </div>
      </TerminalCard>

      {/* ── Daily TICK (Advances − Declines) bar chart ── */}
      <TerminalCard title="Daily TICK  (Advances − Declines)" icon={<BarChart2 size={12}/>} accent="amber">
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${TH}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
            {/* Zero line */}
            <line x1={PAD.left} y1={TPAD.top + TchartH/2} x2={W - TPAD.right} y2={TPAD.top + TchartH/2}
              stroke="rgba(255,200,0,0.4)" strokeWidth={1} strokeDasharray="4,3"/>
            {/* Bars */}
            {nblData.map((d, i) => {
              const barH  = (Math.abs(d.tick) / maxTick) * (TchartH / 2)
              const pos   = d.tick >= 0
              const bx    = PAD.left + i * barW + barW * 0.1
              const bw    = barW * 0.8
              const by    = pos ? TPAD.top + TchartH/2 - barH : TPAD.top + TchartH/2
              return (
                <rect key={i} x={bx} y={by} width={bw} height={barH || 1}
                  fill={pos ? 'rgba(0,255,65,0.6)' : 'rgba(255,0,64,0.6)'}/>
              )
            })}
            {/* X labels */}
            {nblData.map((d, i) => (
              <text key={i} x={PAD.left + i * barW + barW/2} y={TH - 4}
                textAnchor="middle" fontSize={8} fill="var(--text-muted)">{d.date.slice(5)}</text>
            ))}
            <line x1={PAD.left} y1={TPAD.top} x2={PAD.left} y2={TPAD.top + TchartH} stroke="#333" strokeWidth={1}/>
          </svg>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          Green bars = net advances day. Red bars = net declines day. Magnitude indicates breadth strength.
        </div>
      </TerminalCard>

      {/* Daily table */}
      <TerminalCard title="Daily Breadth Detail" icon={<BarChart2 size={12}/>} accent="amber" noPadding>
        <div className="overflow-auto">
          <table className="term-table text-xs">
            <thead>
              <tr>
                <th className="col-left">Date</th>
                <th className="col-right">Advances</th>
                <th className="col-right">Declines</th>
                <th className="col-right">Unchanged</th>
                <th className="col-right">TICK (A−D)</th>
                <th className="col-right">Thrust %</th>
                <th className="col-right">A/D Ratio</th>
                <th style={{ minWidth: 100 }}>Breadth Bar</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((d, i) => {
                const total    = d.advances + d.declines + d.unchanged || 1
                const bullish  = d.ratio >= 0.5
                const tick     = d.advances - d.declines
                const thr      = (d.advances / (d.advances + d.declines || 1) * 100)
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-dim)' }}>{d.date}</td>
                    <td className="col-right font-mono" style={{ color: 'var(--green)' }}>{d.advances}</td>
                    <td className="col-right font-mono" style={{ color: 'var(--red)' }}>{d.declines}</td>
                    <td className="col-right font-mono" style={{ color: 'var(--text-muted)' }}>{d.unchanged}</td>
                    <td className="col-right font-mono" style={{ color: tick >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {tick >= 0 ? '+' : ''}{tick}
                    </td>
                    <td className="col-right font-mono" style={{ color: thr > 62 ? 'var(--green)' : thr < 40 ? 'var(--red)' : 'var(--amber)' }}>
                      {thr.toFixed(1)}%
                    </td>
                    <td className="col-right font-mono" style={{ color: bullish ? 'var(--green)' : 'var(--red)' }}>
                      {d.ratio.toFixed(3)}
                    </td>
                    <td>
                      <div className="flex h-3 rounded overflow-hidden" style={{ background: '#1a1a1a', minWidth: 80 }}>
                        <div style={{ width: `${(d.advances / total) * 100}%`, background: 'var(--green)', opacity: 0.7 }}/>
                        <div style={{ width: `${(d.unchanged / total) * 100}%`, background: '#444' }}/>
                        <div style={{ width: `${(d.declines / total) * 100}%`, background: 'var(--red)', opacity: 0.7 }}/>
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

/* ─── Feature 9: 52-Week High/Low Extremes ───────────────────────────── */

function W52Extremes({ nearHigh, nearLow }: { nearHigh: any[]; nearLow: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Near 52W High</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--green)' }}>{nearHigh.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>within 2%</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Near 52W Low</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--red)' }}>{nearLow.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>within 2%</div>
        </div>
        <div className="term-card p-4 text-center col-span-2">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Bias Signal</div>
          <div className="text-lg font-bold font-mono" style={{
            color: nearHigh.length > nearLow.length ? 'var(--green)' : nearHigh.length < nearLow.length ? 'var(--red)' : 'var(--amber)'
          }}>
            {nearHigh.length > nearLow.length ? '▲ Bullish Breadth' : nearHigh.length < nearLow.length ? '▼ Bearish Breadth' : '— Neutral'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>52W highs vs lows ratio</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Near 52W High */}
        <TerminalCard title={`Near 52-Week High (${nearHigh.length})`} icon={<TrendingUp size={12}/>} accent="green" noPadding>
          {nearHigh.length === 0
            ? <div className="p-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No stocks near 52W high</div>
            : (
              <table className="term-table text-xs">
                <thead>
                  <tr>
                    <th className="col-left">Symbol</th>
                    <th className="col-right">LTP</th>
                    <th className="col-right">52W High</th>
                    <th className="col-right">Distance</th>
                    <th style={{ minWidth: 80 }}>Proximity</th>
                  </tr>
                </thead>
                <tbody>
                  {nearHigh.map((s: any) => (
                    <tr key={s.symbol}>
                      <td className="font-bold" style={{ color: 'var(--green)' }}>{s.symbol}</td>
                      <td className="col-right font-mono">₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                        ₹{s.high52w.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="col-right font-mono" style={{ color: 'var(--green)' }}>
                        {s.distPct.toFixed(2)}%
                      </td>
                      <td>
                        <div className="h-2 rounded overflow-hidden" style={{ background: '#1a1a1a' }}>
                          <div className="h-full rounded" style={{
                            width: `${100 + s.distPct * 50}%`,
                            background: 'var(--green)',
                            opacity: 0.7,
                          }}/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </TerminalCard>

        {/* Near 52W Low */}
        <TerminalCard title={`Near 52-Week Low (${nearLow.length})`} icon={<TrendingDown size={12}/>} accent="red" noPadding>
          {nearLow.length === 0
            ? <div className="p-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No stocks near 52W low</div>
            : (
              <table className="term-table text-xs">
                <thead>
                  <tr>
                    <th className="col-left">Symbol</th>
                    <th className="col-right">LTP</th>
                    <th className="col-right">52W Low</th>
                    <th className="col-right">Distance</th>
                    <th style={{ minWidth: 80 }}>Proximity</th>
                  </tr>
                </thead>
                <tbody>
                  {nearLow.map((s: any) => (
                    <tr key={s.symbol}>
                      <td className="font-bold" style={{ color: 'var(--red)' }}>{s.symbol}</td>
                      <td className="col-right font-mono">₹{s.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="col-right font-mono" style={{ color: 'var(--text-dim)' }}>
                        ₹{s.low52w.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="col-right font-mono" style={{ color: 'var(--red)' }}>
                        +{s.distPct.toFixed(2)}%
                      </td>
                      <td>
                        <div className="h-2 rounded overflow-hidden" style={{ background: '#1a1a1a' }}>
                          <div className="h-full rounded" style={{
                            width: `${Math.min(s.distPct * 50, 100)}%`,
                            background: 'var(--red)',
                            opacity: 0.7,
                          }}/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </TerminalCard>
      </div>
    </div>
  )
}

/* ─── Feature 10: Market Health Score History ────────────────────────── */

function HealthHistory({
  history,
  currentScore,
  currentLabel,
}: {
  history: { date: string; score: number; label: string }[]
  currentScore: number
  currentLabel: string
}) {
  if (!history.length) return <Placeholder />

  const W = 600, H = 180
  const PAD = { top: 16, right: 16, bottom: 36, left: 44 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top  - PAD.bottom

  function xPos(i: number) {
    return PAD.left + (i / Math.max(history.length - 1, 1)) * chartW
  }
  function yPos(score: number) {
    return PAD.top + chartH - (score / 100) * chartH
  }

  const points  = history.map((d, i) => `${xPos(i)},${yPos(d.score)}`).join(' ')
  const yTicks  = [0, 25, 40, 65, 100]
  const latest  = history[history.length - 1]

  function scoreColor(s: number) {
    return s >= 65 ? 'var(--green)' : s >= 40 ? 'var(--amber)' : 'var(--red)'
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Today's Score</div>
          <div className="text-2xl font-bold font-mono" style={{ color: scoreColor(currentScore) }}>{currentScore}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{currentLabel}</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>30D Average</div>
          <div className="text-2xl font-bold font-mono" style={{ color: scoreColor(Math.round(history.reduce((s, d) => s + d.score, 0) / history.length)) }}>
            {Math.round(history.reduce((s, d) => s + d.score, 0) / history.length)}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>avg score</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>30D High</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--green)' }}>
            {Math.max(...history.map(d => d.score))}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>peak score</div>
        </div>
        <div className="term-card p-4 text-center">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>30D Low</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--red)' }}>
            {Math.min(...history.map(d => d.score))}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>trough score</div>
        </div>
      </div>

      {/* SVG Line Chart */}
      <TerminalCard title="Market Health Score — 30 Day History" icon={<Activity size={12}/>} accent="cyan">
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }}>
            {/* Zone fills */}
            <rect x={PAD.left} y={yPos(100)} width={chartW} height={yPos(65) - yPos(100)} fill="rgba(0,200,60,0.05)"/>
            <rect x={PAD.left} y={yPos(65)}  width={chartW} height={yPos(40) - yPos(65)}  fill="rgba(255,200,0,0.05)"/>
            <rect x={PAD.left} y={yPos(40)}  width={chartW} height={yPos(0)  - yPos(40)}  fill="rgba(255,30,60,0.05)"/>

            {/* Y-axis ticks and labels */}
            {yTicks.map(v => (
              <g key={v}>
                <line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="#1f1f1f" strokeWidth={1}/>
                <text x={PAD.left - 4} y={yPos(v) + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{v}</text>
              </g>
            ))}

            {/* Zone labels */}
            <text x={W - PAD.right - 2} y={yPos(80)}  textAnchor="end" fontSize={8} fill="rgba(0,200,60,0.5)">Bullish</text>
            <text x={W - PAD.right - 2} y={yPos(52)}  textAnchor="end" fontSize={8} fill="rgba(255,200,0,0.5)">Neutral</text>
            <text x={W - PAD.right - 2} y={yPos(20)}  textAnchor="end" fontSize={8} fill="rgba(255,30,60,0.5)">Bearish</text>

            {/* Area fill under line */}
            <polygon
              points={`${xPos(0)},${PAD.top + chartH} ${points} ${xPos(history.length - 1)},${PAD.top + chartH}`}
              fill="rgba(0,200,255,0.07)"
            />

            {/* Line */}
            <polyline points={points} fill="none" stroke="var(--cyan)" strokeWidth={2} strokeLinejoin="round"/>

            {/* Data points — show every ~5th to avoid clutter on 30 days */}
            {history.map((d, i) => {
              const show = i === 0 || i === history.length - 1 || i % 5 === 0
              if (!show) return null
              return (
                <circle key={i}
                  cx={xPos(i)} cy={yPos(d.score)} r={3}
                  fill={scoreColor(d.score)}
                  stroke="#0a0a0a" strokeWidth={1}
                />
              )
            })}

            {/* X-axis labels: show every ~5th date */}
            {history.map((d, i) => {
              const show = i === 0 || i === history.length - 1 || i % 5 === 0
              if (!show) return null
              return (
                <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
                  {d.date.slice(5)}
                </text>
              )
            })}

            {/* Axes */}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#333" strokeWidth={1}/>
            <line x1={PAD.left} y1={PAD.top + chartH} x2={W - PAD.right} y2={PAD.top + chartH} stroke="#333" strokeWidth={1}/>
          </svg>
        </div>

        {/* Score legend */}
        <div className="flex gap-4 mt-2 flex-wrap" style={{ fontSize: 10 }}>
          <div className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, background: 'rgba(0,200,60,0.3)', border: '1px solid rgba(0,200,60,0.5)' }}/>
            <span style={{ color: 'var(--text-muted)' }}>Bullish (65-100)</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, background: 'rgba(255,200,0,0.3)', border: '1px solid rgba(255,200,0,0.5)' }}/>
            <span style={{ color: 'var(--text-muted)' }}>Neutral (40-64)</span>
          </div>
          <div className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, background: 'rgba(255,30,60,0.3)', border: '1px solid rgba(255,30,60,0.5)' }}/>
            <span style={{ color: 'var(--text-muted)' }}>Bearish (0-39)</span>
          </div>
        </div>
      </TerminalCard>

      {/* Recent history table */}
      <TerminalCard title="Daily Health Score Log" icon={<Layers size={12}/>} accent="amber" noPadding>
        <div className="overflow-auto" style={{ maxHeight: 260 }}>
          <table className="term-table text-xs">
            <thead>
              <tr>
                <th className="col-left">Date</th>
                <th className="col-right">Score</th>
                <th className="col-left">Regime</th>
                <th style={{ minWidth: 120 }}>Score Bar</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((d, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-dim)' }}>{d.date}</td>
                  <td className="col-right font-mono" style={{ color: scoreColor(d.score) }}>{d.score}</td>
                  <td style={{ color: scoreColor(d.score) }}>{d.label}</td>
                  <td>
                    <div className="h-2 rounded overflow-hidden" style={{ background: '#1a1a1a', minWidth: 100 }}>
                      <div className="h-full rounded" style={{
                        width: `${d.score}%`,
                        background: scoreColor(d.score),
                        opacity: 0.7,
                      }}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TerminalCard>
    </div>
  )
}
