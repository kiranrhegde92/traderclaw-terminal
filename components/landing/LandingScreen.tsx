'use client'
import Link from 'next/link'
import { useMarketStore, useAuthStore } from '@/store'
import { Cpu, Activity, Zap, ArrowRight, Clock } from 'lucide-react'

/* ── broker definitions ──────────────────────────────────────────── */
const BROKERS = [
  {
    id:      'angelone',
    name:    'Angel One',
    sub:     'SmartAPI',
    color:   '#ff6b35',
    status:  'active' as const,
    logo:    'AO',
  },
  { id: 'zerodha',  name: 'Zerodha',      sub: 'Kite Connect',  color: '#387ed1', status: 'active' as const, logo: 'ZR' },
  { id: 'kotak',    name: 'Kotak Neo',    sub: 'Neo API',       color: '#ed1b24', status: 'soon' as const, logo: 'KN' },
  { id: 'upstox',   name: 'Upstox',       sub: 'Upstox API v3', color: '#5438dc', status: 'soon' as const, logo: 'UP' },
  { id: 'fyers',    name: 'Fyers',        sub: 'Fyers API v3',  color: '#00c896', status: 'soon' as const, logo: 'FY' },
  { id: 'icici',    name: 'ICICI Breeze', sub: 'Breeze API',    color: '#f58220', status: 'soon' as const, logo: 'IB' },
]

function IndexPill({ label, ltp, changePct }: { label: string; ltp: number; changePct: number }) {
  const up = changePct >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'JetBrains Mono' }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)' }}>
        {up ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
      </span>
    </div>
  )
}

export default function LandingScreen({ onOfflineMode }: { onOfflineMode: () => void }) {
  const indices = useMarketStore(s => s.indices)
  const nifty   = indices.find(i => i.symbol === 'NIFTY 50')
  const bank    = indices.find(i => i.symbol === 'NIFTY BANK')
  const vix     = indices.find(i => i.symbol === 'INDIA VIX')

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
          <Cpu size={16} style={{ color: 'var(--green)' }} />
          <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12, letterSpacing: '0.12em' }}>
            TRADERCLAW
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 24, overflow: 'hidden' }}>
          {nifty && <IndexPill label="NIFTY" ltp={nifty.ltp} changePct={nifty.changePct} />}
          {bank  && <IndexPill label="BANK"  ltp={bank.ltp}  changePct={bank.changePct}  />}
          {vix   && <IndexPill label="VIX"   ltp={vix.ltp}   changePct={vix.changePct}   />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={11} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            NSE • BSE • F&O
          </span>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 48, padding: '48px 24px',
      }}>

        {/* Logo + tagline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'clamp(28px, 5vw, 48px)',
            fontWeight: 700, letterSpacing: '0.1em',
            color: 'var(--green)',
            textShadow: '0 0 40px rgba(0,255,65,0.35)',
            lineHeight: 1,
          }}>
            TRADERCLAW
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-dim)',
            marginTop: 8, letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Professional Indian Stock Market Terminal
          </div>
          <div style={{
            width: 40, height: 2, margin: '14px auto 0',
            background: 'var(--green)',
            boxShadow: '0 0 12px rgba(0,255,65,0.6)',
          }} />
        </div>

        {/* Broker selection */}
        <div style={{ width: '100%', maxWidth: 760 }}>
          <div style={{
            fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em',
            marginBottom: 16, textAlign: 'center',
          }}>
            SELECT YOUR BROKER
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {BROKERS.map(b => {
              const isActive = b.status === 'active'
              const card = (
                <div
                  key={b.id}
                  style={{
                    border: `1px solid ${isActive ? b.color + '55' : 'var(--border)'}`,
                    borderRadius: 6,
                    padding: '18px 20px',
                    background: isActive
                      ? `linear-gradient(135deg, ${b.color}0d 0%, transparent 100%)`
                      : 'var(--surface)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: isActive ? 'pointer' : 'default',
                    position: 'relative',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    opacity: isActive ? 1 : 0.55,
                  }}
                  onMouseEnter={e => {
                    if (isActive) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = b.color + 'cc'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${b.color}22`
                    }
                  }}
                  onMouseLeave={e => {
                    if (isActive) {
                      (e.currentTarget as HTMLDivElement).style.borderColor = b.color + '55'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                    }
                  }}
                >
                  {/* Logo circle */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: isActive ? b.color + '22' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? b.color + '44' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: isActive ? b.color : 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}>
                    {b.logo}
                  </div>

                  {/* Name + sub */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: isActive ? 'var(--text)' : 'var(--text-dim)',
                      letterSpacing: '0.04em',
                    }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {b.sub}
                    </div>
                  </div>

                  {/* Status badge / arrow */}
                  {isActive ? (
                    <ArrowRight size={14} style={{ color: b.color, flexShrink: 0 }} />
                  ) : (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 3, padding: '2px 6px', flexShrink: 0,
                    }}>
                      SOON
                    </span>
                  )}
                </div>
              )

              return isActive ? (
                <Link key={b.id} href={`/login?broker=${b.id}`} style={{ textDecoration: 'none' }}>
                  {card}
                </Link>
              ) : card
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 760 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Offline mode */}
        <div style={{ textAlign: 'center' }}>
          <button onClick={onOfflineMode} style={{
            background: 'transparent', color: 'var(--amber)',
            padding: '12px 32px', fontWeight: 700, fontSize: 12,
            border: '1px solid rgba(255,183,0,0.3)', borderRadius: 4,
            cursor: 'pointer', letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'JetBrains Mono',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget).style.borderColor = 'rgba(255,183,0,0.6)' }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(255,183,0,0.3)' }}
          >
            <Zap size={13} /> LAUNCH OFFLINE MODE
          </button>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            Free NSE &amp; Yahoo Finance data · Full paper trading · No broker required
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '10px 24px',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 8, background: '#0d0d0d', flexShrink: 0,
      }}>
        <Clock size={9} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          TRADERCLAW TERMINAL v1.0 &nbsp;•&nbsp; NSE &nbsp;•&nbsp; BSE &nbsp;•&nbsp; F&amp;O &nbsp;•&nbsp;
          SCREENER &nbsp;•&nbsp; OPTIONS &nbsp;•&nbsp; PAPER TRADING
        </span>
      </div>
    </div>
  )
}
