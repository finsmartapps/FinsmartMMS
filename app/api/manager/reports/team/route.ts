import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function countWorkingDays(from: string, to: string, holidays: string[]): number {
  const holidaySet = new Set(holidays)
  let count = 0
  const d = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (d <= end) {
    const dow = d.getDay()
    const dateStr = d.toISOString().split('T')[0]
    if (dow !== 0 && !holidaySet.has(dateStr)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (selfProfile?.role !== 'manager' && selfProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const [profilesRes, activitiesRes, logsRes, meetingsRes, holidaysRes, targetsRes] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('role', 'telecaller').eq('is_active', true).order('name'),
    supabase.from('activities').select('id, name').eq('is_active', true),
    supabase.from('daily_logs').select('id, user_id, log_date, is_submitted').gte('log_date', from).lte('log_date', to),
    supabase.from('meetings').select('user_id, meeting_date, outcome').gte('meeting_date', from).lte('meeting_date', to),
    supabase.from('holidays').select('holiday_date').gte('holiday_date', from).lte('holiday_date', to),
    supabase.from('targets').select('user_id, activity_id, min_value, effective_from').lte('effective_from', to).order('effective_from', { ascending: false }),
  ])

  const telecallers = profilesRes.data ?? []
  const activities = activitiesRes.data ?? []
  const logs = logsRes.data ?? []
  const meetings = meetingsRes.data ?? []
  const holidays = (holidaysRes.data ?? []).map((h: { holiday_date: string }) => h.holiday_date)
  const targets = targetsRes.data ?? []

  const totalCallsAct = activities.find((a: { name: string }) => a.name === 'Total Calls')

  // Fetch entries for submitted logs
  const submittedLogIds = logs.filter((l: { is_submitted: boolean }) => l.is_submitted).map((l: { id: string }) => l.id)
  let entries: { log_id: string; activity_id: string; value: number; deficit_reason: string | null }[] = []
  if (submittedLogIds.length > 0) {
    const { data: e } = await supabase.from('daily_log_entries').select('log_id, activity_id, value, deficit_reason').in('log_id', submittedLogIds)
    entries = e ?? []
  }

  // Index entries by log_id
  const entryByLog: Record<string, typeof entries> = {}
  for (const e of entries) {
    if (!entryByLog[e.log_id]) entryByLog[e.log_id] = []
    entryByLog[e.log_id].push(e)
  }

  // Index logs by user_id
  const logsByUser: Record<string, typeof logs> = {}
  for (const log of logs) {
    if (!logsByUser[log.user_id]) logsByUser[log.user_id] = []
    logsByUser[log.user_id].push(log)
  }

  // Get latest target for user + activity
  function getTarget(userId: string, activityId: string): number {
    return targets.find((t: { user_id: string; activity_id: string; min_value: number }) => t.user_id === userId && t.activity_id === activityId)?.min_value ?? 0
  }

  const totalWorkingDays = countWorkingDays(from, to, holidays)

  // Per-telecaller stats
  const telecallerStats = telecallers.map((tc: { id: string; name: string }) => {
    const userLogs = (logsByUser[tc.id] ?? []).filter((l: { is_submitted: boolean }) => l.is_submitted)
    const daysSubmitted = userLogs.length
    const callTarget = totalCallsAct ? getTarget(tc.id, totalCallsAct.id) : 0
    let totalCalls = 0, daysHitTarget = 0

    for (const log of userLogs) {
      const logEntries = entryByLog[log.id] ?? []
      const calls = totalCallsAct ? (logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)?.value ?? 0) : 0
      totalCalls += calls
      if (callTarget > 0 && calls >= callTarget) daysHitTarget++
    }

    const totalTarget = callTarget * daysSubmitted
    const achievementPct = totalTarget > 0 ? Math.round((totalCalls / totalTarget) * 100) : null
    const submissionRate = totalWorkingDays > 0 ? Math.round((daysSubmitted / totalWorkingDays) * 100) : 0

    return {
      id: tc.id,
      name: tc.name,
      daysSubmitted,
      workingDays: totalWorkingDays,
      submissionRate,
      totalCalls,
      callTarget,
      achievementPct,
      daysHitTarget,
      meetings: meetings.filter((m: { user_id: string; outcome: string | null }) => m.user_id === tc.id && m.outcome !== 'rescheduled').length,
    }
  })

  // Daily trend — group by month if range > 60 days
  const rangeLen = daysBetween(from, to)
  const useMonthly = rangeLen > 60

  const dateCallMap: Record<string, number> = {}
  for (const log of logs.filter((l: { is_submitted: boolean }) => l.is_submitted)) {
    const logEntries = entryByLog[log.id] ?? []
    const calls = totalCallsAct ? (logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)?.value ?? 0) : 0
    const key = useMonthly ? log.log_date.slice(0, 7) : log.log_date
    dateCallMap[key] = (dateCallMap[key] ?? 0) + calls
  }

  const trend: { label: string; calls: number }[] = []
  if (useMonthly) {
    const months = new Set<string>()
    const d = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    while (d <= end) {
      months.add(d.toISOString().slice(0, 7))
      d.setDate(d.getDate() + 1)
    }
    for (const m of [...months].sort()) {
      trend.push({ label: m, calls: dateCallMap[m] ?? 0 })
    }
  } else {
    const d = new Date(from + 'T00:00:00')
    const end = new Date(to + 'T00:00:00')
    while (d <= end) {
      const dateStr = d.toISOString().split('T')[0]
      const dow = d.getDay()
      if (dow !== 0 && !holidays.includes(dateStr)) {
        trend.push({ label: dateStr, calls: dateCallMap[dateStr] ?? 0 })
      }
      d.setDate(d.getDate() + 1)
    }
  }

  // Per-user trend (same date buckets as team trend)
  const trendByUser: Record<string, { label: string; calls: number }[]> = {}
  for (const tc of telecallers) {
    const userSubmittedLogs = (logsByUser[tc.id] ?? []).filter((l: { is_submitted: boolean }) => l.is_submitted)
    const userDateCallMap: Record<string, number> = {}
    for (const log of userSubmittedLogs) {
      const logEntries = entryByLog[log.id] ?? []
      const calls = totalCallsAct
        ? (logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)?.value ?? 0)
        : 0
      const key = useMonthly ? log.log_date.slice(0, 7) : log.log_date
      userDateCallMap[key] = (userDateCallMap[key] ?? 0) + calls
    }
    trendByUser[tc.id] = trend.map(t => ({ label: t.label, calls: userDateCallMap[t.label] ?? 0 }))
  }

  // Meeting trend — booked and completed per day/month bucket (exclude rescheduled from booked count)
  const meetingBookedMap: Record<string, number> = {}
  const meetingCompletedMap: Record<string, number> = {}
  for (const m of meetings) {
    if (m.outcome === 'rescheduled') continue
    const key = useMonthly ? m.meeting_date.slice(0, 7) : m.meeting_date
    meetingBookedMap[key] = (meetingBookedMap[key] ?? 0) + 1
    if (m.outcome === 'completed' || m.outcome === 'closed_won') {
      meetingCompletedMap[key] = (meetingCompletedMap[key] ?? 0) + 1
    }
  }
  const meetingTrend = trend.map(t => ({
    label: t.label,
    booked: meetingBookedMap[t.label] ?? 0,
    completed: meetingCompletedMap[t.label] ?? 0,
  }))

  // Deficit reasons — collect all non-empty deficit reasons for "Total Calls" activity across all submitted logs
  const deficitReasons: { telecallerId: string; telecallerName: string; date: string; reason: string }[] = []
  if (totalCallsAct) {
    for (const log of logs.filter((l: { is_submitted: boolean }) => l.is_submitted)) {
      const logEntries = entryByLog[log.id] ?? []
      const callEntry = logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)
      if (callEntry?.deficit_reason) {
        const tc = telecallers.find((t: { id: string }) => t.id === log.user_id)
        if (tc) {
          deficitReasons.push({
            telecallerId: log.user_id,
            telecallerName: tc.name,
            date: log.log_date,
            reason: callEntry.deficit_reason,
          })
        }
      }
    }
  }
  // Sort by date descending
  deficitReasons.sort((a, b) => b.date.localeCompare(a.date))

  // Summary
  const teamTotalCalls = telecallerStats.reduce((s: number, t: { totalCalls: number }) => s + t.totalCalls, 0)
  const teamMeetings = meetings.filter((m: { outcome: string | null }) => m.outcome !== 'rescheduled').length
  const teamMeetingsCompleted = meetings.filter((m: { outcome: string | null }) => m.outcome === 'completed' || m.outcome === 'closed_won').length
  const validPcts = telecallerStats.filter((t: { achievementPct: number | null }) => t.achievementPct !== null)
  const avgAchievement = validPcts.length > 0
    ? Math.round(validPcts.reduce((s: number, t: { achievementPct: number | null }) => s + (t.achievementPct ?? 0), 0) / validPcts.length)
    : null
  const teamSubmissionRate = totalWorkingDays > 0 && telecallers.length > 0
    ? Math.round(telecallerStats.reduce((s: number, t: { daysSubmitted: number }) => s + t.daysSubmitted, 0) / (totalWorkingDays * telecallers.length) * 100)
    : 0

  return NextResponse.json({
    period: { from, to, workingDays: totalWorkingDays, useMonthly },
    summary: { teamTotalCalls, teamMeetings, teamMeetingsCompleted, avgAchievement, teamSubmissionRate },
    telecallers: telecallerStats,
    trend,
    trendByUser,
    meetingTrend,
    deficitReasons,
  })
}
