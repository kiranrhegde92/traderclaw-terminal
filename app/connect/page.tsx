'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { mutate } from 'swr'
import { useAuthStore } from '@/store'
import { log } from '@/lib/utils/logger'
import TerminalCard from '@/components/ui/TerminalCard'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { Wifi, WifiOff, Key, User, Lock, ShieldCheck, ExternalLink } from 'lucide-react'

type Broker = 'angelone' | 'zerodha'

function ConnectPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { isConnected, profile, setSession, clearSession } = useAuthStore()

  const initialBroker = (searchParams?.get('broker') as Broker | null) ?? 'angelone'
  const [mounted,       setMounted]       = useState(false)
  const [activeBroker,  setActiveBroker]  = useState<Broker>(initialBroker)
  const [connectedAs,   setConnectedAs]   = useState<string>('')   // 'angelone' | 'zerodha'
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

  // Angel One form state
  const [aoForm, setAoForm] = useState({
    clientCode: process.env.NEXT_PUBLIC_CLIENT_ID ?? '',
    password:   '',
    totp:       '',
    apiKey:     '',
  })
  const [useTOTP, setUseTOTP] = useState(true)

  // Zerodha form state
  const [zdForm, setZdForm] = useState({ apiKey: '', apiSecret: '' })
  const [zdRedirecting, setZdRedirecting] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Pick up OAuth error from Zerodha callback redirect
    const oauthError = searchParams?.get('error')
    if (oauthError) setError(decodeURIComponent(oauthError))

    fetch('/api/auth/session').then(r => r.json()).then(data => {
      if (data.connected && data.jwtToken) {
        setConnectedAs(data.broker ?? 'angelone')
        setSession({
          jwtToken:  data.jwtToken,
          feedToken: data.feedToken ?? '',
          clientId:  data.clientCode,
          profile:   data.profile ?? { name: data.clientCode, email: '' },
        })
        log.info('auth', `Session restored: ${data.profile?.name ?? data.clientCode} (${data.broker ?? 'angelone'})`)
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAngelLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ broker: 'angelone', ...aoForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setConnectedAs('angelone')
      setSession({
        jwtToken:  json.jwtToken,
        feedToken: json.feedToken,
        clientId:  json.clientCode,
        profile:   json.profile,
      })
      log.trade('auth', `✓ Logged in as ${json.profile?.name ?? json.clientCode}`)
      router.push('/')
    } catch (err: any) {
      setError(err.message)
      log.error('auth', `Login failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleZerodhaLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ broker: 'zerodha', ...zdForm }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      if (json.redirectUrl) {
        setZdRedirecting(true)
        log.info('auth', 'Redirecting to Kite Connect…')
        window.location.href = json.redirectUrl
      }
    } catch (err: any) {
      setError(err.message)
      log.error('auth', `Zerodha login failed: ${err.message}`)
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearSession()
    mutate(() => true, undefined, { revalidate: true })
    setConnectedAs('')
    log.info('auth', 'Logged out')
  }

  const brokerLabel = connectedAs === 'zerodha' ? 'Zerodha' : 'Angel One'

  return (
    <>
      <Topbar title="Connect" />
      <div className="page-content flex items-start justify-center pt-8">
        <div style={{ width: '100%', maxWidth: 500 }}>
          {!mounted ? (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--text-muted)' }}>
              <Spinner size={16} /> &nbsp; Checking session...
            </div>
          ) : isConnected ? (
            /* ── Connected state ─────────────────────────────────── */
            <TerminalCard title="Connected" icon={<Wifi size={12}/>} accent="green">
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <div className="status-dot live" />
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>{profile?.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{brokerLabel} • Active Session</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="btn btn-red w-full">
                  <WifiOff size={12}/> Disconnect
                </button>
              </div>
            </TerminalCard>
          ) : (
            /* ── Login form ──────────────────────────────────────── */
            <TerminalCard title="Broker Login" icon={<Wifi size={12}/>} accent="green">

              {/* Broker tabs */}
              <div className="flex gap-1 mb-4 p-1 rounded" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
                {(['angelone', 'zerodha'] as Broker[]).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { setActiveBroker(b); setError('') }}
                    className="flex-1 py-1.5 text-xs font-bold rounded transition-all"
                    style={{
                      background: activeBroker === b ? (b === 'zerodha' ? '#3f6212' : '#1a3320') : 'transparent',
                      color:      activeBroker === b ? (b === 'zerodha' ? '#84cc16' : 'var(--green)') : 'var(--text-muted)',
                      border:     activeBroker === b ? `1px solid ${b === 'zerodha' ? '#65a30d' : 'var(--green)'}` : '1px solid transparent',
                    }}
                  >
                    {b === 'angelone' ? 'Angel One' : 'Zerodha'}
                  </button>
                ))}
              </div>

              {/* ── Angel One form ── */}
              {activeBroker === 'angelone' && (
                <form onSubmit={handleAngelLogin} className="space-y-4 py-2">
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>Client Code</label>
                    <div className="flex items-center gap-2">
                      <User size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="text" placeholder="A123456"
                        value={aoForm.clientCode}
                        onChange={e => setAoForm(f => ({ ...f, clientCode: e.target.value }))}
                        className="term-input" required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>PIN / Password</label>
                    <div className="flex items-center gap-2">
                      <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="password" placeholder="••••••"
                        value={aoForm.password}
                        onChange={e => setAoForm(f => ({ ...f, password: e.target.value }))}
                        className="term-input" required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs" style={{ color: 'var(--text-dim)' }}>TOTP</label>
                      <button type="button" onClick={() => setUseTOTP(!useTOTP)}
                        className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {useTOTP ? 'Enter manually' : 'Use .env secret'}
                      </button>
                    </div>
                    {!useTOTP && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                          type="text" placeholder="6-digit TOTP"
                          value={aoForm.totp}
                          onChange={e => setAoForm(f => ({ ...f, totp: e.target.value }))}
                          className="term-input" maxLength={6}
                        />
                      </div>
                    )}
                    {useTOTP && (
                      <div className="text-xs px-2 py-1 rounded" style={{ background: '#0a0a0a', color: 'var(--text-muted)' }}>
                        Auto-generated from ANGELONE_TOTP_SECRET in .env.local
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>API Key</label>
                    <div className="flex items-center gap-2">
                      <Key size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="password" placeholder="From ANGELONE_API_KEY env"
                        value={aoForm.apiKey}
                        onChange={e => setAoForm(f => ({ ...f, apiKey: e.target.value }))}
                        className="term-input"
                      />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Leave blank to use .env.local value</div>
                  </div>

                  {error && (
                    <div className="text-xs p-2 rounded border" style={{ color: 'var(--red)', borderColor: 'rgba(255,0,64,0.3)', background: 'rgba(255,0,64,0.08)' }}>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn btn-green w-full">
                    {loading ? <Spinner size={13}/> : <Wifi size={13}/>}
                    {loading ? 'Connecting...' : 'Connect to Angel One'}
                  </button>
                </form>
              )}

              {/* ── Zerodha form ── */}
              {activeBroker === 'zerodha' && (
                <form onSubmit={handleZerodhaLogin} className="space-y-4 py-2">
                  <div className="text-xs p-2 rounded" style={{ background: '#0a1a0a', color: 'var(--text-muted)', border: '1px solid #1e2e1e' }}>
                    Zerodha uses OAuth — you'll be redirected to Kite Connect to log in,
                    then returned here automatically.
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>API Key</label>
                    <div className="flex items-center gap-2">
                      <Key size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="text" placeholder="From ZERODHA_API_KEY env or kite.trade/developers"
                        value={zdForm.apiKey}
                        onChange={e => setZdForm(f => ({ ...f, apiKey: e.target.value }))}
                        className="term-input"
                      />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Leave blank to use ZERODHA_API_KEY from .env.local</div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-dim)' }}>API Secret</label>
                    <div className="flex items-center gap-2">
                      <Lock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="password" placeholder="From ZERODHA_API_SECRET env or kite.trade/developers"
                        value={zdForm.apiSecret}
                        onChange={e => setZdForm(f => ({ ...f, apiSecret: e.target.value }))}
                        className="term-input"
                      />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Leave blank to use ZERODHA_API_SECRET from .env.local</div>
                  </div>

                  {error && (
                    <div className="text-xs p-2 rounded border" style={{ color: 'var(--red)', borderColor: 'rgba(255,0,64,0.3)', background: 'rgba(255,0,64,0.08)' }}>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || zdRedirecting} className="btn w-full"
                    style={{ background: '#1a2e0a', border: '1px solid #65a30d', color: '#84cc16' }}>
                    {loading || zdRedirecting ? <Spinner size={13}/> : <ExternalLink size={13}/>}
                    {zdRedirecting ? 'Redirecting to Kite Connect…' : loading ? 'Preparing…' : 'Login with Zerodha'}
                  </button>

                  <div className="text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
                    Make sure your Kite Connect app redirect URI is set to{' '}
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/zerodha/callback
                    </span>
                  </div>
                </form>
              )}

              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: '#1e1e1e' }}>
                <div className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>OFFLINE MODE</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Without connection, the app uses free NSE/Yahoo Finance data for all dashboards.
                  Paper trading works fully offline.
                </div>
              </div>
            </TerminalCard>
          )}
        </div>
      </div>
    </>
  )
}


export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectPageInner />
    </Suspense>
  )
}
