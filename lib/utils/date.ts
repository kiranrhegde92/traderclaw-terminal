/** Market hours detection for NSE/BSE */

/** Returns 'pre-open' | 'open' | 'post-close' | 'closed' */
export function getMarketStatus(): 'pre-open' | 'open' | 'post-close' | 'closed' {
  const now = new Date()
  const day = now.getDay()  // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return 'closed'

  const h = now.getHours()
  const m = now.getMinutes()
  const mins = h * 60 + m

  // IST timings
  const PRE_OPEN_START  = 9 * 60 + 0   // 09:00
  const OPEN_START      = 9 * 60 + 15  // 09:15
  const CLOSE_TIME      = 15 * 60 + 30 // 15:30
  const POST_CLOSE_END  = 16 * 60 + 0  // 16:00

  if (mins < PRE_OPEN_START)    return 'closed'
  if (mins < OPEN_START)        return 'pre-open'
  if (mins < CLOSE_TIME)        return 'open'
  if (mins < POST_CLOSE_END)    return 'post-close'
  return 'closed'
}

export function isMarketOpen(): boolean {
  return getMarketStatus() === 'open'
}

/** Format time as HH:MM:SS IST */
export function formatTime(date = new Date()): string {
  return date.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })
}

/** Format date as DD-MMM-YYYY */
export function formatDate(date = new Date()): string {
  return date.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

/** Get the next weekly expiry (Thursday) for NSE */
export function getNextExpiry(from = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay()
  // Thursday = 4
  const daysToThursday = (4 - day + 7) % 7
  d.setDate(d.getDate() + (daysToThursday === 0 ? 7 : daysToThursday))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Format expiry date as "27-Mar-26" */
export function formatExpiry(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  '2-digit',
  })
}

/** Relative time (2 min ago, etc.) */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
