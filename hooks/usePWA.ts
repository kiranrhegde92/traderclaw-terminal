'use client'
import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  notificationPermission: NotificationPermission
  canRequestPermission: boolean
  install: () => Promise<boolean>
  requestNotificationPermission: () => Promise<boolean>
}

export function usePWA(): PWAState {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [canRequestPermission, setCanRequestPermission] = useState(false)

  // Check if app is installable and installed
  useEffect(() => {
    // Check if running as PWA (already installed)
    if (typeof window !== 'undefined') {
      const isInPWAMode = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true
      setIsInstalled(isInPWAMode)

      // Set notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission)
        setCanRequestPermission(Notification.permission === 'default')
      }
    }
  }, [])

  // Listen for beforeinstallprompt event
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setIsInstallable(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Trigger installation prompt
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstallable(false)
        setDeferredPrompt(null)
        return true
      }
      return false
    } catch (error) {
      console.error('Installation failed:', error)
      return false
    }
  }, [deferredPrompt])

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false

    try {
      const result = await Notification.requestPermission()
      setNotificationPermission(result)
      setCanRequestPermission(result === 'default')

      // Register service worker if permission granted
      if (result === 'granted' && 'serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        } catch (error) {
          console.error('Service worker registration failed:', error)
        }
      }

      return result === 'granted'
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return false
    }
  }, [])

  return {
    isInstallable,
    isInstalled,
    notificationPermission,
    canRequestPermission,
    install,
    requestNotificationPermission,
  }
}
