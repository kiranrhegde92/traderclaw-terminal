'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { mutate } from 'swr'
import { useAuthStore, useMarketStore } from '@/store'
import { log } from '@/lib/utils/logger'
import {
  Cpu, Wifi, WifiOff, User, Lock, Key, ShieldCheck,
  TrendingUp, BookOpen, Layers, BarChart2, Newspaper,
  Radio, ArrowLeft, Check, ChevronRight, AlertCircle,
  Database, RefreshCw, Eye, EyeOff,
} from 'lucide-react'
import Spinner from '@/components/ui/Spinner'

const BROKER_META: Record<string, {
  name: string; color: string; logo: string; apiPortal: string
  oauth?: boolean   // true = OAuth flow (no TOTP, submit redirects to broker)
  fields: Array<{
    key: string; label: string; type: string; placeholder: string
    required: boolean; hint?: string
  }>
}> = {
  angelone: {
    name:      'Angel One',
    color:     '#ff6b35',
    logo:      'AO',
    apiPortal: 'https://smartapi.angelone.in/',
    fields: [
      { key: 'clientCode', label: 'Client Code',    type: 'text',     placeholder: 'A123456',                             required: true },
      { key: 'password',   label: 'PIN / Password', type: 'password', placeholder: '4-digit PIN or password',             required: true },
      { key: 'apiKey',     label: 'API Key',         type: 'password', placeholder: 'SmartAPI key from developer portal',  required: true, hint: 'Create a new app at smartapi.angelone.in' },
    ],
  },
  zerodha: {
    name:      'Zerodha',
    color:     '#387ed1',
    logo:      'ZR',
    apiPortal: 'https://kite.trade/developers',
    oauth:     true,
    fields: [
      { key: 'apiKey',    label: 'API Key',    type: 'text',     placeholder: 'From kite.trade/developers', required: false, hint: 'Leave blank to use ZERODHA_API_KEY from .env.local' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'From kite.trade/developers', required: false, hint: 'Leave blank to use ZERODHA_API_SECRET from .env.local' },
    ],
  },
}

const FEATURES = [
  { icon: TrendingUp, text: 'Live NSE & BSE real-time quotes' },
  { icon: BookOpen,   text: 'Paper trading simulator with P&L' },
  { icon: Layers,     text: 'Options chain & strategy builder' },
  { icon: BarChart2,  text: 'AI-powered stock screener' },
  { icon: Radio,      text: 'Real-time alerts & watchlist' },
  { icon: Newspaper,  text: 'Market news & FII/DII flows' },
]

function IndexPill({ label, ltp, changePct }: { label: string; ltp: number; changePct: number }) {
  const up = changePct >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'JetBrains Mono' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>
        {ltp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </span>
      <span style={{ fontSize: 9, color: up ? 'var(--green)' : 'var(--red)' }}>
        {up ? '▲' : '▼'}{Math.abs(changePct).toFixed(2)}%
      </span>
    </div>
  )
}

/* ── helper: input field ─────────────────────────────────────────── */
function Field({
  label, hint, icon: Icon, type, placeholder, value, onChange, required,
}: {
  label: string; hint?: string; icon: any; type: string
  placeholder: string; value: string; onChange: (v: string) => void; required?: boolean
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
        </label>
        {hint && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>{hint}</span>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <Icon size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type={isPassword && !show ? 'password' : 'text'}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="term-input"
          style={{ paddingLeft: 32, paddingRight: isPassword ? 32 : 12, width: '100%', boxSizing: 'border-box' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', padding: 0,
            }}
          >
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── TOTP section ────────────────────────────────────────────────── */
function TOTPSection({
  totpSecret, totp, useTotpSecret,
  onTotpSecret, onTotp, onToggle,
}: {
  totpSecret: string; totp: string; useTotpSecret: boolean
  onTotpSecret: (v: string) => void; onTotp: (v: string) => void; onToggle: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          TOTP <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
        </label>
        <button type="button" onClick={onToggle} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--cyan)', fontSize: 9, fontFamily: 'JetBrains Mono', letterSpacing: '0.04em',
        }}>
          {useTotpSecret ? 'Enter code manually →' : '← Use secret key (recommended)'}
        </button>
      </div>

      {useTotpSecret ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <ShieldCheck size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type={show ? 'text' : 'password'}
              placeholder="Base32 secret key from 2FA setup"
              value={totpSecret}
              onChange={e => onTotpSecret(e.target.value)}
              className="term-input"
              style={{ paddingLeft: 32, paddingRight: 32, width: '100%', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShow(s => !s)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', padding: 0,
            }}>
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div style={{
            fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5,
            padding: '6px 10px', background: 'rgba(0,255,65,0.04)',
            border: '1px solid rgba(0,255,65,0.1)', borderRadius: 3,
          }}>
            <span style={{ color: 'var(--green)' }}>✓ Recommended:</span> Auto-generates TOTP on every login so you don't need to enter the 6-digit code manually. Store the base32 key from your Angel One 2FA setup page.
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <ShieldCheck size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="6-digit code from authenticator app"
            maxLength={6}
            value={totp}
            onChange={e => onTotp(e.target.value)}
            className="term-input"
            style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  )
}

/* ── main page (wrapped for Suspense) ───────────────────────────── */
function LoginInner() {
  const router   = useRouter()
  const params   = useSearchParams()
  const brokerId = params.get('broker') ?? 'angelone'
  const meta     = BROKER_META[brokerId]

  const { isConnected, profile, setSession, clearSession, setOfflineMode } = useAuthStore()
  const indices = useMarketStore(s => s.indices)

  const [mounted,       setMounted]       = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [useTotpSecret, setUseTotpSecret] = useState(true)
  const [saveCredentials, setSaveCredentials] = useState(true)
  const [hasSaved,      setHasSaved]      = useState(false)

  const [form, setForm] = useState({
    clientCode:  '',
    password:    '',
    totpSecret:  '',
    totp:        '',
    apiKey:      '',
    apiSecret:   '',
  })
  const [redirecting, setRedirecting] = useState(false)

  const nifty = indices.find(i => i.symbol === 'NIFTY 50')
  const bank  = indices.find(i => i.symbol === 'NIFTY BANK')

  // On mount: check session + load saved credential hints
  useEffect(() => {
    setMounted(true)

    // Check active session
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

    // Check saved credentials
    fetch(`/api/auth/credentials?broker=${brokerId}`)
      .then(r => r.json())
      .then(data => {
        if (data.saved) {
          setHasSaved(true)
          // Pre-fill client code if saved
          if (data.fields?.clientCode) {
            setForm(f => ({ ...f, clientCode: data.fields.clientCode }))
          }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerId])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ broker: brokerId, ...form, saveCredentials }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Authentication failed')

      // OAuth brokers (e.g. Zerodha) return a redirectUrl instead of a session
      if (json.redirectUrl) {
        setRedirecting(true)
        window.location.href = json.redirectUrl
        return
      }

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
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearSession()
    mutate(() => true, undefined, { revalidate: true })
    router.push('/')
  }

  async function clearSavedCredentials() {
    await fetch(`/api/auth/credentials?broker=${brokerId}`, { method: 'DELETE' })
    setHasSaved(false)
    setForm({ clientCode: '', password: '', totpSecret: '', totp: '', apiKey: '', apiSecret: '' })
  }

  if (!meta) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontSize: 13 }}>
        Unknown broker. <Link href="/" style={{ color: 'var(--green)' }}>Go back</Link>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
      overflow: 'auto',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 48,
        display: 'flex', alignItems: 'center', gap: 20,
        background: '#0d0d0d', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={15} style={{ color: 'var(--green)' }} />
          <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12, letterSpacing: '0.12em' }}>
            TRADERCLAW
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 20 }}>
          {nifty && <IndexPill label="NIFTY" ltp={nifty.ltp} changePct={nifty.changePct} />}
          {bank  && <IndexPill label="BANK"  ltp={bank.ltp}  changePct={bank.changePct}  />}
        </div>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          color: 'var(--text-muted)', textDecoration: 'none', fontSize: 11,
        }}>
          <ArrowLeft size={12} /> Back
        </Link>
      </div>

      {/* ── Split layout ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* LEFT — Branding */}
        <div style={{
          width: '40%', minWidth: 260,
          borderRight: '1px solid var(--border)',
          padding: '40px 36px',
          display: 'flex', flexDirection: 'column', gap: 28,
          background: 'linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)',
        }}>
          {/* Broker badge + TRADERCLAW */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: meta.color + '22',
                border: `1px solid ${meta.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.04em',
              }}>
                {meta.logo}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>CONNECTING TO</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>{meta.name}</div>
              </div>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 700, letterSpacing: '0.1em',
              color: 'var(--green)', textShadow: '0 0 20px rgba(0,255,65,0.25)',
            }}>
              TRADERCLAW
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.06em' }}>
              PROFESSIONAL TRADING TERMINAL
            </div>
            <div style={{ width: 28, height: 2, marginTop: 10, background: 'var(--green)', opacity: 0.7 }} />
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {FEATURES.map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={9} style={{ color: 'var(--green)' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Live market widget */}
          {mounted && (nifty || bank) && (
            <div style={{
              marginTop: 'auto', padding: '14px 16px',
              border: '1px solid var(--border)', borderRadius: 4,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
                LIVE MARKET
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nifty && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>NIFTY 50</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {nifty.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: 10, color: nifty.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {nifty.changePct >= 0 ? '+' : ''}{nifty.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
                {bank && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>NIFTY BANK</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        {bank.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: 10, color: bank.changePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {bank.changePct >= 0 ? '+' : ''}{bank.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Form */}
        <div style={{
          flex: 1, padding: '40px 40px',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', maxWidth: 520,
        }}>
          {!mounted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <Spinner size={14} /> Checking session...
            </div>
          ) : isConnected ? (
            /* ── Already connected ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em' }}>
                  CONNECTED
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Active {meta.name} session
                </div>
              </div>

              <div style={{
                border: '1px solid rgba(0,255,65,0.25)', borderRadius: 4,
                padding: '16px 20px', background: 'rgba(0,255,65,0.05)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(0,255,65,0.15)', border: '1px solid rgba(0,255,65,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Wifi size={16} style={{ color: 'var(--green)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{profile?.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{meta.name} · Session active</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/" style={{
                  flex: 1, padding: '10px 0', textAlign: 'center',
                  background: 'var(--green)', color: '#000',
                  fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
                  textDecoration: 'none', borderRadius: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  OPEN TERMINAL <ChevronRight size={13} />
                </Link>
                <button onClick={handleLogout} style={{
                  padding: '10px 20px',
                  background: 'transparent', color: 'var(--red)',
                  border: '1px solid rgba(255,0,64,0.3)', borderRadius: 3,
                  cursor: 'pointer', fontSize: 11, fontFamily: 'JetBrains Mono',
                  letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <WifiOff size={12} /> DISCONNECT
                </button>
              </div>
            </div>
          ) : (
            /* ── Login form ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: meta.color + '22', border: `1px solid ${meta.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: meta.color,
                  }}>
                    {meta.logo}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em' }}>
                    {meta.name.toUpperCase()}
                  </div>
                  <Link href="/" style={{
                    marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)',
                    textDecoration: 'none', letterSpacing: '0.06em',
                  }}>
                    ← change broker
                  </Link>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Enter your {meta.name} credentials below — stored encrypted, never in .env files.
                </div>
              </div>

              {/* Saved credentials notice */}
              {hasSaved && (
                <div style={{
                  padding: '10px 12px', borderRadius: 3,
                  border: '1px solid rgba(0,255,65,0.2)', background: 'rgba(0,255,65,0.05)',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 10,
                  color: 'var(--text-dim)',
                }}>
                  <Database size={12} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Saved credentials loaded — fields are pre-filled.</span>
                  <button onClick={clearSavedCredentials} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    gap: 4, fontSize: 9, fontFamily: 'JetBrains Mono', flexShrink: 0,
                  }}>
                    <RefreshCw size={10} /> Clear
                  </button>
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* OAuth info banner */}
                {meta.oauth && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 3, fontSize: 10, lineHeight: 1.6,
                    border: '1px solid rgba(56,126,209,0.25)', background: 'rgba(56,126,209,0.06)',
                    color: 'var(--text-dim)',
                  }}>
                    Zerodha uses OAuth — you&apos;ll be redirected to Kite Connect to log in,
                    then returned here automatically.
                  </div>
                )}

                {/* Standard fields */}
                {meta.fields.map(f => (
                  <Field
                    key={f.key}
                    label={f.label}
                    hint={f.hint}
                    icon={f.key === 'clientCode' ? User : f.key === 'password' ? Lock : Key}
                    type={f.type}
                    placeholder={hasSaved && f.type === 'password' ? '(saved)' : f.placeholder}
                    value={form[f.key as keyof typeof form]}
                    onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                    required={f.required && !hasSaved}
                  />
                ))}

                {/* TOTP section — only for non-OAuth brokers */}
                {!meta.oauth && (
                  <TOTPSection
                    totpSecret={form.totpSecret}
                    totp={form.totp}
                    useTotpSecret={useTotpSecret}
                    onTotpSecret={v => setForm(f => ({ ...f, totpSecret: v }))}
                    onTotp={v => setForm(f => ({ ...f, totp: v }))}
                    onToggle={() => setUseTotpSecret(s => !s)}
                  />
                )}

                {/* Save credentials toggle */}
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '10px 12px',
                  border: '1px solid var(--border)', borderRadius: 3,
                  background: saveCredentials ? 'rgba(0,255,65,0.04)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <input
                    type="checkbox"
                    checked={saveCredentials}
                    onChange={e => setSaveCredentials(e.target.checked)}
                    style={{ marginTop: 1, accentColor: 'var(--green)', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text)', letterSpacing: '0.04em' }}>
                      Remember credentials
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                      Saved with AES-256-GCM encryption in local database — never sent to any server
                    </div>
                  </div>
                </label>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 3,
                    border: '1px solid rgba(255,0,64,0.3)', background: 'rgba(255,0,64,0.07)',
                    display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'var(--red)',
                  }}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={loading || redirecting} style={{
                  padding: '12px',
                  background: (loading || redirecting) ? `${meta.color}88` : meta.color,
                  color: '#000', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
                  border: 'none', borderRadius: 3,
                  cursor: (loading || redirecting) ? 'not-allowed' : 'pointer',
                  fontFamily: 'JetBrains Mono',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: (loading || redirecting) ? 'none' : `0 0 20px ${meta.color}33`,
                }}>
                  {redirecting
                    ? <><Spinner size={13} /> REDIRECTING TO KITE...</>
                    : loading
                    ? <><Spinner size={13} /> CONNECTING...</>
                    : meta.oauth
                    ? <><Wifi size={13} /> LOGIN WITH {meta.name.toUpperCase()}</>
                    : <><Wifi size={13} /> CONNECT TO {meta.name.toUpperCase()}</>
                  }
                </button>

                {/* Offline mode link */}
                <div style={{ textAlign: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => { setOfflineMode(); router.push('/') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Skip — launch in offline mode
                  </button>
                </div>
              </form>

              {/* API portal link */}
              <div style={{
                padding: '10px 12px', borderRadius: 3,
                border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)',
                fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                Need an API key?{' '}
                <span style={{ color: 'var(--cyan)' }}>{meta.apiPortal}</span>
                {' '}→ Create App → copy your API Key
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg)', minHeight: '100vh' }} />}>
      <LoginInner />
    </Suspense>
  )
}
