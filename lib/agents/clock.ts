// Local clock in a given timezone (shared by the server sender and the UI status line).
export function localClock(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  const weekday = get('weekday')
  const startOfDay = new Date(now.getTime() - ((hour * 60 + minute) * 60 + now.getSeconds()) * 1000)
  return { hour, minute, weekday, isWeekend: weekday === 'Sat' || weekday === 'Sun', startOfDayISO: startOfDay.toISOString() }
}
