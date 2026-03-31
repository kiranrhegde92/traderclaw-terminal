'use client'
import { useEffect, useLayoutEffect, useState } from 'react'

// useLayoutEffect runs before paint (no flash), falls back to useEffect on server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
import useSWR from 'swr'
import Link from 'next/link'
import { useMarketStore, useAuthStore } from '@/store'
import { formatCompact, formatPct } from '@/lib/utils/format'
import TerminalCard from '@/components/ui/TerminalCard'
import LandingScreen from '@/components/landing/LandingScreen'
import Topbar from '@/components/layout/Topbar'
import {
  TrendingUp, TrendingDown, BarChart2, Layers, Activity,
  Newspaper, Radio, GitBranch, BookOpen, ArrowUpRight,
  ArrowDownRight, Globe, Clock, Zap, X, Briefcase,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

/* ─── market session helper ─────────────────────────────────────────── */
function getSessionInfo() {
  const now   = new Date()
  const ist   = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const h = ist.getHours(), m = ist.getMinutes()
  const mins  = h * 60 + m
  const open  = 9 * 60 + 15
  const close = 15 * 60 + 30
  if (mins < open)  return { status: 'Pre-Market', color: 'var(--amber)', minsTo: open - mins }
  if (mins <= close) return { status: 'Open',      color: 'var(--green)', minsTo: close - mins }
  return { status: 'Closed', color: 'var(--red)', minsTo: null }
}

/* ─── Sparkline component ────────────────────────────────────────────── */
function Sparkline({ data, width = 80, height = 30 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const w = width - pad * 2
  const h = height - pad * 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w
    const y = pad + h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  const up = data[data.length - 1] >= data[0]
  const color = up ? 'var(--green)' : 'var(--red)'
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}

/* ─── generate sparkline from current price ─────────────────────────── */
function genSparkline(price: number, changePct: number, seed: number): number[] {
  const pts = 10
  const end = price
  const start = price / (1 + changePct / 100)
  const result: number[] = []
  // Simple pseudo-random using seed
  let s = seed
  function rand() {
    s = (s * 16807 + 0) % 2147483647
    return (s / 2147483647) - 0.5
  }
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1)
    const trend = start + (end - start) * t
    const noise = price * 0.003 * rand()
    result.push(trend + noise)
  }
  result[pts - 1] = end
  return result
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const { setIndices } = useMarketStore()
  const { isConnected, isOfflineMode, setOfflineMode, setSession } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [tick, setTick] = useState(0)

  useIsomorphicLayoutEffect(() => {
    setMounted(true)
    // Hydrate store after OAuth redirects (e.g. Zerodha callback lands here)
    if (!isConnected && !isOfflineMode) {
      fetch('/api/auth/session').then(r => r.json()).then(data => {
        if (data.connected && data.jwtToken) {
          setSession({
            jwtToken:  data.jwtToken,
            feedToken: data.feedToken ?? '',
            clientId:  data.clientCode,
            profile:   data.profile ?? { name: data.clientCode, email: '' },
          })
        }
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [healthOpen, setHealthOpen] = useState(false)
  const [fiiDays, setFiiDays] = useState(7)

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(t) }, [])

  const isMarketOpen = getSessionInfo().status === 'Open'

  const { data: indicesRes } = useSWR('/api/market/indices',       fetcher, { refreshInterval: isMarketOpen ? 10000  : 60000  })
  const { data: glRes }      = useSWR('/api/market/gainers-losers',fetcher, { refreshInterval: isMarketOpen ? 20000  : 120000 })
  const { data: fiiRes }     = useSWR(`/api/market/fii-dii?days=${fiiDays}`, fetcher, { refreshInterval: 3600000 })
  const { data: newsRes }    = useSWR('/api/news/feed?limit=10',   fetcher, { refreshInterval: isMarketOpen ? 60000  : 300000 })
  const { data: sectorRes }  = useSWR('/api/market/sectors',       fetcher, { refreshInterval: isMarketOpen ? 20000  : 120000 })
  const { data: breadthRes } = useSWR('/api/market/breadth',       fetcher, { refreshInterval: isMarketOpen ? 30000  : 120000 })
  const { data: globalRes }  = useSWR('/api/market/global',        fetcher, { refreshInterval: isMarketOpen ? 60000  : 300000 })
  const { data: portfolioSummaryRes } = useSWR(isConnected ? '/api/portfolio/summary' : null, fetcher, { refreshInterval: isMarketOpen ? 15000  : 120000 })
  const { data: sparklinesRes }       = useSWR('/api/market/sparklines',  fetcher, { refreshInterval: isMarketOpen ? 60000  : 600000 })

  const indices    = indicesRes?.data ?? []
  const gainers    = glRes?.data?.gainers ?? []
  const losers     = glRes?.data?.losers  ?? []
  const fiidii     = fiiRes?.data ?? []
  const news       = newsRes?.data ?? []
  const sectors    = sectorRes?.data ?? []
  const breadth    = breadthRes?.data
  const global     = globalRes?.data ?? []
  const sparklines = sparklinesRes?.data ?? {}

  useEffect(() => { if (indices.length) setIndices(indices) }, [indices, setIndices])

  const session  = getSessionInfo()
  const KEY_IDX  = ['NIFTY 50','NIFTY BANK','SENSEX','NIFTY FIN SERVICE','INDIA VIX']
  const SECT_IDX = ['NIFTY IT','NIFTY PHARMA','NIFTY AUTO','NIFTY METAL','NIFTY REALTY','NIFTY FMCG','NIFTY ENERGY','NIFTY INFRA']
  const displayIdx  = indices.filter((i: any) => KEY_IDX.includes(i.symbol))
  const sectorIdx   = indices.filter((i: any) => SECT_IDX.includes(i.symbol))

  // Merge sector API data with index data
  const allSectors = sectorIdx.length ? sectorIdx.map((s: any) => ({
    name:      s.symbol.replace('NIFTY ',''),
    changePct: s.changePct,
    ltp:       s.ltp,
  })) : sectors

  const vix    = indices.find((i: any) => i.symbol === 'INDIA VIX')
  const nifty  = indices.find((i: any) => i.symbol === 'NIFTY 50')
  const todayFII = fiidii[0]
  const recentFII = fiidii.slice(0, fiiDays)

  /* ── PCR estimate from FII net ── */
  const pcr = nifty ? (vix?.ltp ?? 15) > 18 ? 0.75 : (vix?.ltp ?? 15) > 14 ? 0.95 : 1.15 : null

  /* ── VIX gauge ── */
  const vixVal = vix?.ltp ?? 0
  const vixLabel = vixVal > 25 ? { label: 'Extreme Fear', color: 'var(--red)' }
    : vixVal > 18 ? { label: 'Fear',          color: 'var(--red)'   }
    : vixVal > 14 ? { label: 'Neutral',        color: 'var(--amber)' }
    : vixVal > 10 ? { label: 'Greed',          color: 'var(--green)' }
    : { label: 'Extreme Greed', color: 'var(--green)' }

  /* ── Health Score Breakdown (mirrors market/page logic) ── */
  const adRatio = breadth ? (breadth.declines > 0 ? breadth.advances / breadth.declines : 2) : 1
  const cumFII  = recentFII.reduce((s: number, d: any) => s + (d.fii_net ?? 0), 0)
  const breadthScore = breadth ? Math.round(Math.min(20, adRatio > 1 ? 20 : adRatio * 20)) : 10
  const vixScore     = vixVal < 14 ? 25 : vixVal < 18 ? 18 : vixVal < 25 ? 10 : 0
  const fiiScore     = cumFII > 0 ? 25 : cumFII > -2000 ? 15 : 8
  const niftyScore   = nifty ? (nifty.changePct > 0 ? 15 : nifty.changePct > -1 ? 10 : 5) : 8
  const globalScore  = global.length > 0
    ? Math.round((global.filter((g: any) => g.changePct > 0).length / global.length) * 15)
    : 8
  const healthTotal = Math.min(100, breadthScore + vixScore + fiiScore + niftyScore + globalScore)
  const healthColor = healthTotal >= 65 ? 'var(--green)' : healthTotal >= 40 ? 'var(--amber)' : 'var(--red)'
  const healthLabel = healthTotal >= 65 ? 'Bullish' : healthTotal >= 40 ? 'Neutral' : 'Bearish'

  const globalSentiment = global.length === 0 ? 'Mixed'
    : global.filter((g: any) => g.changePct > 0).length > global.length * 0.6 ? 'Positive'
    : global.filter((g: any) => g.changePct < 0).length > global.length * 0.6 ? 'Negative' : 'Mixed'

  /* ── Portfolio summary ── */
  const portSummary = portfolioSummaryRes

  if (!mounted) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh' }} />
  }

  if (!isConnected && !isOfflineMode) {
    return <LandingScreen onOfflineMode={setOfflineMode} />
  }

  return (
    <>
    <Topbar title="Dashboard" />
    <div className="space-y-4 animate-fade-in">

      {/* ── Row 0: Session banner ── */}
      <div className="flex items-center gap-3 px-1 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: session.color }}/>
          <span className="text-xs font-bold" style={{ color: session.color }}>{session.status}</span>
        </div>
        {session.minsTo != null && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <Clock size={10} className="inline mr-1"/>
            {session.status === 'Open'
              ? `Closes in ${Math.floor(session.minsTo / 60)}h ${session.minsTo % 60}m`
              : `Opens in ${Math.floor(session.minsTo / 60)}h ${session.minsTo % 60}m`}
          </span>
        )}
        {vixVal > 0 && (
          <span className="text-xs font-mono ml-auto" style={{ color: vixLabel.color }}>
            VIX {vixVal.toFixed(1)} — {vixLabel.label}
          </span>
        )}
        {nifty && (
          <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
            PE {nifty.pe != null ? (+nifty.pe).toFixed(1) : '—'} · PB {nifty.pb != null ? (+nifty.pb).toFixed(1) : '—'}
          </span>
        )}
      </div>

      {/* ── Row 0b: Portfolio P&L Summary Widget ── */}
      <PortfolioSummaryWidget data={portSummary} />

      {/* ── Row 1: Key Index Cards ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {displayIdx.map((idx: any) => <IndexCard key={idx.symbol} idx={idx} sparklineData={sparklines[idx.symbol]} />)}
      </div>

      {/* ── Row 2: Sector Heatmap ── */}
      {allSectors.length > 0 && (
        <TerminalCard title="Sector Performance" icon={<BarChart2 size={12}/>}  noPadding>
          <div className="flex flex-wrap gap-0 divide-x" style={{ borderColor: '#1a1a1a' }}>
            {allSectors.map((s: any) => {
              const up  = s.changePct >= 0
              const abs = Math.abs(s.changePct)
              const intensity = Math.min(abs / 3, 1)
              const bg  = up
                ? `rgba(0,255,65,${0.05 + intensity * 0.20})`
                : `rgba(255,0,64,${0.05 + intensity * 0.20})`
              return (
                <div key={s.name} className="flex-1 text-center py-3 px-2" style={{ background: bg, minWidth: 80 }}>
                  <div className="text-xs font-bold" style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                    {s.name.slice(0, 8)}
                  </div>
                  <div className="text-xs font-mono font-bold mt-0.5"
                    style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                    {up ? '+' : ''}{s.changePct.toFixed(2)}%
                  </div>
                </div>
              )
            })}
          </div>
        </TerminalCard>
      )}

      {/* ── Row 3: Breadth + Global + FII ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Market Breadth */}
        <div className="col-span-12 md:col-span-4">
          <TerminalCard title="Market Breadth" icon={<Activity size={12}/>} accent="cyan">
            {breadth ? (
              <div className="space-y-3">
                {/* A/D stacked bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--green)' }}>▲ {breadth.advances} Advancing</span>
                    <span style={{ color: 'var(--red)' }}>{breadth.declines} Declining ▼</span>
                  </div>
                  <div className="h-5 rounded overflow-hidden flex" style={{ background: '#1a1a1a' }}>
                    <div className="h-full flex items-center justify-center transition-all" style={{
                      width: `${(breadth.advances / (breadth.advances + breadth.declines + breadth.unchanged)) * 100}%`,
                      background: 'var(--green)', opacity: 0.75,
                    }}>
                      {breadth.advances > 50 && (
                        <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>{breadth.advances}</span>
                      )}
                    </div>
                    <div className="h-full flex items-center justify-center transition-all" style={{
                      width: `${(breadth.unchanged / (breadth.advances + breadth.declines + breadth.unchanged)) * 100}%`,
                      background: 'var(--text-muted)', opacity: 0.4,
                    }}>
                      {breadth.unchanged > 30 && (
                        <span style={{ color: 'var(--text)', fontSize: 9 }}>{breadth.unchanged}</span>
                      )}
                    </div>
                    <div className="h-full flex items-center justify-center transition-all" style={{
                      width: `${(breadth.declines / (breadth.advances + breadth.declines + breadth.unchanged)) * 100}%`,
                      background: 'var(--red)', opacity: 0.75,
                    }}>
                      {breadth.declines > 50 && (
                        <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>{breadth.declines}</span>
                      )}
                    </div>
                  </div>
                  {/* A/D Ratio line */}
                  <div className="flex justify-between text-xs mt-1">
                    <span style={{ color: 'var(--text-muted)' }}>
                      A/D Ratio: <span className="font-mono font-bold" style={{ color: adRatio > 1 ? 'var(--green)' : 'var(--red)' }}>
                        {adRatio.toFixed(2)}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}> ({adRatio > 1.2 ? 'Positive breadth' : adRatio < 0.8 ? 'Negative breadth' : 'Neutral'})</span>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Advances" value={breadth.advances} color="var(--green)"/>
                  <MiniStat label="Unchanged" value={breadth.unchanged} color="var(--text-dim)"/>
                  <MiniStat label="Declines" value={breadth.declines} color="var(--red)"/>
                </div>
                <div className="flex justify-between text-xs pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <span style={{ color: 'var(--text-muted)' }}>A/D Ratio</span>
                  <span className="font-mono" style={{
                    color: breadth.advances > breadth.declines ? 'var(--green)' : 'var(--red)'
                  }}>
                    {(breadth.advances / Math.max(breadth.declines, 1)).toFixed(2)}
                  </span>
                </div>
                {/* VIX + PCR row */}
                {vixVal > 0 && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>VIX Sentiment</span>
                    <span className="font-mono" style={{ color: vixLabel.color }}>{vixLabel.label}</span>
                  </div>
                )}
                {pcr && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>Est. PCR</span>
                    <span className="font-mono" style={{
                      color: pcr < 0.85 ? 'var(--red)' : pcr > 1.1 ? 'var(--green)' : 'var(--amber)'
                    }}>{pcr.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading breadth…</div>
            )}
          </TerminalCard>
        </div>

        {/* Global Markets */}
        <div className="col-span-12 md:col-span-4">
          <TerminalCard title="Global Markets" icon={<Globe size={12}/>} accent="amber">
            <div className="space-y-1.5">
              {global.length === 0 && (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
              )}
              {global.map((g: any) => (
                <div key={g.symbol} className="flex items-center justify-between py-0.5">
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{g.name}</span>
                  <div className="text-right">
                    <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                      {g.price >= 1000
                        ? g.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                        : g.price.toFixed(g.price < 10 ? 3 : 2)}
                    </span>
                    <span className="text-xs font-mono ml-2"
                      style={{ color: g.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {g.changePct >= 0 ? '+' : ''}{g.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TerminalCard>
        </div>

        {/* FII/DII with period selector */}
        <div className="col-span-12 md:col-span-4">
          <TerminalCard
            title="FII / DII Flow"
            icon={<Activity size={12}/>}
            accent="cyan"
            action={
              <div className="flex gap-1">
                {([7, 30, 90] as const).map(d => (
                  <button key={d} onClick={() => setFiiDays(d)}
                    className={`btn btn-sm ${fiiDays === d ? 'btn-cyan' : 'btn-ghost'}`}
                    style={{ padding: '1px 6px', fontSize: 10 }}>
                    {d}D
                  </button>
                ))}
              </div>
            }>
            {todayFII ? (
              <div className="space-y-3">
                <FIIBar label="FII Net" value={todayFII.fii_net}/>
                <FIIBar label="DII Net" value={todayFII.dii_net}/>
                {/* Period mini trend */}
                {recentFII.length > 1 && (
                  <div>
                    <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>FII Net ({fiiDays}d)</div>
                    <div className="flex items-end gap-1 h-10">
                      {recentFII.slice().reverse().map((d: any, i: number) => {
                        const maxAbs = Math.max(...recentFII.map((x: any) => Math.abs(x.fii_net)), 1)
                        const h = Math.max(4, (Math.abs(d.fii_net) / maxAbs) * 40)
                        return (
                          <div key={i} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.fii_net > 0 ? '+' : ''}${formatCompact(d.fii_net)}Cr`}>
                            <div className="rounded-sm w-full" style={{
                              height: h, background: d.fii_net >= 0 ? 'var(--green)' : 'var(--red)', opacity: 0.7,
                            }}/>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="pt-1 grid grid-cols-2 gap-x-4 gap-y-0.5" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <SmallRow label="FII Buy"  value={`${formatCompact(todayFII.fii_buy)}Cr`}  color="var(--green)"/>
                  <SmallRow label="FII Sell" value={`${formatCompact(todayFII.fii_sell)}Cr`} color="var(--red)"/>
                  <SmallRow label="DII Buy"  value={`${formatCompact(todayFII.dii_buy)}Cr`}  color="var(--green)"/>
                  <SmallRow label="DII Sell" value={`${formatCompact(todayFII.dii_sell)}Cr`} color="var(--red)"/>
                </div>
              </div>
            ) : (
              <div className="text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
            )}
          </TerminalCard>
        </div>
      </div>

      {/* ── Market Health Score (full-width card with drill-down) ── */}
      <TerminalCard
        title="Market Health Score"
        icon={<Activity size={12}/>}
        accent="cyan"
        action={
          <button onClick={() => setHealthOpen(o => !o)}
            className="btn btn-sm btn-ghost"
            style={{ fontSize: 10 }}>
            {healthOpen ? 'Collapse ▲' : 'Details ▼'}
          </button>
        }>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setHealthOpen(o => !o)}
            className="text-5xl font-bold font-mono cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: healthColor, background: 'none', border: 'none', padding: 0 }}>
            {healthTotal}
          </button>
          <div>
            <div className="text-sm font-bold" style={{ color: healthColor }}>{healthLabel}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>out of 100 · click to drill down</div>
          </div>
          <div className="flex-1 h-2 rounded-full ml-2" style={{ background: '#1a1a1a' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${healthTotal}%`, background: healthColor }}/>
          </div>
        </div>

        {healthOpen && (
          <div className="mt-4 space-y-2 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
            <HealthRow
              label="Breadth Score"
              score={breadthScore} max={20}
              detail={breadth ? `Advances: ${breadth.advances}, Declines: ${breadth.declines}` : 'No breadth data'}
            />
            <HealthRow
              label="VIX Score"
              score={vixScore} max={25}
              detail={vixVal > 0 ? `VIX at ${vixVal.toFixed(1)} (${vixLabel.label})` : 'No VIX data'}
            />
            <HealthRow
              label="FII Score"
              score={fiiScore} max={25}
              detail={cumFII !== 0 ? `FII Net: ₹${formatCompact(cumFII)}Cr (${cumFII >= 0 ? 'Buying' : 'Selling'})` : 'No FII data'}
            />
            <HealthRow
              label="NIFTY Trend"
              score={niftyScore} max={15}
              detail={nifty ? `${nifty.changePct >= 0 ? '+' : ''}${nifty.changePct?.toFixed(2)}%` : 'No NIFTY data'}
            />
            <HealthRow
              label="Global Score"
              score={globalScore} max={15}
              detail={globalSentiment}
            />
          </div>
        )}
      </TerminalCard>

      {/* ── Row 4: Gainers + Losers + News ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Gainers */}
        <div className="col-span-12 md:col-span-3">
          <TerminalCard title="Top Gainers" icon={<TrendingUp size={12}/>} accent="green"
            action={<Link href="/market" className="text-xs" style={{ color:'var(--text-muted)' }}>all →</Link>}>
            <div className="space-y-0.5">
              {gainers.slice(0, 10).map((s: any) => <StockRow key={s.symbol} stock={s} up/>)}
              {gainers.length === 0 && <EmptyRow/>}
            </div>
          </TerminalCard>
        </div>

        {/* Losers */}
        <div className="col-span-12 md:col-span-3">
          <TerminalCard title="Top Losers" icon={<TrendingDown size={12}/>} accent="red"
            action={<Link href="/market" className="text-xs" style={{ color:'var(--text-muted)' }}>all →</Link>}>
            <div className="space-y-0.5">
              {losers.slice(0, 10).map((s: any) => <StockRow key={s.symbol} stock={s} up={false}/>)}
              {losers.length === 0 && <EmptyRow/>}
            </div>
          </TerminalCard>
        </div>

        {/* News */}
        <div className="col-span-12 md:col-span-6">
          <TerminalCard title="Market News" icon={<Newspaper size={12}/>} accent="amber"
            action={<Link href="/news" className="text-xs" style={{ color:'var(--text-muted)' }}>all →</Link>}>
            <div className="space-y-0">
              {news.slice(0, 8).map((n: any, i: number) => (
                <div key={n.id ?? n.url ?? i}
                  className="flex items-start gap-2 py-2 border-b last:border-b-0"
                  style={{ borderColor: '#1a1a1a' }}>
                  <span className={`badge flex-shrink-0 mt-0.5 badge-${
                    n.sentiment === 'positive' ? 'green' : n.sentiment === 'negative' ? 'red' : 'dim'
                  }`} style={{ fontSize: 9 }}>
                    {n.sentiment === 'positive' ? '▲' : n.sentiment === 'negative' ? '▼' : '●'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs leading-snug hover:underline block"
                      style={{ color:'var(--text)', textDecoration:'none' }}>
                      {n.title}
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span style={{ color:'var(--text-muted)', fontSize:10 }}>{n.source}</span>
                      {n.publishedAt && (
                        <span style={{ color:'var(--text-muted)', fontSize:9, opacity:0.6 }}>
                          · {new Date(n.publishedAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {news.length === 0 && <EmptyRow label="Fetching news…"/>}
            </div>
          </TerminalCard>
        </div>
      </div>

      {/* ── Row 5: Quick Access ── */}
      <TerminalCard title="Quick Access" icon={<Zap size={12}/>}  noPadding>
        <div className="flex flex-wrap gap-0 divide-x" style={{ borderColor: '#1a1a1a' }}>
          {[
            { href:'/screener',    label:'Screener',    icon:'📊', color:'var(--green)'  },
            { href:'/options',     label:'Options',     icon:'⚡', color:'var(--cyan)'   },
            { href:'/strategies',  label:'Strategies',  icon:'🎯', color:'var(--amber)'  },
            { href:'/paper-trade', label:'Paper Trade', icon:'📋', color:'var(--green)'  },
            { href:'/monitor',     label:'Monitor',     icon:'📡', color:'var(--cyan)'   },
            { href:'/portfolio',   label:'Portfolio',   icon:'💼', color:'var(--amber)'  },
            { href:'/news',        label:'News Feed',   icon:'📰', color:'var(--text-dim)'},
            { href:'/market',      label:'Market',      icon:'🏛',  color:'var(--text-dim)'},
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-white/5 transition-all"
              style={{ textDecoration:'none', minWidth:80 }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <span className="text-xs" style={{ color:'var(--text-dim)', fontFamily:'JetBrains Mono', fontSize:10 }}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </TerminalCard>

    </div>
    </>
  )
}

/* ─── Health Score Row ───────────────────────────────────────────────── */
function HealthRow({ label, score, max, detail }: { label: string; score: number; max: number; detail: string }) {
  const pct = (score / max) * 100
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs w-28 shrink-0" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: '#1a1a1a' }}>
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.8 }}/>
      </div>
      <div className="text-xs font-mono w-16 text-right shrink-0" style={{ color }}>
        {score}/{max} pts
      </div>
      <div className="text-xs shrink-0" style={{ color: 'var(--text-muted)', minWidth: 160 }}>{detail}</div>
    </div>
  )
}

/* ─── Portfolio Summary Widget ───────────────────────────────────────── */
function PortfolioSummaryWidget({ data }: { data: any }) {
  if (!data) return null

  if (!data.connected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded text-xs"
        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <Briefcase size={12} style={{ color: 'var(--text-muted)' }}/>
        <span style={{ color: 'var(--text-muted)' }}>Connect a broker to see portfolio P&amp;L</span>
        <Link href="/connect" className="btn btn-sm btn-ghost ml-auto" style={{ textDecoration: 'none', fontSize: 10 }}>
          Connect →
        </Link>
      </div>
    )
  }

  const { totalValue, totalCost, totalPnl, todayPnl, todayPnlPct, totalPnlPct, holdings } = data
  const todayUp  = (todayPnl ?? 0) >= 0
  const totalUp  = (totalPnl ?? 0) >= 0

  return (
    <div className="flex items-center gap-4 px-3 py-2 rounded flex-wrap"
      style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <Briefcase size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Portfolio</span>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
        {holdings} holdings · ₹{totalValue?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>
      <span className="text-xs font-mono font-bold" style={{ color: todayUp ? 'var(--green)' : 'var(--red)' }}>
        Today: {todayUp ? '+' : '−'}₹{Math.abs(todayPnl ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        {todayPnlPct != null && ` (${todayUp ? '+' : ''}${todayPnlPct.toFixed(2)}%)`}
      </span>
      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>·</span>
      <span className="text-xs font-mono font-bold" style={{ color: totalUp ? 'var(--green)' : 'var(--red)' }}>
        Total: {totalUp ? '+' : '−'}₹{Math.abs(totalPnl ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        {totalPnlPct != null && ` (${totalUp ? '+' : ''}${totalPnlPct.toFixed(2)}%)`}
      </span>
      <Link href="/portfolio" className="ml-auto text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
        View →
      </Link>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function IndexCard({ idx, sparklineData }: { idx: any; sparklineData?: number[] }) {
  const isVix = idx.symbol.includes('VIX')
  const up    = idx.changePct >= 0
  const label = idx.symbol
    .replace('NIFTY FIN SERVICE','FIN SVC')
    .replace('NIFTY ','')
    .replace('NIFTY','NIFTY50')

  // Use real 5-day sparkline data when available; fall back to generated curve
  const seed      = idx.symbol.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
  const sparkData = !isVix
    ? (sparklineData && sparklineData.length >= 2 ? sparklineData : genSparkline(idx.ltp, idx.changePct, seed))
    : null

  return (
    <Link href={isVix ? '/market' : `/options?symbol=${encodeURIComponent(idx.symbol)}`}
      className="term-card p-3 block transition-all"
      style={{ textDecoration:'none' }}>
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs font-bold" style={{ color:'var(--text-dim)' }}>{label}</div>
        <span className="text-xs font-bold flex items-center gap-0.5"
          style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
          {up ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
          {formatPct(idx.changePct)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div className="text-xl font-bold font-mono" style={{ color:'var(--text)' }}>
          {idx.ltp.toLocaleString('en-IN', { maximumFractionDigits: isVix ? 2 : 1 })}
        </div>
        {sparkData && <Sparkline data={sparkData} width={80} height={30} />}
      </div>
      <div className="flex justify-between mt-1" style={{ color:'var(--text-muted)', fontSize:10 }}>
        <span>H {idx.high.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        <span>L {idx.low.toLocaleString('en-IN',  { maximumFractionDigits: 0 })}</span>
        <span className="font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
          {up ? '+' : ''}{(+idx.change).toFixed(1)}
        </span>
      </div>
      {/* Mini progress: where current sits between high and low */}
      {idx.high !== idx.low && (
        <div className="h-0.5 rounded-full mt-1.5" style={{ background:'#1a1a1a' }}>
          <div className="h-full rounded-full" style={{
            width: `${((idx.ltp - idx.low) / (idx.high - idx.low)) * 100}%`,
            background: up ? 'var(--green)' : 'var(--red)', opacity: 0.6,
          }}/>
        </div>
      )}
    </Link>
  )
}

function StockRow({ stock, up }: { stock: any; up: boolean }) {
  return (
    <Link href={`/monitor?symbol=${stock.symbol}`}
      className="flex items-center justify-between py-1 px-1 rounded hover:bg-white/5 transition-all"
      style={{ textDecoration:'none' }}>
      <div>
        <div className="text-xs font-bold" style={{ color:'var(--text)' }}>{stock.symbol}</div>
        <div className="font-mono" style={{ color:'var(--text-muted)', fontSize:10 }}>
          ₹{stock.ltp?.toLocaleString('en-IN')}
        </div>
      </div>
      <div className="text-xs font-bold font-mono" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
        {up ? '+' : ''}{formatPct(stock.changePct)}
      </div>
    </Link>
  )
}

function FIIBar({ label, value }: { label: string; value: number }) {
  const maxVal = 5000
  const pct    = Math.min(100, (Math.abs(value) / maxVal) * 100)
  const isPos  = value >= 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color:'var(--text-dim)' }}>{label}</span>
        <span className="font-mono" style={{ color: isPos ? 'var(--green)' : 'var(--red)' }}>
          {isPos ? '+' : ''}{formatCompact(value)} Cr
        </span>
      </div>
      <div className="h-2 rounded overflow-hidden" style={{ background:'#1a1a1a' }}>
        <div className="h-full rounded transition-all"
          style={{ width:`${pct}%`, background: isPos ? 'var(--green)' : 'var(--red)', opacity:0.7 }}/>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
      <div style={{ color:'var(--text-muted)', fontSize:10 }}>{label}</div>
    </div>
  )
}

function SmallRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color:'var(--text-muted)' }}>{label}</span>
      <span className="font-mono" style={{ color }}>{value}</span>
    </div>
  )
}

function EmptyRow({ label = 'No data available' }: { label?: string }) {
  return <div className="py-4 text-center text-xs" style={{ color:'var(--text-muted)' }}>{label}</div>
}
