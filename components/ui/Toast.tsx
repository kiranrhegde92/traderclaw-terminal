'use client'
import { useEffect, useRef } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore, Toast, ToastType } from '@/lib/stores/useToastStore'

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'var(--green)',
  error:   'var(--red)',
  warning: 'var(--amber)',
  info:    'var(--cyan)',
}

const TOAST_BG: Record<ToastType, string> = {
  success: 'rgba(0,255,65,0.08)',
  error:   'rgba(255,0,64,0.08)',
  warning: 'rgba(255,183,0,0.08)',
  info:    'rgba(0,212,255,0.08)',
}

const TOAST_BORDER: Record<ToastType, string> = {
  success: 'rgba(0,255,65,0.25)',
  error:   'rgba(255,0,64,0.25)',
  warning: 'rgba(255,183,0,0.25)',
  info:    'rgba(0,212,255,0.25)',
}

function ToastIcon({ type }: { type: ToastType }) {
  const size = 14
  const color = TOAST_COLORS[type]
  if (type === 'success') return <CheckCircle size={size} style={{ color }} />
  if (type === 'error')   return <XCircle     size={size} style={{ color }} />
  if (type === 'warning') return <AlertTriangle size={size} style={{ color }} />
  return <Info size={size} style={{ color }} />
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateX(0)'
    })
  }, [])

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        background: TOAST_BG[toast.type],
        border: `1px solid ${TOAST_BORDER[toast.type]}`,
        borderLeft: `3px solid ${TOAST_COLORS[toast.type]}`,
        borderRadius: '4px',
        minWidth: '280px',
        maxWidth: '380px',
        opacity: 0,
        transform: 'translateX(24px)',
        transition: 'opacity 0.22s ease, transform 0.22s ease',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: '1px' }}>
        <ToastIcon type={toast.type} />
      </div>
      <span
        style={{
          flex: 1,
          fontSize: '12px',
          lineHeight: '1.5',
          color: 'var(--text)',
          fontFamily: 'JetBrains Mono',
          wordBreak: 'break-word',
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={() => remove(toast.id)}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-dim)',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          paddingTop: '1px',
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const add = useToastStore((s) => s.add)
  return {
    success: (message: string) => add('success', message),
    error:   (message: string) => add('error',   message),
    warn:    (message: string) => add('warning',  message),
    info:    (message: string) => add('info',     message),
  }
}
