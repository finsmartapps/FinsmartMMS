import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── IST time helpers (all server-safe: UTC arithmetic, no host-TZ dependency) ──
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

function getISTNow(): { totalMins: number; dateStr: string; yesterdayStr: string } {
  const istDate = new Date(Date.now() + IST_OFFSET_MS)
  const h = istDate.getUTCHours()
  const m = istDate.getUTCMinutes()
  const totalMins = h * 60 + m
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())}`
  const yday = new Date(istDate.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayStr = `${yday.getUTCFullYear()}-${pad(yday.getUTCMonth() + 1)}-${pad(yday.getUTCDate())}`
  return { totalMins, dateStr, yesterdayStr }
}

export function getActiveLogDate(): string {
  const { totalMins, dateStr, yesterdayStr } = getISTNow()
  return totalMins < 5 * 60 ? yesterdayStr : dateStr
}

export type LogWindowState = 'open' | 'locked'

export function getLogState(
  submissionDeadline = '05:00',
  dayResetTime = '15:00',
  alwaysOpen = false
): { date: string; state: LogWindowState; deadlineDisplay: string; resetDisplay: string } {
  const { totalMins, dateStr, yesterdayStr } = getISTNow()
  const [dh, dm] = submissionDeadline.split(':').map(Number)
  const deadlineMins = dh * 60 + dm
  const [rh, rm] = dayResetTime.split(':').map(Number)
  const resetMins = rh * 60 + rm

  function fmt(h: number, m: number) {
    const suffix = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
  }

  const deadlineDisplay = fmt(dh, dm)
  const resetDisplay = fmt(rh, rm)

  if (alwaysOpen) return { date: dateStr, state: 'open', deadlineDisplay, resetDisplay }
  if (totalMins < deadlineMins) return { date: yesterdayStr, state: 'open', deadlineDisplay, resetDisplay }
  if (totalMins < resetMins)    return { date: dateStr,     state: 'locked', deadlineDisplay, resetDisplay }
  return { date: dateStr, state: 'open', deadlineDisplay, resetDisplay }
}

export function toDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS)
  const y = istDate.getUTCFullYear()
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(istDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayIST(): string {
  return toDateString(new Date())
}

export function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00')
  return date.getDay() === 0
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getAchievementPct(value: number, target: number): number {
  if (target === 0) return 100
  return Math.round((value / target) * 100)
}

export function getAchievementColor(value: number, target: number): 'green' | 'yellow' | 'red' | 'gray' {
  if (target === 0) return 'gray'
  const pct = getAchievementPct(value, target)
  if (pct >= 100) return 'green'
  if (pct >= 80) return 'yellow'
  return 'red'
}

export function generateSuggestions(
  entries: { activity: string; value: number; target: number }[]
): string[] {
  const suggestions: string[] = []
  for (const e of entries) {
    if (e.target === 0) continue
    const pct = getAchievementPct(e.value, e.target)
    if (pct < 50) {
      suggestions.push(`${e.activity}: ${e.value}/${e.target} (${pct}%) — Critically below target.`)
    } else if (pct < 80) {
      suggestions.push(`${e.activity}: ${e.value}/${e.target} (${pct}%) — Below target.`)
    }
  }
  if (entries.length > 0) {
    const calls = entries.find(e => e.activity.toLowerCase().includes('total calls'))
    const connected = entries.find(e => e.activity.toLowerCase().includes('connected'))
    if (calls && connected && calls.value > 0) {
      const connRate = Math.round((connected.value / calls.value) * 100)
      if (connRate < 10) {
        suggestions.push(`Connection rate is ${connRate}% — Consider adjusting call timing.`)
      }
    }
  }
  if (suggestions.length === 0) suggestions.push('All targets met or exceeded.')
  return suggestions
}
