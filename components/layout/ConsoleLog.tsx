'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useConsoleStore } from '@/store'
import { addLogListener } from '@/lib/utils/logger'
import type { LogEntry, LogLevel } from '@/lib/utils/logger'
import { ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react'
import { formatTime } from '@/lib/utils/date'

const LEVEL_LABELS: Record<LogLevel, string> = {
  info:   'INFO ',
  warn:   'WARN ',
  error:  'ERROR',
  trade:  'TRADE',
  signal: 'SIGNA',
  system: 'SYS  ',
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  info:   'var(--text-dim)',
  warn:   'var(--amber)',
  error:  'var(--red)',
  trade:  'var(--cyan)',
  signal: '#a78bfa',
  system: 'var(--text-muted)',
}

// Convert a DB row (snake_case) to LogEntry shape
function rowToEntry(row: any): LogEntry {
  return {
    id:        String(row.id),
    level:     row.level as LogLevel,
    source:    row.source,
    message:   row.message,
    timestamp: row.created_at,
  }
}

export default function ConsoleLog() {
  const { isOpen, height, filter, toggle, setFilter } = useConsoleStore()
  const [entries, setEntries]   = useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const lastIdRef  = useRef<number>(0)

  // Initial load + polling from DB
  const poll = useCallback(async () => {
    try {
      const url = lastIdRef.current
        ? `/api/logs?since=${encodeURIComponent(new Date(0).toISOString())}&limit=500`
        : `/api/logs?limit=500`
      const res  = await fetch(url)
      if (!res.ok) return
      const { data } = await res.json()
      if (!data?.length) return

      setEntries(data.map(rowToEntry))
      lastIdRef.current = data[data.length - 1]?.id ?? lastIdRef.current
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [poll])

  // Also capture client-side logs (if any) immediately
  useEffect(() => {
    return addLogListener(() => {
      // Re-poll soon after a client log fires
      setTimeout(poll, 500)
    })
  }, [poll])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, autoScroll, isOpen])

  async function clearLogs() {
    await fetch('/api/logs', { method: 'DELETE' })
    setEntries([])
    lastIdRef.current = 0
  }

  const filtered = filter === 'all' ? entries : entries.filter(e => e.level === filter)

  const FILTERS: (LogLevel | 'all')[] = ['all', 'trade', 'signal', 'info', 'warn', 'error']

  return (
    <div className="console-panel" style={{ height: isOpen ? height : 32 }}>
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 h-8 cursor-pointer select-none border-b"
        style={{ borderColor: 'var(--border)' }}
        onClick={toggle}
      >
        <Terminal size={12} style={{ color: 'var(--green)' }} />
        <span className="text-xs font-bold tracking-wider uppercase"
          style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono, monospace' }}>
          Console
        </span>
        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
          [{filtered.length} events]
        </span>

        <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-2xs px-2 py-0.5 rounded uppercase font-bold tracking-wide transition-all"
              style={{
                fontSize: '10px',
                fontFamily: 'JetBrains Mono',
                color:      filter === f ? 'var(--green)' : 'var(--text-muted)',
                background: filter === f ? 'rgba(0,255,65,0.1)' : 'transparent',
                border:     `1px solid ${filter === f ? 'var(--green)' : 'transparent'}`,
              }}
            >
              {f}
            </button>
          ))}
          <button onClick={clearLogs} title="Clear console"
            className="p-1 hover:text-red-400 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <Trash2 size={11} />
          </button>
          <button onClick={toggle} title="Toggle console"
            style={{ color: 'var(--text-muted)' }}>
            {isOpen ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
          </button>
        </div>
      </div>

      {/* Log lines */}
      {isOpen && (
        <div
          className="overflow-y-auto"
          style={{ height: height - 32 }}
          onScroll={e => {
            const el = e.currentTarget
            setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
          }}
        >
          {filtered.length === 0 && (
            <div className="console-log-line" style={{ color: 'var(--text-muted)' }}>
              <span className="log-time">--:--:--</span>
              <span className="log-level" style={{ color: 'var(--text-muted)' }}>SYS  </span>
              <span className="log-msg">TraderClaw Terminal ready. Awaiting events...</span>
            </div>
          )}
          {filtered.map((entry, i) => (
            <LogLine key={`${entry.id}-${i}`} entry={entry} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

function LogLine({ entry }: { entry: LogEntry }) {
  const time  = formatTime(new Date(entry.timestamp))
  const color = LEVEL_COLORS[entry.level] ?? 'var(--text-dim)'
  return (
    <div className={`console-log-line log-${entry.level}`}>
      <span className="log-time">{time}</span>
      <span className="log-level" style={{ color }}>{LEVEL_LABELS[entry.level]}</span>
      <span className="log-src"   title={entry.source}>{entry.source.padEnd(8).slice(0, 8)}</span>
      <span className="log-msg">{entry.message}</span>
    </div>
  )
}
