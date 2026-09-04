const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

/** YouTube-style coarse relative time: precise enough to be useful, never noisy. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp
  // Clock skew or an edited store shouldn't render "-3 days ago".
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'minute')
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour')

  const days = Math.floor(diff / DAY)
  if (days < 7) return plural(days, 'day')
  if (days < 30) return plural(Math.floor(days / 7), 'week')
  if (days < 365) return plural(Math.floor(days / 30), 'month')
  return plural(Math.floor(days / 365), 'year')
}

/** Full timestamp for the tooltip, where the exact date is worth having. */
export function absoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
