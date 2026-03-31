'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseWebSocketOptions {
  onMessage?: (data: any) => void
  onOpen?:    () => void
  onClose?:   () => void
  reconnect?: boolean
  reconnectInterval?: number
  maxRetries?: number
}

export function useWebSocket(url: string | null, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    reconnect        = true,
    reconnectInterval = 3000,
    maxRetries        = 5,
  } = options

  const wsRef      = useRef<WebSocket | null>(null)
  const retries    = useRef(0)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<WsStatus>('closed')

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('open')
      retries.current = 0
      onOpen?.()
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        onMessage?.(data)
      } catch {
        onMessage?.(e.data)
      }
    }

    ws.onclose = () => {
      setStatus('closed')
      onClose?.()
      if (reconnect && retries.current < maxRetries) {
        retries.current++
        timerRef.current = setTimeout(connect, reconnectInterval)
      }
    }

    ws.onerror = () => {
      setStatus('error')
      ws.close()
    }
  }, [url, onMessage, onOpen, onClose, reconnect, reconnectInterval, maxRetries])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  const disconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    wsRef.current?.close()
    wsRef.current = null
    setStatus('closed')
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, send, disconnect, reconnect: connect }
}
