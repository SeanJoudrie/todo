/**
 * Dates in this app are local calendar days stored as `YYYY-MM-DD`.
 * Never `new Date(string)` on them — that parses as UTC and shifts the day.
 */

export const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Whole calendar days from `from` to `to`. Negative means `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = fromISODate(from)
  const b = fromISODate(to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** The date the planner actually works to: soft target if set, else the hard deadline. */
export function effectiveDate(task: { dueDate?: string; targetDate?: string }): string | undefined {
  return task.targetDate ?? task.dueDate
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Short, human date. "today", "Fri", "Aug 28" — whichever carries the most meaning. */
export function formatDate(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  const d = fromISODate(iso)
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()]
  if (diff < -1 && diff > -7) return `last ${WEEKDAYS[d.getDay()]}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function overdueLabel(iso: string, today = todayISO()): string | null {
  const diff = daysBetween(today, iso)
  if (diff >= 0) return null
  const n = -diff
  return n === 1 ? '1 day late' : `${n} days late`
}

/** Always reads as an estimate: `~10m`, `~2h 30m`. */
export function formatDuration(minutes: number, approx = true): string {
  const prefix = approx ? '~' : ''
  if (minutes < 60) return `${prefix}${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${prefix}${h}h` : `${prefix}${h}h ${m}m`
}

/** Clock time N minutes after `start`, e.g. "9:05 AM". */
export function clockAt(start: Date, offsetMinutes: number): string {
  const d = new Date(start.getTime() + offsetMinutes * 60_000)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${suffix}`
}

/** Next occurrence of a weekday (0=Sun), strictly after today unless `includeToday`. */
export function nextWeekday(weekday: number, from = todayISO(), includeToday = false): string {
  const d = fromISODate(from)
  let delta = (weekday - d.getDay() + 7) % 7
  if (delta === 0 && !includeToday) delta = 7
  return addDays(from, delta)
}

export function relativeDays(iso: string, today = todayISO()): string {
  const n = daysBetween(today, iso)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n < 0) return overdueLabel(iso, today)!
  return `in ${n} days`
}
