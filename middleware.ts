import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// ─── Rate limiter (in-memory sliding window per IP) ───────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ─── Protected route prefixes (require JWT in production) ─────────────────────
const PROTECTED = [
  '/api/paper-trade',
  '/api/strategies',
  '/api/screener/scans',
  '/api/watchlist',
  '/api/monitor',
  '/api/portfolio',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only process API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'

  // Stricter limit for order placement
  const isOrderPost =
    pathname === '/api/paper-trade/orders' && request.method === 'POST'
  const allowed = rateLimit(ip, isOrderPost ? 20 : 100)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: 60 },
      { status: 429 }
    )
  }

  // ── Auth (only enforced in production) ───────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()

  const isProtected = PROTECTED.some((prefix) => pathname.startsWith(prefix))
  if (!isProtected) return NextResponse.next()

  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization') ?? ''
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
    request.cookies.get('openclaw-auth')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await verifyToken(token)
    return NextResponse.next()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export const config = {
  matcher: '/api/:path*',
}
