'use client'
import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'

export default function PWAInstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWA()
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Only show on installable devices (not already installed)
    if (isInstallable && !isInstalled) {
      setVisible(true)
      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent))
  }, [isInstallable, isInstalled])

  if (!visible) return null

  const handleInstall = async () => {
    const success = await install()
    if (success) {
      setVisible(false)
    }
  }

  const handleClose = () => {
    setVisible(false)
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      style={{
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {isIOS ? (
        // iOS: Show "Add to Home Screen" instructions
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            maxWidth: '280px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--green)',
                fontFamily: 'JetBrains Mono',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              INSTALL APP
            </h3>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} />
            </button>
          </div>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              margin: '0 0 10px 0',
              lineHeight: 1.4,
              fontFamily: 'system-ui',
            }}
          >
            Tap the Share icon, then select "Add to Home Screen"
          </p>
        </div>
      ) : (
        // Android: Show "Install App" button
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            maxWidth: '280px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--green)',
                fontFamily: 'JetBrains Mono',
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              INSTALL APP
            </h3>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} />
            </button>
          </div>
          <button
            onClick={handleInstall}
            style={{
              width: '100%',
              background: 'rgba(0, 255, 65, 0.12)',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              color: 'var(--green)',
              fontFamily: 'JetBrains Mono',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 65, 0.2)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 65, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 65, 0.12)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <Download size={12} />
            INSTALL
          </button>
        </div>
      )}
    </div>
  )
}
