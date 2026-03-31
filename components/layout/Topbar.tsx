'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import { useAuthStore, useMarketStore } from '@/store'
import { formatTime, getMarketStatus } from '@/lib/utils/date'
import { formatPct } from '@/lib/utils/format'
import { Clock, Activity, Moon, Sun, Search, WifiOff, Zap, X, PlusCircle, Bell, CheckCircle, AlertCircle } from 'lucide-react'
import { usePriceFeed } from '@/hooks/usePriceFeed'
import { useNotifications } from '@/hooks/useNotifications'
import { openOrderModal } from '@/components/trade/OrderModal'

const STATUS_COLORS = {
  'open':       'var(--green)',
  'pre-open':   'var(--amber)',
  'post-close': 'var(--amber)',
  'closed':     'var(--text-muted)',
}
const STATUS_LABELS = {
  'open':       'MARKET OPEN',
  'pre-open':   'PRE-OPEN',
  'post-close': 'POST CLOSE',
  'closed':     'MARKET CLOSED',
}

type DataSource = 'angelone' | 'zerodha' | 'yahoo' | null

export default function Topbar({ title }: { title?: string }) {
  const router  = useRouter()
  const [time, setTime]         = useState('')
  const [status, setStatus]     = useState(getMarketStatus())
  const [theme, setTheme]       = useState<'dark' | 'light'>('dark')
  const [dataSource, setDataSource] = useState<DataSource>(null)
  const [showNotificationToast, setShowNotificationToast] = useState(false)
  const indices = useMarketStore(s => s.indices)
  const { isConnected, isOfflineMode, profile, clearSession } = useAuthStore()
  const { isSupported, isEnabled, unreadCount, requestPermission } = useNotifications()

  useEffect(() => {
    const tick = () => {
      setTime(formatTime())
      setStatus(getMarketStatus())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Read persisted theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('openclaw-theme') as 'dark' | 'light' | null
    if (saved === 'light') {
      setTheme('light')
      document.documentElement.classList.add('light')
    } else {
      setTheme('dark')
      document.documentElement.classList.remove('light')
    }
  }, [])

  // Fetch data source status and poll every 60 seconds
  useEffect(() => {
    function fetchSource() {
      fetch('/api/market/source')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.source) setDataSource(data.source)
        })
        .catch(() => {})
    }
    fetchSource()
    const id = setInterval(fetchSource, 60_000)
    return () => clearInterval(id)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      if (next === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
      localStorage.setItem('openclaw-theme', next)
      return next
    })
  }, [])

  const openSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openclaw:search:open'))
  }, [])

  // Live prices via OpenAlgo WebSocket feed
  const liveSymbols = ['NIFTY:NSE', 'BANKNIFTY:NSE', 'SENSEX:BSE']
  const livePrices  = usePriceFeed(liveSymbols)

  const niftyLive  = livePrices['NIFTY:NSE']
  const bankLive   = livePrices['BANKNIFTY:NSE']
  const sensexLive = livePrices['SENSEX:BSE']

  // Fallback to static store data
  const niftyStatic = indices.find(i => i.symbol === 'NIFTY 50')
  const bankStatic  = indices.find(i => i.symbol === 'NIFTY BANK')

  return (
    <div className="topbar">
      {/* Page title */}
      {title && (
        <span className="text-xs font-bold tracking-wider uppercase mr-4 flex-shrink-0"
          style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono' }}>
          {title}
        </span>
      )}

      {/* Index mini-tickers — live via OpenAlgo WebSocket */}
      <div className="flex items-center gap-4 flex-1 overflow-hidden">
        {niftyLive
          ? <IndexPill label="NIFTY"  value={niftyLive.ltp}  chg={niftyLive.changePct}  live />
          : niftyStatic && <IndexPill label="NIFTY" value={niftyStatic.ltp} chg={niftyStatic.changePct} />}
        <span className="topbar-ticker-secondary flex items-center gap-4">
          {bankLive
            ? <IndexPill label="BANK"   value={bankLive.ltp}   chg={bankLive.changePct}   live />
            : bankStatic  && <IndexPill label="BANK"  value={bankStatic.ltp}  chg={bankStatic.changePct}  />}
          {sensexLive && <IndexPill label="SENSEX" value={sensexLive.ltp} chg={sensexLive.changePct} live />}
        </span>

        {/* Data source badge */}
        {dataSource && (
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'JetBrains Mono',
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '2px 5px',
              borderRadius: '3px',
              border: `1px solid ${dataSource === 'angelone' ? 'rgba(0,212,255,0.4)' : dataSource === 'zerodha' ? 'rgba(56,126,209,0.4)' : 'rgba(255,183,0,0.4)'}`,
              color: dataSource === 'angelone' ? 'var(--cyan)' : dataSource === 'zerodha' ? '#387ed1' : 'var(--amber)',
              background: dataSource === 'angelone' ? 'rgba(0,212,255,0.08)' : dataSource === 'zerodha' ? 'rgba(56,126,209,0.08)' : 'rgba(255,183,0,0.08)',
              flexShrink: 0,
            }}
          >
            {dataSource === 'angelone' ? 'AO' : dataSource === 'zerodha' ? 'ZD' : 'YF'}
          </span>
        )}
      </div>

      {/* Right: notifications + search + theme toggle + market status + clock */}
      <div className="flex items-center gap-3 ml-auto flex-shrink-0">

        {/* Notification Permission Widget */}
        {isSupported && (
          <button
            onClick={async () => {
              if (!isEnabled) {
                const granted = await requestPermission()
                if (granted) {
                  setShowNotificationToast(true)
                  setTimeout(() => setShowNotificationToast(false), 3000)
                }
              }
            }}
            title={isEnabled ? `Notifications enabled (${unreadCount} unread)` : 'Enable notifications'}
            style={{
              background: isEnabled ? 'rgba(0,255,65,0.08)' : 'rgba(255,183,0,0.08)',
              border: isEnabled ? '1px solid rgba(0,255,65,0.25)' : '1px solid rgba(255,183,0,0.25)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: isEnabled ? 'var(--green)' : 'var(--amber)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 7px',
              fontFamily: 'JetBrains Mono',
              fontSize: '10px',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEnabled ? 'rgba(0,255,65,0.15)' : 'rgba(255,183,0,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isEnabled ? 'rgba(0,255,65,0.08)' : 'rgba(255,183,0,0.08)'
            }}
          >
            {isEnabled ? (
              <>
                <Bell size={11} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--red)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      fontSize: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </>
            ) : (
              <AlertCircle size={11} />
            )}
          </button>
        )}


        {/* Offline mode badge */}
        {isOfflineMode && !isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--amber)', fontFamily: 'JetBrains Mono',
              border: '1px solid rgba(255,183,0,0.35)',
              background: 'rgba(255,183,0,0.07)',
              borderRadius: 3, padding: '2px 7px',
            }}>
              <Zap size={9} /> OFFLINE
            </span>
            <button
              onClick={() => { clearSession(); mutate(() => true, undefined, { revalidate: true }); router.push('/') }}
              title="Exit offline mode"
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 3,
                cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 6px',
                fontFamily: 'JetBrains Mono', fontSize: 9, display: 'flex',
                alignItems: 'center', gap: 4, letterSpacing: '0.06em',
              }}
            >
              <X size={9} /> EXIT
            </button>
          </div>
        )}

        {/* Connected broker badge */}
        {isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: 'var(--green)', fontFamily: 'JetBrains Mono',
              border: '1px solid rgba(0,255,65,0.25)',
              background: 'rgba(0,255,65,0.06)',
              borderRadius: 3, padding: '2px 8px',
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--green)', flexShrink: 0,
                boxShadow: '0 0 6px rgba(0,255,65,0.8)',
              }} />
              {profile?.name?.split(' ')[0] ?? 'CONNECTED'}
            </span>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                clearSession()
                // Revalidate all SWR keys so stale broker data is cleared immediately
                mutate(() => true, undefined, { revalidate: true })
                router.push('/')
              }}
              title="Disconnect broker"
              style={{
                background: 'none', border: '1px solid rgba(255,0,64,0.25)', borderRadius: 3,
                cursor: 'pointer', color: 'var(--red)', padding: '2px 6px',
                fontFamily: 'JetBrains Mono', fontSize: 9, display: 'flex',
                alignItems: 'center', gap: 4, letterSpacing: '0.06em',
              }}
            >
              <WifiOff size={9} /> DC
            </button>
          </div>
        )}
        {/* Order entry button */}
        <button
          onClick={() => openOrderModal()}
          title="Place Order (F9)"
          style={{
            background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.25)', borderRadius: '4px',
            cursor: 'pointer', color: 'var(--green)', display: 'flex', alignItems: 'center',
            gap: '4px', padding: '3px 8px', fontFamily: 'JetBrains Mono', fontSize: '10px', letterSpacing: '0.04em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,65,0.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,65,0.08)' }}
        >
          <PlusCircle size={11} /> ORDER <span style={{ color: 'rgba(0,255,65,0.4)', fontSize: 9 }}>F9</span>
        </button>

        {/* Search button */}
        <button
          className="topbar-search"
          onClick={openSearch}
          title="Search (Ctrl+K)"
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 7px',
            fontFamily: 'JetBrains Mono',
            fontSize: '10px',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--border-high)'
            el.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'var(--border)'
            el.style.color = 'var(--text-dim)'
          }}
        >
          <Search size={11} />
          <span>Ctrl+K</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            borderRadius: '4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
        </button>

        {/* Market status */}
        <div className="flex items-center gap-1.5">
          <div className={`status-dot ${status === 'open' ? 'live' : 'idle'}`} />
          <span className="topbar-status-text text-xs font-bold tracking-wider"
            style={{ color: STATUS_COLORS[status], fontFamily: 'JetBrains Mono', fontSize: '10px' }}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        {/* Clock */}
        <div className="topbar-clock flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
          <Clock size={11} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>{time} IST</span>
        </div>
      </div>
    </div>
  )
}

function IndexPill({ label, value, chg, live }: { label: string; value: number; chg: number; live?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs flex-shrink-0"
      style={{ fontFamily: 'JetBrains Mono' }}>
      <span style={{ color: live ? 'var(--cyan)' : 'var(--text-dim)', fontSize: '10px' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span style={{ color: chg >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '10px' }}>
        {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
      </span>
    </div>
  )
}
