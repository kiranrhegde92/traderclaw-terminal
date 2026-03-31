import { NextRequest, NextResponse } from 'next/server'
import { generateDailyReport } from '@/lib/reports/daily'
import { getLatestReport } from '@/lib/db/queries/reports'

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Simple in-memory cache
const reportCache: Map<number, { data: any; timestamp: number }> = new Map()

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true'

  try {
    // Check cache
    if (!forceRefresh) {
      const cached = reportCache.get(accountId)
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json({
          data: cached.data,
          cached: true,
          cacheExpiresAt: new Date(cached.timestamp + CACHE_DURATION),
        })
      }
    }

    // Generate fresh report for today (IST = UTC+5:30)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const today = new Date(nowIST.toISOString().split('T')[0] + 'T00:00:00.000Z')

    const report = await generateDailyReport(accountId, today)

    // Cache the result
    reportCache.set(accountId, {
      data: report,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      data: report,
      cached: false,
      cacheExpiresAt: new Date(Date.now() + CACHE_DURATION),
    })
  } catch (error) {
    // If generation fails, try to return latest cached report
    try {
      const cached = getLatestReport(accountId)
      if (cached) {
        return NextResponse.json({
          data: cached,
          cached: true,
          warning: 'Using cached report due to generation error',
        })
      }
    } catch (fallbackError) {
      console.error('Error getting fallback report:', fallbackError)
    }

    console.error('Error generating daily report:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily report', detail: String(error) },
      { status: 500 }
    )
  }
}
