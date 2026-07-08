import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DailyLogForm } from '@/components/sales/telecaller/DailyLogForm'
import { LogHistory } from '@/components/sales/telecaller/LogHistory'
import { DateNav } from '@/components/sales/telecaller/DateNav'
import type { HistoryRow } from '@/components/sales/telecaller/LogHistory'
import { isWeekend, formatDisplayDate, todayIST, getActiveLogDate } from '@/lib/utils'
import type { Activity, Target, DailyLog, DailyLogEntry, FollowUp } from '@/lib/types'
import { CalendarDays, ListTodo, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { MeetingTargetBanner } from '@/components/sales/telecaller/MeetingTargetBanner'

export default async function TelecallerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayIST()
  const monthStart = today.slice(0, 7) + '-01'
  // Last day and first day of NEXT month (for lt comparison)
  const [yr, mo] = today.split('-').map(Number)
  const monthEnd = new Date(yr, mo, 0).toISOString().split('T')[0]
  // nextMonthStart: mo is 1-indexed (5=May), so new Date(2026, 5, 1) = June 1
  const nextMonthStart = new Date(yr, mo, 1).toISOString().split('T')[0]
  const monthName = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long' })
  // Calendar days remaining in month (inclusive of today)
  const daysLeft = Math.max(
    Math.round((new Date(monthEnd + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000),
    0
  )
  const { date: dateParam } = await searchParams

  // Default to getActiveLogDate() so telecaller and manager always agree on the
  // active date. Before 5 AM IST → yesterday (grace period); after 5 AM → today.
  // todayIST() is still used as the navigation ceiling (can't go to the future).
  const activeDate = (dateParam && dateParam <= today) ? dateParam : getActiveLogDate()

  // Date 30 days ago for history
  const historyFrom = (() => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - 29)
    return d.toISOString().split('T')[0]
  })()

  // Parallel fetches
  const [holidayRes, activitiesRes, targetsRes, todayLogRes, historyLogsRes, followupsRes, meetingsCountRes, meetingTargetSettingRes] = await Promise.all([
    supabase.from('holidays').select('label').eq('holiday_date', activeDate).single(),
    supabase.from('activities').select('*').eq('is_active', true).order('display_order'),
    supabase.from('targets').select('*').eq('user_id', user.id).lte('effective_from', activeDate).order('effective_from', { ascending: false }),
    supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('log_date', activeDate).single(),
    supabase.from('daily_logs').select('id, log_date').eq('user_id', user.id).eq('is_submitted', true)
      .gte('log_date', historyFrom).lt('log_date', today)
      .order('log_date', { ascending: false }),
    // Follow-ups always based on today, not the viewed date
    supabase.from('follow_ups').select('id, first_name, last_name, company_name, follow_up_date, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte('follow_up_date', today)
      .order('follow_up_date', { ascending: true }),
    // Monthly meetings count — meetings SCHEDULED this month (meeting_date in current month)
    supabase.from('meetings').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('meeting_date', monthStart)
      .lte('meeting_date', monthEnd),
    // Meeting monthly target from settings
    supabase.from('settings').select('value').eq('key', 'meeting_monthly_target').single(),
  ])

  const holiday = holidayRes.data
  const activityList = (activitiesRes.data as Activity[]) ?? []
  const targets = (targetsRes.data as Target[]) ?? []
  const log = todayLogRes.data as DailyLog | null
  const historyLogs = historyLogsRes.data ?? []
  const pendingFollowups = (followupsRes.data as Pick<FollowUp, 'id' | 'first_name' | 'last_name' | 'company_name' | 'follow_up_date' | 'status'>[]) ?? []
  const overdueFollowups = pendingFollowups.filter(f => f.follow_up_date < today)
  const todayFollowups = pendingFollowups.filter(f => f.follow_up_date === today)
  const meetingsBooked = meetingsCountRes.count ?? 0
  const meetingTarget = parseInt(meetingTargetSettingRes.data?.value ?? '8', 10)

  // Build targetMap (Total Calls only for form)
  const totalCallsActivity = activityList.find(a => a.name === 'Total Calls')
  const rawTargetMap: Record<string, number> = {}
  for (const t of targets) {
    if (!(t.activity_id in rawTargetMap)) rawTargetMap[t.activity_id] = t.min_value
  }
  const targetMap: Record<string, number> = {}
  if (totalCallsActivity && rawTargetMap[totalCallsActivity.id]) {
    targetMap[totalCallsActivity.id] = rawTargetMap[totalCallsActivity.id]
  }
  const callTarget = totalCallsActivity ? (rawTargetMap[totalCallsActivity.id] ?? 0) : 0

  // Fetch today's entries
  let entries: DailyLogEntry[] = []
  if (log) {
    const { data: e } = await supabase.from('daily_log_entries').select('*').eq('log_id', log.id)
    entries = (e as DailyLogEntry[]) ?? []
  }

  // Fetch history entries
  let historyRows: HistoryRow[] = []
  if (historyLogs.length > 0) {
    const logIds = historyLogs.map((l: { id: string }) => l.id)
    const { data: histEntries } = await supabase
      .from('daily_log_entries')
      .select('log_id, activity_id, value, deficit_reason')
      .in('log_id', logIds)

    const entriesByLog: Record<string, { activity_id: string; value: number; deficit_reason: string | null }[]> = {}
    for (const e of (histEntries ?? [])) {
      if (!entriesByLog[e.log_id]) entriesByLog[e.log_id] = []
      entriesByLog[e.log_id].push(e)
    }

    historyRows = historyLogs.map((hl: { id: string; log_date: string }) => {
      const logEntries = entriesByLog[hl.id] ?? []
      const tcEntry = totalCallsActivity
        ? logEntries.find(e => e.activity_id === totalCallsActivity.id)
        : undefined
      const calls = tcEntry?.value ?? 0
      return {
        date: hl.log_date,
        calls,
        hitTarget: callTarget > 0 && calls >= callTarget,
        activities: activityList.map(a => {
          const e = logEntries.find(le => le.activity_id === a.id)
          return { name: a.name, value: e?.value ?? 0, deficit_reason: e?.deficit_reason ?? null }
        }),
      }
    })
  }

  const isWeekendDay = isWeekend(activeDate)
  const isHoliday = !!holiday
  const isSubmitted = log?.is_submitted ?? false
  const activityNames = activityList.map(a => a.name)

  return (
    <div className="max-w-lg mx-auto px-4 py-7 space-y-4">

      {/* Date header card */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] px-5 py-4"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays size={13} className="text-[#AEAEB2]" />
              <span className="text-[11px] text-[#AEAEB2] uppercase tracking-wider font-medium">Daily Log</span>
            </div>
            <h1 className="text-[20px] font-bold text-[#1D1D1F] tracking-tight">{formatDisplayDate(activeDate)}</h1>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">
              {isSubmitted ? 'Already submitted — you can edit and resubmit below.' : 'Enter your activity numbers for this date.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Date navigation */}
            <DateNav activeDate={activeDate} todayDate={today} />
            <div className="flex flex-col items-end gap-1">
              {isSubmitted && (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] inline-block" />
                  Submitted
                </span>
              )}
              {isHoliday && (
                <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-orange-100">
                  {holiday!.label}
                </span>
              )}
              {isWeekendDay && !isHoliday && (
                <span className="inline-flex items-center gap-1 bg-[#F5F5F7] text-[#6E6E73] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#E5E5EA]">
                  Weekend
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Monthly meeting target banner ── */}
      <MeetingTargetBanner
        meetingsBooked={meetingsBooked}
        meetingTarget={meetingTarget}
        daysLeft={daysLeft}
        monthName={monthName}
      />

      {/* ── Follow-ups widget (always based on today) ── */}
      {pendingFollowups.length > 0 && (
        <div className={`rounded-2xl border px-5 py-4 ${overdueFollowups.length > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {overdueFollowups.length > 0
                ? <AlertCircle size={15} className="text-[#DC2626]" />
                : <ListTodo size={15} className="text-[#FF9500]" />}
              <p className="text-[13px] font-semibold text-[#1D1D1F]">
                {overdueFollowups.length > 0
                  ? `${overdueFollowups.length} callback${overdueFollowups.length !== 1 ? 's' : ''} overdue`
                  : `${todayFollowups.length} callback${todayFollowups.length !== 1 ? 's' : ''} due today`}
                {overdueFollowups.length > 0 && todayFollowups.length > 0 && (
                  <span className="text-[#FF9500] font-normal ml-1">+ {todayFollowups.length} today</span>
                )}
              </p>
            </div>
            <Link href="/sales/telecaller/followups"
              className="text-[12px] font-semibold text-[#DC2626] hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-1.5">
            {pendingFollowups.slice(0, 4).map(f => {
              const isOverdue = f.follow_up_date < today
              return (
                <div key={f.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1D1D1F]">{f.first_name} {f.last_name}</p>
                    {f.company_name && <p className="text-[11px] text-[#6E6E73]">{f.company_name}</p>}
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-[#DC2626]' : 'bg-orange-100 text-[#FF9500]'}`}>
                    {isOverdue ? `${Math.round((new Date(today).getTime() - new Date(f.follow_up_date).getTime()) / 86400000)}d overdue` : 'Today'}
                  </span>
                </div>
              )
            })}
            {pendingFollowups.length > 4 && (
              <p className="text-[12px] text-[#6E6E73] text-center pt-1">
                +{pendingFollowups.length - 4} more — <Link href="/sales/telecaller/followups" className="text-[#DC2626] hover:underline">open Callbacks</Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Log form — always shown for any date */}
      <DailyLogForm
        key={activeDate}
        activities={activityList}
        targetMap={targetMap}
        existingLog={log}
        existingEntries={entries}
        userId={user.id}
        activeDate={activeDate}
      />

      {/* ── Submission history ── */}
      {historyRows.length > 0 && (
        <LogHistory
          rows={historyRows}
          activityNames={activityNames}
          callTarget={callTarget}
        />
      )}
    </div>
  )
}
