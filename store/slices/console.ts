import { create } from 'zustand'
import type { LogEntry, LogLevel } from '@/lib/utils/logger'

interface ConsoleState {
  entries:    LogEntry[]
  isOpen:     boolean
  height:     number
  filter:     LogLevel | 'all'
  maxEntries: number

  addEntry:   (e: LogEntry) => void
  toggle:     () => void
  setHeight:  (h: number) => void
  setFilter:  (f: LogLevel | 'all') => void
  clear:      () => void
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  entries:    [],
  isOpen:     false,
  height:     180,
  filter:     'all',
  maxEntries: 300,

  addEntry: (e) => set(s => {
    // Deduplicate by id to handle StrictMode double-invocation
    if (s.entries.some(x => x.id === e.id)) return s
    return { entries: [...s.entries.slice(-(s.maxEntries - 1)), e] }
  }),

  toggle:     ()  => set(s => ({ isOpen: !s.isOpen })),
  setHeight:  (h) => set({ height: h }),
  setFilter:  (f) => set({ filter: f }),
  clear:      ()  => set({ entries: [] }),
}))
