'use client'

import { useEffect } from 'react'
import { log } from '@/lib/utils/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    log.error('error-boundary', `Application error: ${error.message}`)
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="term-card p-6 max-w-md">
        <h1 className="text-red-400 font-bold mb-4 text-lg" style={{ color: 'var(--red)' }}>
          ⚠ SYSTEM ERROR
        </h1>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary text-xs"
        >
          RESET SYSTEM
        </button>
      </div>
    </div>
  )
}
