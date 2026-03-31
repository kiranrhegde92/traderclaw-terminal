'use client'
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/hooks/useNotifications'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isSupported, isEnabled, unreadCount, notifications, requestPermission, markAllRead, clearAll } = useNotifications()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle() {
    setOpen(o => {
      if (!o) markAllRead()
      return !o
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Bell button */}
      <button
        onClick={toggle}
        title="Notifications"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '6px 8px', borderRadius: 6,
          color: open ? 'var(--cyan)' : 'var(--text-muted)',
          transition: 'color 0.15s',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: 'var(--red)', color: '#fff',
            borderRadius: '50%', fontSize: 9, fontWeight: 700,
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          width: 320, maxHeight: 420, overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Notifications</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {notifications.length > 0 && (
                <button onClick={clearAll} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', fontSize: 11, padding: '2px 6px',
                }}>Clear all</button>
              )}
            </div>
          </div>

          {/* Permission request */}
          {isSupported && !isEnabled && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(255,160,0,0.08)' }}>
              <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 8 }}>
                Enable browser notifications to get real-time alerts
              </div>
              <button
                onClick={requestPermission}
                style={{
                  background: 'var(--amber)', color: '#000', border: 'none',
                  borderRadius: 5, padding: '5px 12px', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                Enable Notifications
              </button>
            </div>
          )}

          {!isSupported && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              Browser notifications not supported
            </div>
          )}

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'rgba(0,200,255,0.04)',
                  transition: 'background 0.2s',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
