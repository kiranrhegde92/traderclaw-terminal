'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex items-center justify-center h-screen bg-black">
          <div className="border border-red-400 p-6 max-w-md" style={{ borderColor: 'var(--red)' }}>
            <h1 className="text-red-400 font-bold mb-4 text-lg" style={{ color: 'var(--red)' }}>
              ⚠ CRITICAL SYSTEM ERROR
            </h1>
            <p className="text-xs mb-4 text-gray-400">
              {error.message || 'Fatal application error'}
            </p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 border border-green-400 text-green-400 text-xs font-bold hover:bg-green-400 hover:text-black transition"
              style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
            >
              RESTART
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
