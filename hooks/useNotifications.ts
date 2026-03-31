'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export interface NotificationItem {
  id: string
  title: string
  body: string
  icon?: string
  timestamp: number
  read: boolean
}

const STORAGE_KEY = 'traderclaw_notifications'
const MAX_STORED = 50

function loadStored(): NotificationItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveStored(items: NotificationItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_STORED)))
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAlertIdRef = useRef<number>(0)

  useEffect(() => {
    const supported = 'Notification' in window
    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
    }
    setNotifications(loadStored())
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [])

  const notify = useCallback((title: string, body: string, icon?: string) => {
    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title, body, icon: icon ?? '/icon-192x192.png',
      timestamp: Date.now(),
      read: false,
    }

    setNotifications(prev => {
      const next = [item, ...prev].slice(0, MAX_STORED)
      saveStored(next)
      return next
    })

    // Show browser notification if permission granted and tab is hidden
    if (permission === 'granted' && document.visibilityState === 'hidden') {
      try {
        new Notification(title, {
          body,
          icon: item.icon,
          badge: '/icon-192x192.png',
          vibrate: [200],
          tag: 'traderclaw-alert',
          requireInteraction: false,
        } as NotificationOptions & { vibrate: number[] })
      } catch {
        // ServiceWorker notification fallback
        navigator.serviceWorker?.ready?.then(reg => {
          reg.showNotification(title, {
            body,
            icon: item.icon,
            badge: '/icon-192x192.png',
            vibrate: [200],
            tag: 'traderclaw-alert',
          })
        }).catch(() => {})
      }
    }
  }, [permission])

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }))
      saveStored(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    saveStored([])
  }, [])

  // Poll alerts endpoint and fire notifications for new triggers
  useEffect(() => {
    if (permission !== 'granted') return

    const poll = async () => {
      try {
        const res = await fetch('/api/monitor/alerts')
        const { data } = await res.json()
        if (!Array.isArray(data)) return

        for (const alert of data) {
          if (alert.id > lastAlertIdRef.current && alert.triggered_at) {
            notify(
              `Alert: ${alert.symbol}`,
              `${alert.alert_type} — ${alert.condition_json}`,
            )
            lastAlertIdRef.current = alert.id
          }
        }
      } catch { /* ignore */ }
    }

    pollRef.current = setInterval(poll, 15000)
    poll()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [permission, notify])

  const unreadCount = notifications.filter(n => !n.read).length
  const isEnabled = permission === 'granted'

  return {
    isSupported,
    isEnabled,
    permission,
    notifications,
    unreadCount,
    requestPermission,
    notify,
    markAllRead,
    clearAll,
  }
}
