'use client'
import { useState, ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

export interface Column<T> {
  key:       string
  header:    string
  render?:   (row: T) => ReactNode
  sortable?: boolean
  align?:    'left' | 'right' | 'center'
  width?:    string
}

interface Props<T> {
  columns:    Column<T>[]
  data:       T[]
  rowKey:     (row: T) => string | number
  onRowClick?: (row: T) => void
  loading?:   boolean
  emptyMsg?:  string
  maxHeight?:  string
  compact?:   boolean
}

export default function DataTable<T>({
  columns, data, rowKey, onRowClick, loading, emptyMsg, maxHeight, compact,
}: Props<T>) {
  const [sortKey, setSortKey]   = useState<string | null>(null)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = (a as Record<string,unknown>)[sortKey]
    const bv = (b as Record<string,unknown>)[sortKey]
    if (av === bv) return 0
    const cmp = (av ?? '') < (bv ?? '') ? -1 : 1
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="term-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ textAlign: col.align ?? 'left', width: col.width, cursor: col.sortable ? 'pointer' : 'default' }}
                onClick={() => col.sortable && handleSort(col.key)}
                className={col.sortable ? 'select-none' : ''}
              >
                <span className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : undefined }}>
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc'
                      ? <ChevronUp   size={10} style={{ color: 'var(--green)' }} />
                      : <ChevronDown size={10} style={{ color: 'var(--green)' }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="text-center py-8">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Loading...
                </span>
              </td>
            </tr>
          )}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center py-8">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {emptyMsg ?? 'No data'}
                </span>
              </td>
            </tr>
          )}
          {!loading && sorted.map(row => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={clsx(onRowClick && 'cursor-pointer')}
            >
              {columns.map(col => (
                <td key={col.key}
                  style={{ textAlign: col.align ?? 'left' }}
                  className={compact ? 'py-1' : undefined}>
                  {col.render ? col.render(row) : String((row as Record<string,unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
