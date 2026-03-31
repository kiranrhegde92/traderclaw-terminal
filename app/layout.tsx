import type { Metadata } from 'next'
import './globals.css'
import Sidebar      from '@/components/layout/Sidebar'
import ConsoleLog   from '@/components/layout/ConsoleLog'
import MatrixBackground from '@/components/layout/MatrixBackground'
import { Providers } from './providers'
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts'
import GlobalSearch from '@/components/ui/GlobalSearch'
import { ToastProvider } from '@/components/ui/Toast'
import OrderModal from '@/components/trade/OrderModal'
import PWAInstallPrompt from '@/components/notifications/PWAInstallPrompt'
import ChatBot from '@/components/chat/ChatBot'

export const metadata: Metadata = {
  title:       'TraderClaw Terminal',
  description: 'Production-grade Indian stock market trading terminal',
  icons:       { icon: '/favicon.ico' },
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:     true,
    statusBarStyle: 'black',
    title:       'TraderClaw',
  },
  other: {
    'theme-color': '#00ff41',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#00ff41" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body>
        <MatrixBackground />
        <Providers>
          <div className="app-shell">
            <Sidebar />
            <div className="main-area">
              <div className="page-content">
                {children}
              </div>
              <ConsoleLog />
            </div>
          </div>
          <KeyboardShortcuts />
          <GlobalSearch />
          <OrderModal />
          <ToastProvider />
          <PWAInstallPrompt />
          <ChatBot />
        </Providers>
      </body>
    </html>
  )
}
