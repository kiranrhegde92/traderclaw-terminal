'use client'
import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open:     boolean
  onClose:  () => void
  title:    string
  children: ReactNode
  width?:   string
  accent?:  string
}

export default function Modal({ open, onClose, title, children, width = '500px', accent = 'var(--green)' }: Props) {
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="term-card relative animate-slide-in"
        style={{ width, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: accent, fontFamily: 'JetBrains Mono' }}>
            {title}
          </h2>
          <button onClick={onClose} className="p-1 hover:text-white transition-colors"
            style={{ color: 'var(--text-dim)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
