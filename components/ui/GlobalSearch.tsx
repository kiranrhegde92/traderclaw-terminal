'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, TrendingUp, Layout, GitBranch, ChevronRight } from 'lucide-react'

type ResultType = 'Stock' | 'Index' | 'Page' | 'Strategy'

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  type: ResultType
  path: string
}

const NSE_SYMBOLS: Array<{ symbol: string; name: string }> = [
  { symbol: 'RELIANCE',   name: 'Reliance Industries' },
  { symbol: 'TCS',        name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK',   name: 'HDFC Bank' },
  { symbol: 'INFOSYS',    name: 'Infosys' },
  { symbol: 'ICICIBANK',  name: 'ICICI Bank' },
  { symbol: 'WIPRO',      name: 'Wipro' },
  { symbol: 'AXISBANK',   name: 'Axis Bank' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'SBIN',       name: 'State Bank of India' },
  { symbol: 'LT',         name: 'Larsen & Toubro' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
  { symbol: 'KOTAKBANK',  name: 'Kotak Mahindra Bank' },
  { symbol: 'MARUTI',     name: 'Maruti Suzuki' },
  { symbol: 'ADANIENT',   name: 'Adani Enterprises' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports' },
  { symbol: 'SUNPHARMA',  name: 'Sun Pharmaceutical' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement' },
  { symbol: 'NTPC',       name: 'NTPC' },
  { symbol: 'POWERGRID',  name: 'Power Grid Corporation' },
  { symbol: 'ONGC',       name: 'Oil & Natural Gas Corp' },
  { symbol: 'TITAN',      name: 'Titan Company' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
  { symbol: 'NESTLEIND',  name: 'Nestle India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'ITC',        name: 'ITC' },
  { symbol: 'M&M',        name: 'Mahindra & Mahindra' },
  { symbol: 'TECHM',      name: 'Tech Mahindra' },
  { symbol: 'HCLTECH',    name: 'HCL Technologies' },
  { symbol: 'DIVISLAB',   name: "Divi's Laboratories" },
]

const NSE_INDICES: Array<{ symbol: string; name: string }> = [
  { symbol: 'NIFTY',     name: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', name: 'NIFTY Bank' },
  { symbol: 'FINNIFTY',  name: 'NIFTY Financial Services' },
  { symbol: 'MIDCPNIFTY',name: 'NIFTY Midcap Select' },
  { symbol: 'SENSEX',    name: 'BSE Sensex' },
]

const PAGES: Array<{ label: string; sublabel: string; path: string }> = [
  { label: 'Dashboard',        sublabel: 'Home overview',         path: '/' },
  { label: 'Market',           sublabel: 'Market overview',       path: '/market' },
  { label: 'Screener',         sublabel: 'Stock scanner',         path: '/screener' },
  { label: 'Options',          sublabel: 'Options chain',         path: '/options' },
  { label: 'Strategy Builder', sublabel: 'Build & backtest',      path: '/strategies' },
  { label: 'Paper Trade',      sublabel: 'Simulate trading',      path: '/paper-trade' },
  { label: 'Portfolio',        sublabel: 'Holdings & P&L',        path: '/portfolio' },
  { label: 'News',             sublabel: 'Market news feed',      path: '/news' },
  { label: 'Live Monitor',     sublabel: 'Watchlist & alerts',    path: '/monitor' },
  { label: 'Connect Broker',   sublabel: 'Angel One / OpenAlgo', path: '/connect' },
]

const TYPE_COLORS: Record<ResultType, string> = {
  Stock:    'var(--green)',
  Index:    'var(--cyan)',
  Page:     'var(--amber)',
  Strategy: 'var(--purple)',
}

function buildResults(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchResult[] = []

  // Indices
  for (const idx of NSE_INDICES) {
    if (idx.symbol.toLowerCase().includes(q) || idx.name.toLowerCase().includes(q)) {
      results.push({
        id:       `idx-${idx.symbol}`,
        label:    idx.symbol,
        sublabel: idx.name,
        type:     'Index',
        path:     `/monitor?symbol=${idx.symbol}`,
      })
    }
  }

  // Stocks
  for (const s of NSE_SYMBOLS) {
    if (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
      results.push({
        id:       `stock-${s.symbol}`,
        label:    s.symbol,
        sublabel: s.name,
        type:     'Stock',
        path:     `/monitor?symbol=${s.symbol}`,
      })
    }
  }

  // Pages
  for (const p of PAGES) {
    if (p.label.toLowerCase().includes(q) || p.sublabel.toLowerCase().includes(q)) {
      results.push({
        id:       `page-${p.path}`,
        label:    p.label,
        sublabel: p.sublabel,
        type:     'Page',
        path:     p.path,
      })
    }
  }

  return results.slice(0, 12)
}

function isInputActive() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  const results = buildResults(query)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
  }, [])

  const openSearch = useCallback(() => {
    setOpen(true)
    setSelected(0)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  const navigate = useCallback((path: string) => {
    close()
    router.push(path)
  }, [close, router])

  // Keyboard event listener for Ctrl+K and /
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        openSearch()
        return
      }
      if (e.key === '/' && !isInputActive() && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        openSearch()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  // Listen for external open event (from topbar button)
  useEffect(() => {
    const handler = () => openSearch()
    window.addEventListener('openclaw:search:open', handler)
    return () => window.removeEventListener('openclaw:search:open', handler)
  }, [openSearch])

  // Listen for modal close event (from keyboard shortcuts Escape)
  useEffect(() => {
    const handler = () => close()
    window.addEventListener('openclaw:modal:close', handler)
    return () => window.removeEventListener('openclaw:modal:close', handler)
  }, [close])

  // In-modal keyboard navigation
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((prev) => Math.min(prev + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[selected]
        if (r) navigate(r.path)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, results, selected, close, navigate])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={close}
    >
      <div
        style={{
          width: '560px',
          maxWidth: 'calc(100vw - 40px)',
          background: 'var(--surface)',
          border: '1px solid var(--border-high)',
          borderRadius: '6px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 1px rgba(0,212,255,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: results.length > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Search symbols, pages..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'JetBrains Mono',
              color: 'var(--text)',
              caretColor: 'var(--cyan)',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSelected(0); inputRef.current?.focus() }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div
            ref={listRef}
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '6px',
            }}
          >
            {results.map((r, i) => (
              <div
                key={r.id}
                data-idx={i}
                onClick={() => navigate(r.path)}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: i === selected ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Type icon */}
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${TYPE_COLORS[r.type]}15`,
                    border: `1px solid ${TYPE_COLORS[r.type]}30`,
                    flexShrink: 0,
                  }}
                >
                  {(r.type === 'Stock' || r.type === 'Index') && (
                    <TrendingUp size={12} style={{ color: TYPE_COLORS[r.type] }} />
                  )}
                  {r.type === 'Page' && (
                    <Layout size={12} style={{ color: TYPE_COLORS[r.type] }} />
                  )}
                  {r.type === 'Strategy' && (
                    <GitBranch size={12} style={{ color: TYPE_COLORS[r.type] }} />
                  )}
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 600,
                      color: i === selected ? 'var(--text)' : 'var(--text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.label}
                  </div>
                  {r.sublabel && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.sublabel}
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: `1px solid ${TYPE_COLORS[r.type]}40`,
                    color: TYPE_COLORS[r.type],
                    background: `${TYPE_COLORS[r.type]}10`,
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {r.type}
                </span>

                {i === selected && (
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query && results.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono',
            }}
          >
            No results for "{query}"
          </div>
        )}

        {/* Default state (no query) */}
        {!query && (
          <div
            style={{
              padding: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'NIFTY', type: 'Index' as ResultType, path: '/monitor?symbol=NIFTY' },
              { label: 'BANKNIFTY', type: 'Index' as ResultType, path: '/monitor?symbol=BANKNIFTY' },
              { label: 'RELIANCE', type: 'Stock' as ResultType, path: '/monitor?symbol=RELIANCE' },
              { label: 'TCS', type: 'Stock' as ResultType, path: '/monitor?symbol=TCS' },
              { label: 'Market', type: 'Page' as ResultType, path: '/market' },
              { label: 'Options', type: 'Page' as ResultType, path: '/options' },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => navigate(s.path)}
                style={{
                  background: `${TYPE_COLORS[s.type]}10`,
                  border: `1px solid ${TYPE_COLORS[s.type]}30`,
                  borderRadius: '4px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono',
                  color: TYPE_COLORS[s.type],
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          {[
            { key: '↑↓', desc: 'Navigate' },
            { key: '↵',  desc: 'Select' },
            { key: 'Esc', desc: 'Close' },
          ].map((h) => (
            <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <kbd
                style={{
                  padding: '1px 5px',
                  background: 'var(--surface-high)',
                  border: '1px solid var(--border-high)',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--text)',
                }}
              >
                {h.key}
              </kbd>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                {h.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
