import { generateDailyReport } from '@/lib/reports/daily'
import { sendDailyReportEmail, isEmailConfigured } from '@/lib/reports/email'
import { getActiveSubscriptions, updateSubscriptionLastSent } from '@/lib/db/queries/reports'

/**
 * Convert IST time to cron-compatible expression
 * IST is UTC+5:30, so 15:31 IST = 10:01 UTC
 */
function getScheduleCron(): string {
  // 15:31 IST (market close) = 10:01 UTC daily
  // Format: minute hour day month dayOfWeek
  return '1 10 * * *' // Every day at 10:01 UTC (15:31 IST)
}

/**
 * Main function to generate and send daily reports
 * Called by scheduler at 15:31 IST daily
 */
export async function scheduleDailyPnlReport() {
  console.log('[Reports] Generating daily P&L reports...')

  try {
    // For now, generate report for default account (1)
    const accountId = 1
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Generate the report
    const report = await generateDailyReport(accountId, today)
    console.log(`[Reports] Generated report for account ${accountId}:`, {
      totalPnl: report.totalPnl,
      tradesExecuted: report.tradesExecuted,
    })

    // Send emails if configured
    if (isEmailConfigured()) {
      const subscriptions = getActiveSubscriptions()
      console.log(`[Reports] Found ${subscriptions.length} active subscriptions`)

      for (const subscription of subscriptions) {
        try {
          const success = await sendDailyReportEmail(subscription.email, report)
          if (success && subscription.id) {
            updateSubscriptionLastSent(subscription.id)
          }
        } catch (error) {
          console.error(
            `[Reports] Failed to send email to ${subscription.email}:`,
            error
          )
        }
      }
    } else {
      console.log('[Reports] Email not configured - skipping email sends')
    }

    console.log('[Reports] Daily report cycle completed')
    return {
      success: true,
      accountId,
      reportDate: report.reportDate,
      totalPnl: report.totalPnl,
    }
  } catch (error) {
    console.error('[Reports] Error in daily report generation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Initialize the scheduler
 * Call this from your app initialization or server startup
 */
export function initializeReportScheduler() {
  try {
    // Try to require node-cron
    const cron = require('node-cron')

    // Schedule daily report at 15:31 IST (10:01 UTC)
    const task = cron.schedule(getScheduleCron(), async () => {
      await scheduleDailyPnlReport()
    })

    console.log('[Reports] Scheduler initialized - reports will run daily at 15:31 IST')
    return task
  } catch (error) {
    console.warn(
      '[Reports] node-cron not available - scheduler not initialized'
    )
    return null
  }
}

/**
 * Get next scheduled report time (15:31 IST)
 */
export function getNextReportTime(): Date {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000 // IST is UTC+5:30

  // Create a date at 15:31 IST
  let nextReport = new Date()
  nextReport.setHours(15, 31, 0, 0)
  nextReport = new Date(nextReport.getTime() - istOffset + (new Date().getTimezoneOffset() * 60 * 1000))

  // If that time has passed today, schedule for tomorrow
  if (nextReport <= now) {
    nextReport = new Date(nextReport.getTime() + 24 * 60 * 60 * 1000)
  }

  return nextReport
}

/**
 * Get time remaining until next report (in milliseconds)
 */
export function getTimeUntilNextReport(): number {
  return Math.max(0, getNextReportTime().getTime() - Date.now())
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
