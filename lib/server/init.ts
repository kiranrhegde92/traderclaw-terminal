/**
 * Server initialization module
 * Call this from your server startup or API initialization
 */

import { initializeReportScheduler } from '@/lib/scheduler/reports'

/**
 * Initialize all server-side services
 * Should be called once during app startup (e.g., in layout.tsx or a startup hook)
 */
export async function initializeServer() {
  console.log('[Server] Initializing services...')

  try {
    // Initialize report scheduler
    const reportScheduler = initializeReportScheduler()
    if (reportScheduler) {
      console.log('[Server] Report scheduler initialized')
    }
  } catch (error) {
    console.error('[Server] Initialization error:', error)
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownServer() {
  console.log('[Server] Shutting down services...')
  // Add cleanup logic here if needed
}
