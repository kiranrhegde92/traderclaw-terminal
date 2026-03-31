/** Format number as Indian Rupee */
export function formatINR(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
    if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
    if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(2)}K`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Format plain number with Indian locale */
export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/** Format large numbers compactly (1.2L, 45Cr, etc.) */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`
  if (Math.abs(n) >= 1e5) return `${(n / 1e5).toFixed(2)}L`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

/** Format percentage with sign */
export function formatPct(n: number, decimals = 2): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}%`
}

/** Format price change with color class */
export function priceClass(n: number): string {
  if (n > 0) return 'price-up'
  if (n < 0) return 'price-down'
  return 'price-flat'
}

/** Format volume */
export function formatVolume(n: number): string {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

/** Parse Excel number date to JS Date */
export function excelDateToDate(serial: number): Date {
  const utc_days  = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}
