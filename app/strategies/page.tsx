'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar      from '@/components/layout/Topbar'
import Spinner     from '@/components/ui/Spinner'
import Modal       from '@/components/ui/Modal'
import { formatINR } from '@/lib/utils/format'
import {
  GitBranch, Plus, Trash2, Play, Save, TrendingUp,
  Search, X, Settings, ChevronDown, ChevronUp,
  RefreshCw, FileText, DollarSign,
} from 'lucide-react'
import { STRATEGY_TEMPLATES } from '@/lib/options/strategies'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Bullish', 'Bearish', 'Neutral', 'Volatile']

const UNDERLYINGS: Record<string, { lotSize: number; label: string; strikeStep: number }> = {
  NIFTY:      { lotSize: 75,   label: 'Nifty 50',      strikeStep: 50  },
  BANKNIFTY:  { lotSize: 30,   label: 'Bank Nifty',    strikeStep: 100 },
  FINNIFTY:   { lotSize: 40,   label: 'Fin Nifty',     strikeStep: 50  },
  MIDCPNIFTY: { lotSize: 75,   label: 'Midcap Nifty',  strikeStep: 25  },
  SENSEX:     { lotSize: 10,   label: 'Sensex',        strikeStep: 100 },
  BANKEX:     { lotSize: 15,   label: 'Bankex',        strikeStep: 100 },
  RELIANCE:   { lotSize: 250,  label: 'Reliance',      strikeStep: 20  },
  HDFCBANK:   { lotSize: 550,  label: 'HDFC Bank',     strikeStep: 10  },
  INFY:       { lotSize: 400,  label: 'Infosys',       strikeStep: 20  },
  TCS:        { lotSize: 150,  label: 'TCS',           strikeStep: 50  },
  ICICIBANK:  { lotSize: 700,  label: 'ICICI Bank',    strikeStep: 10  },
  SBIN:       { lotSize: 1500, label: 'SBI',           strikeStep: 5   },
  BAJFINANCE: { lotSize: 125,  label: 'Bajaj Finance', strikeStep: 50  },
  TATAMOTORS: { lotSize: 1400, label: 'Tata Motors',   strikeStep: 5   },
  WIPRO:      { lotSize: 1500, label: 'Wipro',         strikeStep: 5   },
  ADANIENT:   { lotSize: 625,  label: 'Adani Ent.',    strikeStep: 20  },
  AXISBANK:   { lotSize: 625,  label: 'Axis Bank',     strikeStep: 10  },
  KOTAKBANK:  { lotSize: 400,  label: 'Kotak Bank',    strikeStep: 20  },
  MARUTI:     { lotSize: 100,  label: 'Maruti',        strikeStep: 100 },
  LT:         { lotSize: 175,  label: 'L&T',           strikeStep: 20  },
}

const EXPIRY_OPTIONS = [
  { value: 'CW', label: 'Current Week'  },
  { value: 'NW', label: 'Next Week'     },
  { value: 'W2', label: 'Week +2'       },
  { value: 'CM', label: 'Current Month' },
  { value: 'NM', label: 'Next Month'    },
  { value: 'FM', label: 'Far Month (Q)' },
]

// For CE:  offset -3=ITM3, -2=ITM2, -1=ITM1, 0=ATM, 1=OTM1 …
// For PE:  offset  3=ITM3,  2=ITM2,  1=ITM1, 0=ATM,-1=OTM1 …
const STRIKE_LABELS = ['ITM3','ITM2','ITM1','ATM','OTM1','OTM2','OTM3','OTM4','OTM5']

function labelToOffset(label: string, type: 'CE'|'PE'|'FUT'): number {
  if (type === 'FUT' || label === 'ATM') return 0
  const m = label.match(/^(ITM|OTM)(\d)$/)
  if (!m) return 0
  const n   = parseInt(m[2])
  const raw = m[1] === 'ITM' ? -n : n        // CE convention
  return type === 'PE' ? -raw : raw
}

function offsetToLabel(offset: number, type: 'CE'|'PE'|'FUT'): string {
  if (type === 'FUT') return 'FUT'
  const n = type === 'PE' ? -offset : offset  // normalise to CE convention
  if (n === 0)  return 'ATM'
  if (n < 0)    return `ITM${Math.abs(n)}`
  return `OTM${n}`
}

// ─── Default state factories ───────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  startTime:      '09:20',
  endTime:        '15:15',
  squareOffTime:  '15:20',
  slType:         'percent' as 'percent'|'points',
  slValue:        30,
  targetType:     'percent' as 'percent'|'points',
  targetValue:    50,
  trailingSL:     false,
  trailStep:      10,
  maxLossDay:     10000,
  maxProfitDay:   0,
  reEntryEnabled: false,
  reEntryCount:   1,
  lotMultiplier:  1,
}

function makeLeg(underlying: string) {
  return {
    type:         'CE'     as 'CE'|'PE'|'FUT',
    action:       'SELL'   as 'BUY'|'SELL',
    strikeLabel:  'OTM1',
    strikeOffset: 1,
    expiryType:   'CW',
    lots:         1,
    lotSize:      UNDERLYINGS[underlying]?.lotSize ?? 75,
    premium:      0,
    // advanced
    entryType:    'MARKET' as 'MARKET'|'LIMIT'|'SLM',
    waitAndTrade: false,
    waitPrice:    0,
    legSLType:    'percent' as 'percent'|'points',
    legSLValue:   50,
    legTgtType:   'percent' as 'percent'|'points',
    legTgtValue:  100,
    trailSL:      false,
    trailValue:   25,
    reEntry:      0,
    reEntryType:  'onSL'   as 'onSL'|'onTarget',
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

function StrategiesPageInner() {
  const sp     = useSearchParams()
  const router = useRouter()

  // template panel
  const [category, setCategory] = useState('All')
  const [search,   setSearch]   = useState('')

  // builder state
  const [strategyName, setStrategyName] = useState('Untitled Strategy')
  const [underlying,   setUnderlying]   = useState(sp.get('underlying') ?? 'NIFTY')
  const [spotPrice,    setSpotPrice]    = useState(24000)
  const [legs,         setLegs]         = useState<ReturnType<typeof makeLeg>[]>([])
  const [payoff,       setPayoff]       = useState<any>(null)
  const [loading,      setLoading]      = useState(false)

  // option chain cache for premium auto-fill
  const [chainStrikes, setChainStrikes] = useState<any[]>([])
  const [chainExpiries, setChainExpiries] = useState<string[]>([])
  const [premiumLoading, setPremiumLoading] = useState(false)

  // config panel
  const [config,      setConfig]     = useState(DEFAULT_CONFIG)
  const [showConfig,  setShowConfig] = useState(false)

  // per-leg expand
  const [expandedLegs, setExpandedLegs] = useState<Record<number, boolean>>({})

  // deploy modal
  const [deployModal,  setDeployModal]  = useState(false)
  const [deployTarget, setDeployTarget] = useState<'paper'|'live'>('paper')

  // deploy confirmation (leg preview)
  const [deployConfirm, setDeployConfirm] = useState(false)

  // payoff tab: 'chart' | 'scenario' | 'greeks'
  const [payoffTab, setPayoffTab] = useState<'chart'|'scenario'|'greeks'>('chart')

  // import from options chain leg preview
  const [importPreviewOpen, setImportPreviewOpen] = useState(false)
  const [importedLegs, setImportedLegs] = useState<any[]>([])

  // monitor data for performance tracking
  const [monitorData, setMonitorData] = useState<any[]>([])

  const [savedStrategies, setSavedStrategies] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/strategies').then(r => r.json()).then(d => setSavedStrategies(d.data ?? []))
    fetch('/api/paper-trade/monitor?accountId=1').then(r => r.json()).then(d => setMonitorData(d.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    const p = sp.get('legs')
    if (p) { try { setLegs(JSON.parse(p)) } catch {} }
  }, [sp])

  // Fetch option chain whenever underlying changes
  useEffect(() => {
    setPremiumLoading(true)
    fetch(`/api/options/chain?symbol=${underlying}&expiry=`)
      .then(r => r.json())
      .then(d => {
        const chain = d.data
        if (!chain) return
        setChainStrikes(chain.strikes ?? [])
        setChainExpiries(chain.expiries ?? [])
        if (chain.spotPrice) setSpotPrice(chain.spotPrice)
        // Auto-fill premiums once chain loads
        fillPremiumsFromChain(chain.strikes ?? [], chain.spotPrice ?? 24000)
      })
      .catch(() => {})
      .finally(() => setPremiumLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [underlying])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const info = UNDERLYINGS[underlying] ?? { lotSize: 75, strikeStep: 50, label: underlying }

  const filteredTemplates = STRATEGY_TEMPLATES.filter(t => {
    const mc = category === 'All' || t.category === category
    const q  = search.toLowerCase()
    const ms = !q || t.name.toLowerCase().includes(q)
                  || t.description.toLowerCase().includes(q)
                  || t.marketOutlook.toLowerCase().includes(q)
    return mc && ms
  })

  const margin = (() => {
    let debit = 0, credit = 0, sellMargin = 0
    legs.forEach(leg => {
      const val = leg.lots * leg.lotSize * (leg.premium || 0)
      if (leg.action === 'BUY') debit += val
      else { credit += val; sellMargin += leg.lots * leg.lotSize * spotPrice * 0.14 }
    })
    const capitalRequired = debit + Math.max(sellMargin - credit, 0)
    return { debit, credit, net: credit - debit, capitalRequired, sellMargin,
             hasSell: legs.some(l => l.action === 'SELL') }
  })()

  // ─── Actions ────────────────────────────────────────────────────────────────

  function newStrategy() {
    setStrategyName('Untitled Strategy')
    setLegs([])
    setPayoff(null)
    setExpandedLegs({})
  }

  function clearLegs() {
    setLegs([])
    setPayoff(null)
    setExpandedLegs({})
  }

  function applyTemplate(t: typeof STRATEGY_TEMPLATES[0]) {
    setStrategyName(t.name)
    const newLegs = t.legs.map(l => ({
      ...makeLeg(underlying),
      type:         l.type  as 'CE'|'PE'|'FUT',
      action:       l.action as 'BUY'|'SELL',
      strikeOffset: l.strikeOffset,
      strikeLabel:  offsetToLabel(l.strikeOffset, l.type as 'CE'|'PE'|'FUT'),
    }))
    // Fill premiums from cached chain
    if (chainStrikes.length) {
      const step = UNDERLYINGS[underlying]?.strikeStep ?? 50
      const atm  = Math.round(spotPrice / step) * step
      newLegs.forEach(leg => {
        if (leg.type === 'FUT') return
        const actualStrike = atm + leg.strikeOffset * step
        const match = chainStrikes.find((s: any) => s.strikePrice === actualStrike)
        if (match) {
          const premium = leg.type === 'CE' ? (match.ce_ltp ?? 0) : (match.pe_ltp ?? 0)
          if (premium > 0) leg.premium = premium
        }
      })
    }
    setLegs(newLegs)
    setPayoff(null)
    setExpandedLegs({})
  }

  function addLeg() {
    setLegs(l => [...l, makeLeg(underlying)])
  }

  function removeLeg(i: number) {
    setLegs(l => l.filter((_, j) => j !== i))
    setExpandedLegs(prev => {
      const next: Record<number, boolean> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const n = +k
        if (n !== i) next[n > i ? n - 1 : n] = v
      })
      return next
    })
  }

  // Fill premiums from chain data (doesn't depend on state, takes args directly)
  function fillPremiumsFromChain(strikes: any[], spot: number) {
    if (!strikes.length) return
    const step = UNDERLYINGS[underlying]?.strikeStep ?? 50
    const atm  = Math.round(spot / step) * step
    setLegs(prev => prev.map(leg => {
      if (leg.type === 'FUT') return leg
      const actualStrike = atm + leg.strikeOffset * step
      const match = strikes.find((s: any) => s.strikePrice === actualStrike)
      if (!match) return leg
      const premium = leg.type === 'CE' ? (match.ce_ltp ?? 0) : (match.pe_ltp ?? 0)
      return premium > 0 ? { ...leg, premium } : leg
    }))
  }

  async function refreshPremiums() {
    if (!chainStrikes.length) return
    fillPremiumsFromChain(chainStrikes, spotPrice)
  }

  function updateLeg(i: number, key: string, val: any) {
    setLegs(l => l.map((leg, j) => {
      if (j !== i) return leg
      const u = { ...leg, [key]: val }
      if (key === 'strikeLabel')  u.strikeOffset = labelToOffset(val, u.type)
      if (key === 'strikeOffset') u.strikeLabel  = offsetToLabel(val, u.type)
      if (key === 'type')         u.strikeLabel  = offsetToLabel(u.strikeOffset, val)
      // Auto-fill premium when strike or type changes
      if ((key === 'strikeLabel' || key === 'strikeOffset' || key === 'type') && chainStrikes.length) {
        const step = UNDERLYINGS[underlying]?.strikeStep ?? 50
        const atm  = Math.round(spotPrice / step) * step
        const actualStrike = atm + u.strikeOffset * step
        const match = chainStrikes.find((s: any) => s.strikePrice === actualStrike)
        if (match) {
          const t = key === 'type' ? val : u.type
          const premium = t === 'CE' ? (match.ce_ltp ?? 0) : (match.pe_ltp ?? 0)
          if (premium > 0) u.premium = premium
        }
      }
      return u
    }))
  }

  function changeUnderlying(sym: string) {
    setUnderlying(sym)
    const ls = UNDERLYINGS[sym]?.lotSize ?? 75
    setLegs(l => l.map(leg => ({ ...leg, lotSize: ls })))
  }

  function toggleLegExpand(i: number) {
    setExpandedLegs(prev => ({ ...prev, [i]: !prev[i] }))
  }

  function updateConfig(key: string, val: any) {
    setConfig(c => ({ ...c, [key]: val }))
  }

  async function computePayoff() {
    if (!legs.length) return
    setLoading(true)
    try {
      const atm = Math.round(spotPrice / info.strikeStep) * info.strikeStep
      const concretLegs = legs.map(l => ({
        ...l,
        strike: atm + l.strikeOffset * info.strikeStep,
      }))
      const res  = await fetch('/api/strategies/payoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ legs: concretLegs, spotRef: spotPrice }),
      })
      const json = await res.json()
      setPayoff(json.data)
    } finally { setLoading(false) }
  }

  async function saveStrategy() {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: strategyName, underlying, expiryDate: '', legs, status: 'DRAFT', config }),
    })
    const json = await res.json()
    if (res.ok) setSavedStrategies(s => [...s, { id: json.id, name: strategyName, underlying, legs, status: 'DRAFT' }])
  }

  async function deploy() {
    const res  = await fetch('/api/strategies/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: deployTarget, legs, underlying, name: strategyName, config }),
    })
    const json = await res.json()
    setDeployModal(false)
    if (!res.ok) { alert(`Deploy failed: ${json.error}`); return }
    if (deployTarget === 'paper') router.push('/paper-trade')
  }

  function openImportPreview() {
    try {
      const raw = localStorage.getItem('selectedLegs')
      if (!raw) { alert('No legs found in options chain selection. Select legs on the Options Chain page first.'); return }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) { alert('No legs selected from options chain.'); return }
      setImportedLegs(parsed)
      setImportPreviewOpen(true)
    } catch {
      alert('Failed to read selected legs from options chain.')
    }
  }

  function confirmImportLegs() {
    const step = UNDERLYINGS[underlying]?.strikeStep ?? 50
    const atm  = Math.round(spotPrice / step) * step
    const newLegs = importedLegs.map((il: any) => {
      const base = makeLeg(underlying)
      const type = (il.type === 'CE' || il.type === 'PE') ? il.type : 'CE'
      const strike = il.strike ?? il.strikePrice ?? atm
      const offset = Math.round((strike - atm) / step)
      return {
        ...base,
        type:         type as 'CE'|'PE'|'FUT',
        action:       (il.action === 'BUY' || il.action === 'SELL') ? il.action as 'BUY'|'SELL' : 'BUY',
        strikeOffset: offset,
        strikeLabel:  offsetToLabel(offset, type as 'CE'|'PE'),
        lots:         il.lots ?? il.quantity ?? 1,
        premium:      il.premium ?? il.ltp ?? 0,
      }
    })
    setLegs(prev => [...prev, ...newLegs])
    setImportPreviewOpen(false)
    setImportedLegs([])
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Topbar title="Strategy Builder" />
      <div className="page-content space-y-4">
        <div className="grid grid-cols-12 gap-4">

          {/* ── Template Library ── */}
          <div className="col-span-12 lg:col-span-3">
            <TerminalCard
              title={`Templates (${filteredTemplates.length}/${STRATEGY_TEMPLATES.length})`}
              icon={<GitBranch size={12}/>} accent="amber" noPadding>

              <div className="p-2 border-b" style={{ borderColor: '#1e1e1e' }}>
                <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
                  <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                  <input type="text" placeholder="Search strategies…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-full" style={{ color: 'var(--text)' }}/>
                  {search && <button onClick={() => setSearch('')}><X size={10} style={{ color: 'var(--text-muted)' }}/></button>}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: '#1e1e1e' }}>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`btn btn-sm ${category === c ? 'btn-amber' : 'btn-ghost'}`}>{c}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: 580 }}>
                {filteredTemplates.length === 0 && (
                  <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No strategies match</div>
                )}
                {filteredTemplates.map(t => (
                  <div key={t.name}
                    className="p-3 border-b cursor-pointer hover:bg-white/5 transition-all"
                    style={{ borderColor: '#1a1a1a' }} onClick={() => applyTemplate(t)}>
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{t.name}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs px-1 rounded" style={{ background: '#1a1a1a', color: 'var(--text-muted)' }}>{t.legs.length}L</span>
                        <span className={`badge badge-${t.category === 'Bullish' ? 'green' : t.category === 'Bearish' ? 'red' : t.category === 'Volatile' ? 'amber' : 'dim'}`}>
                          {t.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.description}</div>
                    <div className="flex gap-3 mt-1 text-xs">
                      <span style={{ color: 'var(--green)' }}>↑ {t.maxProfit}</span>
                      <span style={{ color: 'var(--red)'   }}>↓ {t.maxLoss}</span>
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>{t.marketOutlook}</div>
                  </div>
                ))}
              </div>
            </TerminalCard>
          </div>

          {/* ── Builder ── */}
          <div className="col-span-12 lg:col-span-9 space-y-4">

            {/* Strategy header */}
            <TerminalCard noPadding>
              <div className="p-3 space-y-3">
                {/* Name row */}
                <div className="flex items-center gap-2">
                  <input type="text" value={strategyName}
                    onChange={e => setStrategyName(e.target.value)}
                    className="term-input flex-1 font-bold" style={{ fontSize: 13 }}
                    placeholder="Strategy name"/>
                  <button onClick={newStrategy} className="btn btn-sm btn-ghost">
                    <FileText size={11}/> New
                  </button>
                  <button onClick={clearLegs} disabled={!legs.length} className="btn btn-sm btn-ghost">
                    <RefreshCw size={11}/> Clear
                  </button>
                </div>
                {/* Underlying + Spot + Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Underlying</span>
                    <select value={underlying} onChange={e => changeUnderlying(e.target.value)} className="term-select">
                      <optgroup label="Indices">
                        {['NIFTY','BANKNIFTY','FINNIFTY','MIDCPNIFTY','SENSEX','BANKEX'].map(s =>
                          <option key={s} value={s}>{s}</option>
                        )}
                      </optgroup>
                      <optgroup label="Stocks">
                        {['RELIANCE','HDFCBANK','INFY','TCS','ICICIBANK','SBIN','BAJFINANCE','TATAMOTORS','WIPRO','ADANIENT','AXISBANK','KOTAKBANK','MARUTI','LT'].map(s =>
                          <option key={s} value={s}>{s}</option>
                        )}
                      </optgroup>
                    </select>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a1a1a', color: 'var(--text-muted)' }}>
                      Lot: {info.lotSize} · Step: {info.strikeStep}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Spot ≈</span>
                    <input type="number" value={spotPrice}
                      onChange={e => setSpotPrice(+e.target.value)}
                      className="term-input" style={{ width: 95 }}/>
                    <button onClick={refreshPremiums} disabled={premiumLoading || !chainStrikes.length}
                      className="btn btn-sm btn-ghost" title="Refresh premiums from live chain">
                      {premiumLoading ? <Spinner size={10}/> : <RefreshCw size={10}/>}
                      <span className="text-xs ml-1">{premiumLoading ? 'Loading…' : 'Premiums'}</span>
                    </button>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button onClick={openImportPreview} className="btn btn-ghost btn-sm" title="Import legs from Options Chain selection">
                      <FileText size={12}/> Import Chain
                    </button>
                    <button onClick={computePayoff} disabled={!legs.length || loading} className="btn btn-cyan">
                      {loading ? <Spinner size={12}/> : <TrendingUp size={12}/>} P&amp;L
                    </button>
                    <button onClick={saveStrategy} disabled={!legs.length} className="btn btn-ghost">
                      <Save size={12}/> Save
                    </button>
                    <button onClick={() => { setDeployModal(true); setDeployConfirm(false) }} disabled={!legs.length} className="btn btn-amber">
                      <Play size={12}/> Deploy
                    </button>
                  </div>
                </div>
              </div>
            </TerminalCard>

            {/* ── Generic Config ── */}
            <TerminalCard
              title="Strategy Configuration"
              icon={<Settings size={12}/>}
              
              noPadding
              action={
                <button onClick={() => setShowConfig(v => !v)} className="btn btn-sm btn-ghost">
                  {showConfig ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                  {showConfig ? 'Collapse' : 'Expand'}
                </button>
              }>

              {/* Collapsed summary */}
              {!showConfig && (
                <div className="px-3 py-2 flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>⏱ {config.startTime} – {config.endTime} · SQ {config.squareOffTime}</span>
                  <span>SL {config.slValue}{config.slType === 'percent' ? '%' : ' pts'}</span>
                  <span>Tgt {config.targetValue}{config.targetType === 'percent' ? '%' : ' pts'}</span>
                  {config.trailingSL && <span>Trail {config.trailStep}%</span>}
                  <span>Max Loss ₹{config.maxLossDay.toLocaleString('en-IN')}</span>
                  {config.reEntryEnabled && <span>Re-entry {config.reEntryCount}×</span>}
                  <span>Lots ×{config.lotMultiplier}</span>
                </div>
              )}

              {/* Expanded config grid */}
              {showConfig && (
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t" style={{ borderColor: '#1a1a1a' }}>
                  <CfgField label="Start Time">
                    <input type="time" value={config.startTime}
                      onChange={e => updateConfig('startTime', e.target.value)} className="term-input w-full"/>
                  </CfgField>
                  <CfgField label="End Time">
                    <input type="time" value={config.endTime}
                      onChange={e => updateConfig('endTime', e.target.value)} className="term-input w-full"/>
                  </CfgField>
                  <CfgField label="Square-off Time">
                    <input type="time" value={config.squareOffTime}
                      onChange={e => updateConfig('squareOffTime', e.target.value)} className="term-input w-full"/>
                  </CfgField>

                  <CfgField label="Overall SL">
                    <div className="flex gap-1">
                      <select value={config.slType} onChange={e => updateConfig('slType', e.target.value)} className="term-select">
                        <option value="percent">%</option>
                        <option value="points">Pts</option>
                      </select>
                      <input type="number" min={0} value={config.slValue}
                        onChange={e => updateConfig('slValue', +e.target.value)} className="term-input flex-1"/>
                    </div>
                  </CfgField>

                  <CfgField label="Overall Target">
                    <div className="flex gap-1">
                      <select value={config.targetType} onChange={e => updateConfig('targetType', e.target.value)} className="term-select">
                        <option value="percent">%</option>
                        <option value="points">Pts</option>
                      </select>
                      <input type="number" min={0} value={config.targetValue}
                        onChange={e => updateConfig('targetValue', +e.target.value)} className="term-input flex-1"/>
                    </div>
                  </CfgField>

                  <CfgField label="Trailing SL">
                    <div className="flex gap-2 items-center">
                      <Toggle on={config.trailingSL} onClick={() => updateConfig('trailingSL', !config.trailingSL)} color="green"/>
                      {config.trailingSL && (
                        <input type="number" value={config.trailStep} placeholder="Step %"
                          onChange={e => updateConfig('trailStep', +e.target.value)} className="term-input flex-1"/>
                      )}
                    </div>
                  </CfgField>

                  <CfgField label="Max Loss / Day">
                    <input type="number" min={0} value={config.maxLossDay}
                      onChange={e => updateConfig('maxLossDay', +e.target.value)} className="term-input w-full"/>
                  </CfgField>

                  <CfgField label="Max Profit / Day">
                    <input type="number" min={0} value={config.maxProfitDay} placeholder="0 = unlimited"
                      onChange={e => updateConfig('maxProfitDay', +e.target.value)} className="term-input w-full"/>
                  </CfgField>

                  <CfgField label="Global Re-entry">
                    <div className="flex gap-2 items-center">
                      <Toggle on={config.reEntryEnabled} onClick={() => updateConfig('reEntryEnabled', !config.reEntryEnabled)} color="cyan"/>
                      {config.reEntryEnabled && (
                        <input type="number" min={1} max={5} value={config.reEntryCount}
                          onChange={e => updateConfig('reEntryCount', +e.target.value)}
                          className="term-input" style={{ width: 52 }}/>
                      )}
                    </div>
                  </CfgField>

                  <CfgField label="Lot Multiplier">
                    <input type="number" min={1} value={config.lotMultiplier}
                      onChange={e => updateConfig('lotMultiplier', +e.target.value)} className="term-input w-full"/>
                  </CfgField>
                </div>
              )}
            </TerminalCard>

            {/* ── Leg Editor ── */}
            <TerminalCard
              title={`Strategy Legs (${legs.length})`}
              icon={<GitBranch size={12}/>}
              accent="cyan"
              action={
                <button onClick={addLeg} className="btn btn-sm btn-green">
                  <Plus size={11}/> Add Leg
                </button>
              }>
              {legs.length === 0 ? (
                <div className="py-10 text-center space-y-2" style={{ color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 28 }}>⚙</div>
                  <div className="text-xs">Pick a template on the left or click <strong style={{ color: 'var(--green)' }}>Add Leg</strong></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {legs.map((leg, i) => {
                    const expanded   = expandedLegs[i]
                    const atm        = Math.round(spotPrice / info.strikeStep) * info.strikeStep
                    const actualStrike = atm + leg.strikeOffset * info.strikeStep
                    const strikeOpts = STRIKE_LABELS.map(lbl => ({
                      label: lbl,
                      offset: labelToOffset(lbl, leg.type === 'FUT' ? 'CE' : leg.type),
                    }))

                    return (
                      <div key={i} className="rounded overflow-hidden"
                        style={{ border: `1px solid ${leg.action === 'BUY' ? 'rgba(0,255,65,0.25)' : 'rgba(255,0,64,0.25)'}` }}>

                        {/* ── Main leg row ── */}
                        <div className="flex flex-wrap items-center gap-2 p-2" style={{ background: '#0a0a0a' }}>

                          {/* BUY / SELL */}
                          <div className="flex rounded overflow-hidden">
                            {(['BUY','SELL'] as const).map(a => (
                              <button key={a} onClick={() => updateLeg(i, 'action', a)}
                                className={`btn btn-sm ${leg.action === a ? (a === 'BUY' ? 'btn-green' : 'btn-red') : 'btn-ghost'}`}>{a}
                              </button>
                            ))}
                          </div>

                          {/* CE / PE / FUT */}
                          <select value={leg.type} onChange={e => updateLeg(i, 'type', e.target.value)} className="term-select">
                            <option value="CE">CE</option>
                            <option value="PE">PE</option>
                            <option value="FUT">FUT</option>
                          </select>

                          {/* Strike label (ATM/ITM/OTM) */}
                          {leg.type !== 'FUT' ? (
                            <select value={leg.strikeLabel}
                              onChange={e => updateLeg(i, 'strikeLabel', e.target.value)}
                              className="term-select">
                              {strikeOpts.map(o => (
                                <option key={o.label} value={o.label}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs px-2" style={{ color: 'var(--text-dim)' }}>FUT</span>
                          )}

                          {/* Actual strike preview */}
                          <span className="text-xs px-2 py-0.5 rounded font-mono"
                            style={{ background: '#111', color: 'var(--text-muted)' }}>
                            ≈{actualStrike.toLocaleString('en-IN')}
                          </span>

                          {/* Expiry type (per-leg) */}
                          <select value={leg.expiryType}
                            onChange={e => updateLeg(i, 'expiryType', e.target.value)}
                            className="term-select">
                            {EXPIRY_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>

                          {/* Lots */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Lots</span>
                            <input type="number" min={1} value={leg.lots}
                              onChange={e => updateLeg(i, 'lots', +e.target.value)}
                              className="term-input" style={{ width: 52 }}/>
                          </div>

                          {/* Premium */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Prem</span>
                            <input type="number" step="0.5" min={0} value={leg.premium}
                              onChange={e => updateLeg(i, 'premium', +e.target.value)}
                              className="term-input" style={{ width: 68 }}/>
                          </div>

                          {/* Value indicator */}
                          {leg.premium > 0 && (
                            <span className="text-xs font-mono"
                              style={{ color: leg.action === 'BUY' ? 'var(--red)' : 'var(--green)' }}>
                              {leg.action === 'BUY' ? '−' : '+'}{formatINR(leg.lots * leg.lotSize * leg.premium)}
                            </span>
                          )}

                          {/* Expand / Delete */}
                          <div className="ml-auto flex gap-1">
                            <button onClick={() => toggleLegExpand(i)} className="btn btn-sm btn-ghost" title="Leg options">
                              {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                            </button>
                            <button onClick={() => removeLeg(i)} className="btn btn-sm btn-ghost">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </div>

                        {/* ── Advanced leg options ── */}
                        {expanded && (
                          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t"
                            style={{ borderColor: '#1a1a1a', background: '#060606' }}>

                            <CfgField label="Entry Type">
                              <select value={leg.entryType}
                                onChange={e => updateLeg(i, 'entryType', e.target.value)}
                                className="term-select w-full">
                                <option value="MARKET">Market</option>
                                <option value="LIMIT">Limit</option>
                                <option value="SLM">SL-Market</option>
                              </select>
                            </CfgField>

                            <CfgField label="Wait &amp; Trade">
                              <div className="flex gap-2 items-center">
                                <Toggle on={leg.waitAndTrade}
                                  onClick={() => updateLeg(i, 'waitAndTrade', !leg.waitAndTrade)} color="cyan"/>
                                {leg.waitAndTrade && (
                                  <input type="number" value={leg.waitPrice} placeholder="Price"
                                    onChange={e => updateLeg(i, 'waitPrice', +e.target.value)}
                                    className="term-input flex-1"/>
                                )}
                              </div>
                            </CfgField>

                            <CfgField label="Leg SL">
                              <div className="flex gap-1">
                                <select value={leg.legSLType}
                                  onChange={e => updateLeg(i, 'legSLType', e.target.value)}
                                  className="term-select">
                                  <option value="percent">%</option>
                                  <option value="points">Pts</option>
                                </select>
                                <input type="number" min={0} value={leg.legSLValue}
                                  onChange={e => updateLeg(i, 'legSLValue', +e.target.value)}
                                  className="term-input flex-1"/>
                              </div>
                            </CfgField>

                            <CfgField label="Leg Target">
                              <div className="flex gap-1">
                                <select value={leg.legTgtType}
                                  onChange={e => updateLeg(i, 'legTgtType', e.target.value)}
                                  className="term-select">
                                  <option value="percent">%</option>
                                  <option value="points">Pts</option>
                                </select>
                                <input type="number" min={0} value={leg.legTgtValue}
                                  onChange={e => updateLeg(i, 'legTgtValue', +e.target.value)}
                                  className="term-input flex-1"/>
                              </div>
                            </CfgField>

                            <CfgField label="Trailing SL">
                              <div className="flex gap-2 items-center">
                                <Toggle on={leg.trailSL}
                                  onClick={() => updateLeg(i, 'trailSL', !leg.trailSL)} color="green"/>
                                {leg.trailSL && (
                                  <input type="number" value={leg.trailValue} placeholder="Trail %"
                                    onChange={e => updateLeg(i, 'trailValue', +e.target.value)}
                                    className="term-input flex-1"/>
                                )}
                              </div>
                            </CfgField>

                            <CfgField label="Re-entry">
                              <div className="flex gap-1">
                                <select value={leg.reEntryType}
                                  onChange={e => updateLeg(i, 'reEntryType', e.target.value)}
                                  className="term-select">
                                  <option value="onSL">On SL</option>
                                  <option value="onTarget">On Target</option>
                                </select>
                                <select value={leg.reEntry}
                                  onChange={e => updateLeg(i, 'reEntry', +e.target.value)}
                                  className="term-select">
                                  <option value={0}>Off</option>
                                  {[1,2,3,5].map(n => <option key={n} value={n}>{n}×</option>)}
                                </select>
                              </div>
                            </CfgField>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TerminalCard>

            {/* ── Margin & Capital ── */}
            {legs.length > 0 && (
              <TerminalCard title="Margin &amp; Capital Requirement" icon={<DollarSign size={12}/>} accent="amber">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MBox label="Total Debit"       value={formatINR(margin.debit)}    color="var(--red)"   />
                  <MBox label="Total Credit"      value={formatINR(margin.credit)}   color="var(--green)" />
                  <MBox label="Net P&amp;L"       value={(margin.net >= 0 ? '+' : '') + formatINR(margin.net)}
                        color={margin.net >= 0 ? 'var(--green)' : 'var(--red)'}/>
                  <MBox label="Capital Required"  value={formatINR(margin.capitalRequired)}
                        color="var(--amber)"
                        sub={margin.hasSell ? 'incl. SPAN ~14%' : 'net debit only'}/>
                </div>

                {/* Leg-wise breakdown */}
                {legs.some(l => l.premium > 0) && (
                  <div className="mt-3 space-y-1">
                    {legs.map((leg, i) => {
                      const val = leg.lots * leg.lotSize * (leg.premium || 0)
                      if (!val) return null
                      const atm = Math.round(spotPrice / info.strikeStep) * info.strikeStep
                      const strike = atm + leg.strikeOffset * info.strikeStep
                      return (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded"
                          style={{ background: '#0a0a0a' }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {i+1}. {leg.action} {leg.lots}L {leg.type} {leg.strikeLabel}
                            <span className="font-mono ml-1" style={{ color: 'var(--text-dim)' }}>({strike.toLocaleString('en-IN')})</span>
                            <span className="ml-1" style={{ color: 'var(--text-dim)' }}>@ {leg.premium}</span>
                          </span>
                          <span style={{ color: leg.action === 'BUY' ? 'var(--red)' : 'var(--green)' }}>
                            {leg.action === 'BUY' ? '−' : '+'}{formatINR(val)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {margin.hasSell && (
                  <div className="mt-3 text-xs p-2 rounded"
                    style={{ background: 'rgba(255,183,0,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(255,183,0,0.2)' }}>
                    ⚠ Sell legs require SPAN + Exposure margin. Estimated ~14% of notional
                    ({formatINR(margin.sellMargin)}). Actual margin may differ — verify with your broker.
                  </div>
                )}
              </TerminalCard>
            )}

            {/* ── Payoff Diagram ── */}
            {payoff && (
              <TerminalCard title="Payoff at Expiry" icon={<TrendingUp size={12}/>} accent="cyan">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SBox label="Max Profit"  value={payoff.maxProfit  === Infinity  ? '∞' : formatINR(payoff.maxProfit)}  color="var(--green)" />
                    <SBox label="Max Loss"    value={payoff.maxLoss    === -Infinity ? '∞' : formatINR(payoff.maxLoss)}    color="var(--red)"   />
                    <SBox label="Net Premium" value={formatINR(payoff.netPremium)}                                          color="var(--cyan)"  />
                    <SBox label="Breakeven(s)" value={payoff.breakevens?.join(' / ') || 'N/A'}                              color="var(--amber)" />
                  </div>
                  {/* Tab switcher */}
                  <div className="flex gap-1 border-b" style={{ borderColor: '#1e1e1e' }}>
                    {(['chart','scenario','greeks'] as const).map(tab => (
                      <button key={tab} onClick={() => setPayoffTab(tab)}
                        className={`btn btn-sm ${payoffTab === tab ? 'btn-cyan' : 'btn-ghost'}`}
                        style={{ borderRadius: '4px 4px 0 0', borderBottom: payoffTab === tab ? '2px solid var(--cyan)' : '2px solid transparent' }}>
                        {tab === 'chart' ? 'Payoff Chart' : tab === 'scenario' ? 'Scenario Table' : 'Greeks Timeline'}
                      </button>
                    ))}
                  </div>
                  {payoffTab === 'chart' && <PayoffChart data={payoff.payoff} spotPrice={spotPrice}/>}
                  {payoffTab === 'scenario' && (
                    <ScenarioTable legs={legs} spotPrice={spotPrice} netPremium={payoff.netPremium} info={info}/>
                  )}
                  {payoffTab === 'greeks' && (
                    <GreeksTimelineChart legs={legs} spotPrice={spotPrice} info={info}/>
                  )}
                </div>
              </TerminalCard>
            )}
          </div>
        </div>

        {/* ── Import Leg Preview Modal ── */}
        <Modal open={importPreviewOpen} onClose={() => setImportPreviewOpen(false)} title="Import Legs — Preview" accent="cyan">
          <div className="space-y-4">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Review the legs selected from the Options Chain before adding them to your strategy.
            </div>
            <div className="rounded overflow-hidden" style={{ border: '1px solid #1e1e1e' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#0a0a0a', color: 'var(--text-muted)' }}>
                    <th className="px-2 py-1.5 text-left">Symbol</th>
                    <th className="px-2 py-1.5 text-left">Strike</th>
                    <th className="px-2 py-1.5 text-left">Type</th>
                    <th className="px-2 py-1.5 text-left">Action</th>
                    <th className="px-2 py-1.5 text-right">Lots</th>
                    <th className="px-2 py-1.5 text-right">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {importedLegs.map((il, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: '#1a1a1a' }}>
                      <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--text)' }}>{il.symbol ?? underlying}</td>
                      <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--text)' }}>{(il.strike ?? il.strikePrice ?? '—').toLocaleString?.('en-IN') ?? il.strike ?? il.strikePrice}</td>
                      <td className="px-2 py-1.5">
                        <span className={`badge ${il.type === 'CE' ? 'badge-green' : 'badge-red'}`}>{il.type ?? '—'}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span style={{ color: (il.action === 'BUY') ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{il.action ?? '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--text)' }}>{il.lots ?? il.quantity ?? 1}</td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: 'var(--cyan)' }}>{il.premium ?? il.ltp ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmImportLegs} className="btn btn-cyan flex-1">
                <Plus size={12}/> Confirm &amp; Add Legs
              </button>
              <button onClick={() => { setImportPreviewOpen(false); setImportedLegs([]) }} className="btn btn-ghost flex-1">
                <X size={12}/> Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Deploy Modal ── */}
        <Modal open={deployModal} onClose={() => setDeployModal(false)} title="Deploy Strategy" accent="amber">
          <div className="space-y-4">
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Deploy <strong style={{ color: 'var(--text)' }}>{strategyName}</strong> — {legs.length} legs on <strong style={{ color: 'var(--cyan)' }}>{underlying}</strong>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeployTarget('paper')}
                className={`btn flex-1 ${deployTarget === 'paper' ? 'btn-green' : 'btn-ghost'}`}>
                📋 Paper Trade
              </button>
              <button onClick={() => setDeployTarget('live')}
                className={`btn flex-1 ${deployTarget === 'live' ? 'btn-amber' : 'btn-ghost'}`}>
                ⚡ Live Angel One
              </button>
            </div>
            <div className="text-xs p-2 rounded space-y-1" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
              <div style={{ color: 'var(--text-dim)' }}>Capital required: <span style={{ color: 'var(--amber)' }}>{formatINR(margin.capitalRequired)}</span></div>
              <div style={{ color: 'var(--text-dim)' }}>SL: {config.slValue}{config.slType === 'percent' ? '%' : ' pts'} · Target: {config.targetValue}{config.targetType === 'percent' ? '%' : ' pts'}</div>
              <div style={{ color: 'var(--text-dim)' }}>Time window: {config.startTime} → {config.squareOffTime}</div>
            </div>
            {deployTarget === 'live' && (
              <div className="text-xs p-2 rounded" style={{ background: 'rgba(255,183,0,0.08)', color: 'var(--amber)', border: '1px solid rgba(255,183,0,0.3)' }}>
                ⚠ Live trading uses real money via Angel One. Ensure you have ≥ {formatINR(margin.capitalRequired)} in your account.
              </div>
            )}
            <button onClick={deploy} className={`btn w-full ${deployTarget === 'paper' ? 'btn-green' : 'btn-amber'}`}>
              <Play size={13}/> Deploy to {deployTarget === 'paper' ? 'Paper Trading' : 'Angel One Live'}
            </button>
          </div>
        </Modal>
      </div>
    </>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function StrategiesPage() {
  return (
    <Suspense fallback={
      <div className="page-content flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        <Spinner size={16}/>&nbsp;Loading Strategy Builder…
      </div>
    }>
      <StrategiesPageInner/>
    </Suspense>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function Toggle({ on, onClick, color }: { on: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className={`btn btn-sm ${on ? `btn-${color}` : 'btn-ghost'}`}
      style={{ minWidth: 42 }}>
      {on ? 'ON' : 'OFF'}
    </button>
  )
}

function CfgField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</div>
      {children}
    </div>
  )
}

function MBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="p-2 rounded" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-bold mt-1 font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  )
}

function SBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-2 rounded" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-bold mt-1 font-mono" style={{ color, wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}

// ─── Feature 23: Scenario Table ───────────────────────────────────────────────

function computeLegPnlAtPrice(leg: ReturnType<typeof makeLeg>, spotAtExp: number, atm: number, step: number): number {
  const strike = atm + leg.strikeOffset * step
  const prem   = leg.premium ?? 0
  const qty    = leg.lots * leg.lotSize
  let intrinsic = 0
  if (leg.type === 'CE') intrinsic = Math.max(0, spotAtExp - strike)
  else if (leg.type === 'PE') intrinsic = Math.max(0, strike - spotAtExp)
  else intrinsic = spotAtExp - atm // FUT simplified

  if (leg.action === 'BUY') return (intrinsic - prem) * qty
  else return (prem - intrinsic) * qty
}

function ScenarioTable({
  legs, spotPrice, netPremium, info
}: {
  legs: ReturnType<typeof makeLeg>[]
  spotPrice: number
  netPremium: number
  info: { strikeStep: number; lotSize: number; label: string }
}) {
  const step = info.strikeStep
  const atm  = Math.round(spotPrice / step) * step

  // 11 rows: -10% to +10% in 2% steps
  const rows = Array.from({ length: 11 }, (_, i) => {
    const pct   = -10 + i * 2
    const price = Math.round((spotPrice * (1 + pct / 100)) / step) * step
    const pnl   = legs.reduce((sum, leg) => sum + computeLegPnlAtPrice(leg, price, atm, step), 0)
    const pnlPct = netPremium !== 0 ? (pnl / Math.abs(netPremium)) * 100 : 0

    // Determine status
    const allPnls = Array.from({ length: 11 }, (_, j) => {
      const p2 = Math.round((spotPrice * (1 + (-10 + j * 2) / 100)) / step) * step
      return legs.reduce((s, leg) => s + computeLegPnlAtPrice(leg, p2, atm, step), 0)
    })
    const maxPnl = Math.max(...allPnls)
    const minPnl = Math.min(...allPnls)

    let status = pnl > 0 ? 'Profit' : pnl < 0 ? 'Loss' : 'Breakeven'
    if (Math.abs(pnl - maxPnl) < 1 && pnl > 0) status = 'Max Profit'
    if (Math.abs(pnl - minPnl) < 1 && pnl < 0) status = 'Max Loss'
    const isCurrentSpot = Math.abs(price - spotPrice) < step / 2

    return { pct, price, pnl, pnlPct, status, isCurrentSpot }
  })

  return (
    <div className="rounded overflow-hidden" style={{ border: '1px solid #1e1e1e' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: '#0a0a0a', color: 'var(--text-muted)' }}>
            <th className="px-3 py-2 text-left">Underlying Price</th>
            <th className="px-3 py-2 text-right">Net Premium</th>
            <th className="px-3 py-2 text-right">P&amp;L (₹)</th>
            <th className="px-3 py-2 text-right">P&amp;L %</th>
            <th className="px-3 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowBg = row.isCurrentSpot
              ? 'rgba(0,212,255,0.07)'
              : row.pnl > 0
              ? 'rgba(0,255,65,0.04)'
              : row.pnl < 0
              ? 'rgba(255,0,64,0.04)'
              : 'transparent'
            const pnlColor = row.pnl > 0 ? 'var(--green)' : row.pnl < 0 ? 'var(--red)' : 'var(--text-muted)'
            const statusColor =
              row.status === 'Max Profit' ? 'var(--green)'
              : row.status === 'Max Loss' ? 'var(--red)'
              : row.status === 'Profit'   ? '#4caf50'
              : row.status === 'Loss'     ? '#f44336'
              : 'var(--text-muted)'

            return (
              <tr key={i} className="border-t" style={{ borderColor: '#1a1a1a', background: rowBg }}>
                <td className="px-3 py-1.5">
                  <span className="font-mono" style={{ color: row.isCurrentSpot ? 'var(--cyan)' : 'var(--text)' }}>
                    {row.price.toLocaleString('en-IN')}
                  </span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                    {row.pct > 0 ? `+${row.pct}%` : `${row.pct}%`}
                    {row.isCurrentSpot && <span className="ml-1" style={{ color: 'var(--cyan)' }}>← spot</span>}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--cyan)' }}>
                  {formatINR(netPremium)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold" style={{ color: pnlColor }}>
                  {row.pnl >= 0 ? '+' : ''}{formatINR(row.pnl)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono" style={{ color: pnlColor }}>
                  {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                    style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40` }}>
                    {row.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Feature 28: Greeks Timeline Chart ────────────────────────────────────────

// Simplified Black-Scholes approximations
function bsApprox(type: 'CE'|'PE', S: number, K: number, T: number, sigma: number): { delta: number; theta: number } {
  if (T <= 0) {
    const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S)
    return { delta: intrinsic > 0 ? (type === 'CE' ? 1 : -1) : 0, theta: 0 }
  }
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  // Standard normal CDF approximation (Abramowitz & Stegun)
  const normCDF = (x: number) => {
    const t2 = 1 / (1 + 0.2316419 * Math.abs(x))
    const poly = t2 * (0.319381530 + t2 * (-0.356563782 + t2 * (1.781477937 + t2 * (-1.821255978 + t2 * 1.330274429))))
    const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
    const cdf = 1 - pdf * poly
    return x >= 0 ? cdf : 1 - cdf
  }
  const normPDF = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
  const r = 0.065 // approx risk-free rate India
  const delta = type === 'CE' ? normCDF(d1) : normCDF(d1) - 1
  const theta = (-(S * normPDF(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * (type === 'CE' ? normCDF(d2) : -normCDF(-d2))) / 365
  return { delta, theta }
}

function GreeksTimelineChart({
  legs, spotPrice, info
}: {
  legs: ReturnType<typeof makeLeg>[]
  spotPrice: number
  info: { strikeStep: number }
}) {
  const step  = info.strikeStep
  const atm   = Math.round(spotPrice / step) * step
  const maxDTE = 30 // show up to 30 DTE by default

  // Estimate IV from premium/spot ratio
  function estimateIV(leg: ReturnType<typeof makeLeg>): number {
    const strike = atm + leg.strikeOffset * step
    const prem   = leg.premium || 5
    const S = spotPrice, K = strike
    // Rough IV estimate: prem / (S * sqrt(T_approx)) * sqrt(2π)
    const T0 = maxDTE / 365
    const rough = (prem / (S * Math.sqrt(T0))) * Math.sqrt(2 * Math.PI)
    return Math.max(0.05, Math.min(rough, 1.5))
  }

  // Build timeline points
  const points = Array.from({ length: maxDTE + 1 }, (_, idx) => {
    const dte = maxDTE - idx // dte goes from maxDTE down to 0
    const T   = dte / 365

    let netDelta = 0, netTheta = 0
    legs.forEach(leg => {
      if (leg.type === 'FUT') {
        const d = leg.action === 'BUY' ? 1 : -1
        netDelta += d * leg.lots * leg.lotSize
        return
      }
      const iv = estimateIV(leg)
      const { delta, theta } = bsApprox(leg.type, spotPrice, atm + leg.strikeOffset * step, T, iv)
      const sign = leg.action === 'BUY' ? 1 : -1
      const qty  = leg.lots * leg.lotSize
      netDelta += sign * delta * qty
      netTheta += sign * theta * qty
    })
    return { dte, netDelta, netTheta }
  })

  if (!legs.length) {
    return (
      <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        Add legs and compute P&amp;L to see the Greeks timeline.
      </div>
    )
  }

  // SVG layout
  const W = 560, H = 200, PL = 52, PR = 12, PT = 12, PB = 28

  const deltas = points.map(p => p.netDelta)
  const thetas = points.map(p => p.netTheta)
  const allVals = [...deltas, ...thetas]
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const rangeV = maxV - minV || 1

  const toSvgX = (dte: number) => PL + ((maxDTE - dte) / maxDTE) * (W - PL - PR)
  const toSvgY = (v: number)   => PT + (1 - (v - minV) / rangeV) * (H - PT - PB)
  const zero   = toSvgY(0)

  const deltaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(p.dte).toFixed(1)},${toSvgY(p.netDelta).toFixed(1)}`).join(' ')
  const thetaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(p.dte).toFixed(1)},${toSvgY(p.netTheta).toFixed(1)}`).join(' ')

  // Y axis labels
  const yTicks = [minV, (minV + maxV) / 2, maxV]

  // X axis ticks
  const xTicks = [0, 5, 10, 15, 20, 25, 30].filter(d => d <= maxDTE)

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs pl-2">
        <span style={{ color: '#4fc3f7' }}>● Net Delta</span>
        <span style={{ color: '#ff8f00' }}>● Net Theta</span>
      </div>
      <div className="rounded overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
          {/* Grid lines */}
          {yTicks.map((v, i) => {
            const y = toSvgY(v)
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#1e1e1e" strokeWidth="0.5"/>
                <text x={PL - 4} y={y + 3} textAnchor="end" fill="#555" fontSize="7">
                  {v.toFixed(0)}
                </text>
              </g>
            )
          })}
          {/* Zero line */}
          {zero >= PT && zero <= H - PB && (
            <line x1={PL} y1={zero} x2={W - PR} y2={zero} stroke="#333" strokeWidth="0.6" strokeDasharray="2,2"/>
          )}
          {/* X axis ticks */}
          {xTicks.map(dte => {
            const x = toSvgX(dte)
            return (
              <g key={dte}>
                <line x1={x} y1={H - PB} x2={x} y2={H - PB + 3} stroke="#333" strokeWidth="0.5"/>
                <text x={x} y={H - PB + 10} textAnchor="middle" fill="#555" fontSize="7">{dte}d</text>
              </g>
            )
          })}
          {/* X axis line */}
          <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#222" strokeWidth="0.5"/>
          {/* Delta line */}
          <path d={deltaPath} fill="none" stroke="#4fc3f7" strokeWidth="1.2"/>
          {/* Theta line */}
          <path d={thetaPath} fill="none" stroke="#ff8f00" strokeWidth="1.2"/>
          {/* Axis label */}
          <text x={PL - 42} y={(H / 2) + 3} textAnchor="middle" fill="#444" fontSize="6.5"
            transform={`rotate(-90, ${PL - 42}, ${H / 2})`}>Greek Value</text>
          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" fill="#444" fontSize="6.5">DTE (Days to Expiry)</text>
        </svg>
      </div>
      <div className="text-xs px-1" style={{ color: 'var(--text-dim)' }}>
        Greeks computed using Black-Scholes approximation. IV estimated from leg premiums. Values are directional (BUY positive, SELL negative).
      </div>
    </div>
  )
}

function PayoffChart({ data, spotPrice }: { data: Array<{ spot: number; pnlAtExp: number; pnl: number }>; spotPrice: number }) {
  if (!data?.length) return null

  const pnls   = data.map(d => d.pnlAtExp)
  const maxPnl = Math.max(...pnls)
  const minPnl = Math.min(...pnls)
  const range  = maxPnl - minPnl || 1
  const W      = data.length

  const toXY = (d: { spot: number; pnlAtExp: number }, i: number) => {
    const x = (i / (W - 1)) * 100
    const y = 100 - ((d.pnlAtExp - minPnl) / range) * 100
    return { x, y }
  }

  const pts     = data.map((d, i) => { const p = toXY(d, i); return `${p.x},${p.y}` }).join(' ')
  const zeroPct = Math.min(100, Math.max(0, 100 - (((0 - minPnl) / range) * 100)))

  // current spot line
  const spotIdx  = data.findIndex(d => d.spot >= spotPrice)
  const spotXPct = spotIdx >= 0 ? (spotIdx / (W - 1)) * 100 : 50

  return (
    <div className="rounded overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 180 }}>
        {/* Zero line */}
        <line x1="0" y1={zeroPct} x2="100" y2={zeroPct}
          stroke="#2a2a2a" strokeWidth="0.4" strokeDasharray="1,1"/>
        {/* Spot price line */}
        <line x1={spotXPct} y1="0" x2={spotXPct} y2="100"
          stroke="rgba(0,212,255,0.3)" strokeWidth="0.4" strokeDasharray="1,1"/>
        {/* Fill below zero (loss) */}
        <polygon
          points={`0,${zeroPct} ${pts} 100,${zeroPct}`}
          fill="rgba(255,0,64,0.06)"/>
        {/* Fill above zero (profit) */}
        <polygon
          points={`0,100 ${pts} 100,100`}
          fill="rgba(0,255,65,0.05)"/>
        {/* Main payoff line */}
        <polyline points={pts} fill="none" stroke="#00d4ff" strokeWidth="0.6"/>
      </svg>
      <div className="flex justify-between px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid #111' }}>
        <span className="font-mono">{data[0]?.spot.toLocaleString('en-IN')}</span>
        <span style={{ color: 'rgba(0,212,255,0.6)' }}>▲ spot ≈ {spotPrice.toLocaleString('en-IN')}</span>
        <span className="font-mono">{data[data.length - 1]?.spot.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
