import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: selfProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (selfProfile?.role !== 'manager' && selfProfile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const [profileRes, activitiesRes, logsRes, meetingsRes, holidaysRes, targetsRes, followupsRes] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('id', userId).single(),
    supabase.from('activities').select('id, name, display_order').eq('is_active', true).order('display_order'),
    supabase.from('daily_logs').select('id, log_date, is_submitted, submitted_at').eq('user_id', userId).gte('log_date', from).lte('log_date', to).order('log_date'),
    supabase.from('meetings').select('id, first_name, last_name, company_name, meeting_date, lead_source, outcome').eq('user_id', userId).gte('meeting_date', from).lte('meeting_date', to).order('meeting_date'),
    supabase.from('holidays').select('holiday_date').gte('holiday_date', from).lte('holiday_date', to),
    supabase.from('targets').select('activity_id, min_value, effective_from').eq('user_id', userId).lte('effective_from', to).order('effective_from', { ascending: false }),
    supabase.from('follow_ups').select('id, status, follow_up_date, first_name, last_name').eq('user_id', userId),
  ])

  const profile = profileRes.data
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const activities = activitiesRes.data ?? []
  const logs = logsRes.data ?? []
  const meetings = meetingsRes.data ?? []
  const holidays = (holidaysRes.data ?? []).map((h: { holiday_date: string }) => h.holiday_date)
  const targets = targetsRes.data ?? []
  const followups = followupsRes.data ?? []

  const totalCallsAct = activities.find((a: { name: string }) => a.name === 'Total Calls')

  // Get target for activity (latest effective_from <= date)
  function getTarget(activityId: string): number {
    return targets.find((t: { activity_id: string }) => t.activity_id === activityId)?.min_value ?? 0
  }

  // Fetch entries
  const logIds = logs.map((l: { id: string }) => l.id)
  let entries: { log_id: string; activity_id: string; value: number; deficit_reason: string | null }[] = []
  if (logIds.length > 0) {
    const { data: e } = await supabase.from('daily_log_entries').select('log_id, activity_id, value, deficit_reason').in('log_id', logIds)
    entries = e ?? []
  }

  const entryByLog: Record<string, typeof entries> = {}
  for (const e of entries) {
    if (!entryByLog[e.log_id]) entryByLog[e.log_id] = []
    entryByLog[e.log_id].push(e)
  }

  // Build working days set
  const holidaySet = new Set(holidays)
  const workingDays: string[] = []
  const d = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0]
    const dow = d.getDay()
    if (dow !== 0 && !holidaySet.has(dateStr)) workingDays.push(dateStr)
    d.setDate(d.getDate() + 1)
  }

  const callTarget = totalCallsAct ? getTarget(totalCallsAct.id) : 0

  // Day-by-day chart data (working days only)
  const logByDate: Record<string, typeof logs[0]> = {}
  for (const log of logs) logByDate[log.log_date] = log

  const dailyChart = workingDays.map(date => {
    const log = logByDate[date]
    const submitted = log?.is_submitted ?? false
    const logEntries = log ? (entryByLog[log.id] ?? []) : []
    const calls = totalCallsAct ? (logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)?.value ?? 0) : 0
    return { date, calls, target: callTarget, submitted }
  })

  // Submitted log rows with all activity values
  const submittedLogs = logs.filter((l: { is_submitted: boolean }) => l.is_submitted).map((log: { id: string; log_date: string; submitted_at: string | null }) => {
    const logEntries = entryByLog[log.id] ?? []
    const calls = totalCallsAct ? (logEntries.find((e: { activity_id: string }) => e.activity_id === totalCallsAct.id)?.value ?? 0) : 0
    return {
      id: log.id,
      date: log.log_date,
      submittedAt: log.submitted_at,
      calls,
      hitTarget: callTarget > 0 && calls >= callTarget,
      activities: activities.map((a: { id: string; name: string }) => {
        const entry = logEntries.find((e: { activity_id: string }) => e.activity_id === a.id)
        return { id: a.id, name: a.name, value: entry?.value ?? 0, deficit_reason: entry?.deficit_reason ?? null }
      }),
    }
  })

  // KPI summary
  const totalCalls = submittedLogs.reduce((s: number, l: { calls: number }) => s + l.calls, 0)
  const daysSubmitted = submittedLogs.length
  const daysHitTarget = submittedLogs.filter((l: { hitTarget: boolean }) => l.hitTarget).length
  const totalTarget = callTarget * daysSubmitted
  const achievementPct = totalTarget > 0 ? Math.round((totalCalls / totalTarget) * 100) : null
  const submissionRate = workingDays.length > 0 ? Math.round((daysSubmitted / workingDays.length) * 100) : 0
  const followupsDone = followups.filter((f: { status: string }) => f.status === 'done').length
  const meetingsBooked = meetings.filter((m: { outcome: string | null }) => m.outcome !== 'rescheduled').length
  const meetingsCompleted = meetings.filter((m: { outcome: string | null }) => m.outcome === 'completed' || m.outcome === 'closed_won').length

  return NextResponse.json({
    profile,
    period: { from, to, workingDays: workingDays.length },
    summary: { totalCalls, callTarget, totalTarget, achievementPct, daysSubmitted, daysHitTarget, submissionRate, meetings: meetingsBooked, meetingsCompleted, followupsDone, followupsTotal: followups.length },
    dailyChart,
    submittedLogs,
    meetings,
    activities,
  })
}
