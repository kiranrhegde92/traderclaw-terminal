'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store'
import {
  LayoutDashboard, TrendingUp, BarChart2, Layers, Target,
  GitBranch, BookOpen, Newspaper, Radio, Wifi, WifiOff,
  Settings, ChevronRight, Cpu, Activity, FlaskConical, Calendar,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',            label: 'Dashboard',     icon: LayoutDashboard, section: null },
  { href: '/market',      label: 'Market',         icon: TrendingUp,      section: 'MARKET' },
  { href: '/screener',    label: 'Screener',        icon: BarChart2,       section: 'MARKET' },
  { href: '/options',     label: 'Options',         icon: Layers,          section: 'DERIVATIVES' },
  { href: '/strategies',  label: 'Strategy Builder',icon: GitBranch,       section: 'DERIVATIVES' },
  { href: '/backtest',    label: 'Backtest',        icon: FlaskConical,    section: 'DERIVATIVES' },
  { href: '/paper-trade', label: 'Paper Trade',     icon: BookOpen,        section: 'TRADING' },
  { href: '/portfolio',   label: 'Portfolio',       icon: Target,          section: 'TRADING' },
  { href: '/news',        label: 'News Monitor',    icon: Newspaper,       section: 'MONITOR' },
  { href: '/monitor',     label: 'Live Monitor',    icon: Radio,           section: 'MONITOR' },
  { href: '/bulk-deals',  label: 'M&A Activity',    icon: Activity,        section: 'INSIGHTS' },
  { href: '/results',     label: 'Results',         icon: BarChart2,       section: 'INSIGHTS' },
  { href: '/calendar',    label: 'Calendar',        icon: Calendar,        section: 'INSIGHTS' },
  { href: '/tax',         label: 'Tax Report',      icon: Newspaper,       section: 'PORTFOLIO' },
]

export default function Sidebar() {
  const pathname    = usePathname()
  const { isConnected, profile } = useAuthStore()

  return (
    <nav className="sidebar" suppressHydrationWarning>
      {/* Logo */}
      <div className="sidebar-logo-wrap border-b" style={{ borderColor: 'var(--border)' }}>
        <Cpu size={18} style={{ color: 'var(--green)' }} className="flex-shrink-0" />
        <div className="nav-label">
          <div className="text-xs font-bold tracking-widest uppercase glow-green"
            style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono' }}>
            TraderClaw
          </div>
          <div className="text-2xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
            TERMINAL v1.0
          </div>
        </div>
      </div>

      {/* Connection status */}
      <Link href="/connect" className="mx-3 my-2 flex items-center gap-2 p-2 rounded transition-all hover:bg-white/5"
        style={{ border: `1px solid ${isConnected ? 'rgba(0,255,65,0.3)' : 'rgba(255,0,64,0.3)'}` }}>
        {isConnected
          ? <Wifi size={11} style={{ color: 'var(--green)' }} />
          : <WifiOff size={11} style={{ color: 'var(--red)' }} />}
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-bold truncate nav-label"
            style={{
              fontSize: '10px',
              color: isConnected ? 'var(--green)' : 'var(--red)',
              fontFamily: 'JetBrains Mono',
            }}>
            {isConnected ? (profile?.name ?? 'Connected') : 'Connect Broker'}
          </div>
          <div className="text-2xs nav-label" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {isConnected ? 'Angel One' : 'Click to login'}
          </div>
        </div>
        <div className={`status-dot ${isConnected ? 'live' : 'error'}`} />
      </Link>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-1">
        {NAV_ITEMS.map((item, index) => {
          const prevItem = index > 0 ? NAV_ITEMS[index - 1] : null
          const showSection = item.section && item.section !== prevItem?.section

          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <div key={item.href}>
              {showSection && (
                <div className="px-4 pt-3 pb-1 nav-section-title"
                  style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono' }}>
                  {item.section}
                </div>
              )}
              <Link href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={14} className="flex-shrink-0" />
                <span className="nav-label flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight size={11} className="flex-shrink-0" />}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Bottom */}
      <div className="border-t space-y-2 px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        {/* Settings */}
        <Link href="/settings" className={`nav-item text-sm ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings size={14} className="flex-shrink-0" />
          <span className="nav-label flex-1 truncate">Settings</span>
          {pathname === '/settings' && <ChevronRight size={11} className="flex-shrink-0" />}
        </Link>

        {/* Status */}
        <div className="flex items-center gap-2 text-2xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          <Activity size={10} />
          <span className="nav-label">NSE • BSE • F&amp;O</span>
        </div>
      </div>
    </nav>
  )
}
