'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Keyboard } from 'lucide-react'

const G_SHORTCUTS: Record<string, { path: string; label: string }> = {
  h: { path: '/',            label: 'Home / Dashboard' },
  d: { path: '/',            label: 'Dashboard' },
  m: { path: '/market',      label: 'Market' },
  s: { path: '/screener',    label: 'Screener' },
  o: { path: '/options',     label: 'Options' },
  t: { path: '/strategies',  label: 'Strategy Builder' },
  b: { path: '/strategies',  label: 'Strategy Builder' },
  p: { path: '/paper-trade', label: 'Paper Trade' },
  f: { path: '/portfolio',   label: 'Portfolio (Finance)' },
  n: { path: '/news',        label: 'News' },
  l: { path: '/monitor',     label: 'Live Monitor' },
}

const ALL_SHORTCUTS = [
  { keys: ['g', 'h'], description: 'Go to Home / Dashboard', category: 'Navigation' },
  { keys: ['g', 'm'], description: 'Go to Market',           category: 'Navigation' },
  { keys: ['g', 's'], description: 'Go to Screener',         category: 'Navigation' },
  { keys: ['g', 'o'], description: 'Go to Options',          category: 'Navigation' },
  { keys: ['g', 't'], description: 'Go to Strategy Builder', category: 'Navigation' },
  { keys: ['g', 'p'], description: 'Go to Paper Trade',      category: 'Navigation' },
  { keys: ['g', 'f'], description: 'Go to Portfolio',        category: 'Navigation' },
  { keys: ['g', 'n'], description: 'Go to News',             category: 'Navigation' },
  { keys: ['g', 'l'], description: 'Go to Live Monitor',     category: 'Navigation' },
  { keys: ['Ctrl', 'K'], description: 'Open Global Search',  category: 'General' },
  { keys: ['?'],       description: 'Show this help modal',  category: 'General' },
  { keys: ['Esc'],     description: 'Close modal / Cancel',  category: 'General' },
  { keys: ['/'],       description: 'Open Global Search',    category: 'General' },
]

function isInputActive() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}

export default function KeyboardShortcuts() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const gPendingRef = useRef(false)
  const gTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeModal = useCallback(() => setShowModal(false), [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+K is handled by GlobalSearch, just skip here
      if (e.ctrlKey && e.key === 'k') return

      // Escape closes any open modal
      if (e.key === 'Escape') {
        setShowModal(false)
        window.dispatchEvent(new CustomEvent('openclaw:modal:close'))
        return
      }

      if (isInputActive()) return

      // ? shows help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setShowModal((prev) => !prev)
        return
      }

      // g-sequence navigation
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        if (gTimerRef.current) clearTimeout(gTimerRef.current)
        gPendingRef.current = true
        gTimerRef.current = setTimeout(() => {
          gPendingRef.current = false
        }, 500)
        return
      }

      if (gPendingRef.current) {
        const key = e.key.toLowerCase()
        const target = G_SHORTCUTS[key]
        if (target) {
          e.preventDefault()
          gPendingRef.current = false
          if (gTimerRef.current) clearTimeout(gTimerRef.current)
          router.push(target.path)
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  if (!showModal) return null

  const categories = Array.from(new Set(ALL_SHORTCUTS.map((s) => s.category)))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={closeModal}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-high)',
          borderRadius: '6px',
          padding: '0',
          minWidth: '480px',
          maxWidth: '560px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 1px rgba(0,255,65,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={14} style={{ color: 'var(--green)' }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--green)',
                fontFamily: 'JetBrains Mono',
              }}
            >
              Keyboard Shortcuts
            </span>
          </div>
          <button
            onClick={closeModal}
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
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto' }}>
          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono',
                  marginBottom: '8px',
                }}
              >
                {cat}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {ALL_SHORTCUTS.filter((s) => s.category === cat).map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-dim)',
                        fontFamily: 'JetBrains Mono',
                      }}
                    >
                      {s.description}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {s.keys.map((k, ki) => (
                        <span key={ki}>
                          <kbd
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              background: 'var(--surface-high)',
                              border: '1px solid var(--border-high)',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontFamily: 'JetBrains Mono',
                              color: 'var(--text)',
                              lineHeight: '1.4',
                            }}
                          >
                            {k}
                          </kbd>
                          {ki < s.keys.length - 1 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px', margin: '0 2px' }}>
                              then
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontFamily: 'JetBrains Mono',
            }}
          >
            Press <kbd
              style={{
                padding: '1px 5px',
                background: 'var(--surface-high)',
                border: '1px solid var(--border-high)',
                borderRadius: '3px',
                fontSize: '10px',
                fontFamily: 'JetBrains Mono',
                color: 'var(--text)',
              }}
            >Esc</kbd> or click outside to close
          </span>
        </div>
      </div>
    </div>
  )
}
