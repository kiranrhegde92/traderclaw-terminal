'use client'
import { useEffect, useCallback, useRef } from 'react'

export interface HotkeysConfig {
  onBuy?: () => void
  onSell?: () => void
  onClose?: () => void
  enabled?: boolean
}

export const HOTKEY_MAP: Record<string, string> = {
  'F1':         'Buy at Market',
  'F2':         'Sell at Market',
  'Ctrl+B':     'Quick Buy',
  'Ctrl+S':     'Quick Sell',
  'Escape':     'Close Modal',
  'Ctrl+Enter': 'Confirm Order',
}

export function useHotkeys(config: HotkeysConfig = {}) {
  const {
    onBuy,
    onSell,
    onClose,
    enabled = true,
  } = config

  const isListeningRef = useRef(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled || isListeningRef.current) return

    // Skip if input is focused
    const el = document.activeElement
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
      return
    }

    // F1: Buy at Market
    if (e.key === 'F1') {
      e.preventDefault()
      onBuy?.()
      return
    }

    // F2: Sell at Market
    if (e.key === 'F2') {
      e.preventDefault()
      onSell?.()
      return
    }

    // Ctrl+B: Quick Buy
    if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'b') {
      e.preventDefault()
      onBuy?.()
      return
    }

    // Ctrl+S: Quick Sell
    if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 's') {
      e.preventDefault()
      onSell?.()
      return
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      onClose?.()
      return
    }

    // Ctrl+Enter: Confirm order (handled by modal, but document-level event)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('traderclaw:order:confirm'))
      return
    }
  }, [enabled, onBuy, onSell, onClose])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    isListeningRef.current = true

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      isListeningRef.current = false
    }
  }, [enabled, handleKeyDown])

  return {
    isListening: isListeningRef.current,
    shortcuts: HOTKEY_MAP,
  }
}
