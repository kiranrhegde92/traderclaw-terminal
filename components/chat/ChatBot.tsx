'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2, Trash2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What is PCR and how to use it?',
  'How do I place a GTT order?',
  'Explain options Greeks',
  'How to set a price alert?',
]

export default function ChatBot() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || 'Request failed')
      }
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        const snapshot = text
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: snapshot }
          return next
        })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: `Error: ${err.message || 'could not reach TraderBot. Add your Groq API key in Settings.'}`,
          }
          return next
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, streaming])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clear = () => {
    if (streaming) abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="TraderBot"
        style={{
          position: 'fixed',
          bottom: '220px',
          right: '16px',
          zIndex: 60,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: open ? 'var(--surface-high)' : 'var(--green)',
          border: '1px solid var(--border-high)',
          color: open ? 'var(--green)' : '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? 'none' : '0 0 12px var(--green)',
          transition: 'all 0.2s',
        }}
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '270px',
            right: '16px',
            width: '360px',
            height: '480px',
            zIndex: 59,
            background: 'var(--surface)',
            border: '1px solid var(--border-high)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 0 24px rgba(0,255,65,0.08)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-high)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)' }}>
              <Bot size={14} />
              <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>TRADERBOT</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>AI</span>
            </div>
            <button
              onClick={clear}
              title="Clear chat"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: '11px', lineHeight: 1.6 }}>
                  Ask me anything about trading or TraderClaw features.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--surface-high)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--green)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--green)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-dim)'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: msg.role === 'user' ? 'var(--cyan)' : 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#000',
                }}>
                  {msg.role === 'user' ? <User size={11} /> : <Bot size={11} />}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '80%',
                  padding: '7px 10px',
                  borderRadius: msg.role === 'user' ? '8px 2px 8px 8px' : '2px 8px 8px 8px',
                  background: msg.role === 'user' ? 'rgba(0,212,255,0.08)' : 'var(--surface-high)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(0,212,255,0.2)' : 'var(--border)'}`,
                  color: 'var(--text)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                  {/* Blinking cursor while streaming last assistant message */}
                  {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span style={{ color: 'var(--green)', animation: 'blink 1s step-end infinite' }}>▌</span>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {streaming && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#000' }}>
                  <Bot size={11} />
                </div>
                <Loader2 size={14} style={{ color: 'var(--green)', animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: '6px',
            alignItems: 'flex-end',
            flexShrink: 0,
            background: 'var(--surface-high)',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about trading or app features…"
              rows={1}
              style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border-high)',
                borderRadius: '4px',
                padding: '6px 8px',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: '12px',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                maxHeight: '80px',
                overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 80) + 'px'
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              style={{
                background: input.trim() && !streaming ? 'var(--green)' : 'var(--surface)',
                border: '1px solid var(--border-high)',
                borderRadius: '4px',
                padding: '6px 8px',
                color: input.trim() && !streaming ? '#000' : 'var(--text-muted)',
                cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes spin  { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </>
  )
}
