'use client'
import { ReactNode, useEffect } from 'react'
import { log } from '@/lib/utils/logger'

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    log.system('app', 'TraderClaw Terminal initialized')
    log.info('app', 'Loading market data sources...')

    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          log.info('app', 'Service Worker registered successfully')
        })
        .catch((error) => {
          log.warn('app', 'Service Worker registration failed:', error.message)
        })
    }
  }, [])

  return <>{children}</>
}
