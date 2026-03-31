'use client'
import { useState } from 'react'
import { Keyboard, ChevronDown, ChevronUp } from 'lucide-react'

const HOTKEY_LEGEND = [
  {
    keys: ['F1', '/', 'Ctrl+B'],
    description: 'Buy at Market',
    color: '#00ff41',
  },
  {
    keys: ['F2', '/', 'Ctrl+S'],
    description: 'Sell at Market',
    color: '#ff0040',
  },
  {
    keys: ['Escape'],
    description: 'Close Modal',
    color: '#ffaa00',
  },
  {
    keys: ['Ctrl+Enter'],
    description: 'Confirm Order',
    color: '#00aaff',
  },
]

interface HotkeyLegendProps {
  collapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}

export default function HotkeyLegend({ collapsed: initialCollapsed = false, onToggle }: HotkeyLegendProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const handleToggle = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    onToggle?.(newCollapsed)
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,255,65,0.05)',
          border: 'none',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style.background as any) = 'rgba(0,255,65,0.1)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.background as any) = 'rgba(0,255,65,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Keyboard size={13} style={{ color: 'var(--green)' }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--green)',
            }}
          >
            Hotkey Legend
          </span>
        </div>
        {collapsed ? (
          <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {HOTKEY_LEGEND.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${item.color}22`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {item.description}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {item.keys.map((key, ki) => (
                  <kbd
                    key={ki}
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      background: `${item.color}11`,
                      border: `1px solid ${item.color}44`,
                      borderRadius: 3,
                      fontSize: 9,
                      fontFamily: 'JetBrains Mono',
                      color: item.color,
                      lineHeight: '1.4',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!collapsed && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.2)',
            fontSize: 9,
            color: 'var(--text-muted)',
            fontFamily: 'JetBrains Mono',
          }}
        >
          Press Ctrl+B or F1 to quick buy | Ctrl+S or F2 to quick sell
        </div>
      )}
    </div>
  )
}
