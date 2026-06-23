import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TelecallerCard } from '@/components/sales/manager/TelecallerCard'
import { ManagerDateNav } from '@/components/sales/manager/ManagerDateNav'
import { getActiveLogDate, todayIST, isWeekend, formatDisplayDate } from '@/lib/utils'
import type { Profile, Activity, DailyLog, DailyLogEntry, Target, Holiday } from '@/lib/types'
import { CalendarDays, RefreshCw, Users } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 0

export default async function ManagerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayIST()
  const defaultDate = getActiveLogDate()
  const { date: dateParam } = await searchParams
  // Clamp: never go into the future; default to active log date
  const activeDate = (dateParam && dateParam <= today) ? dateParam : defaultDate
  const isWeekendDay = isWeekend(activeDate)

  // Check holiday
  const { data: holiday } = await supabase
    .from('holidays')
    .select('label')
    .eq('holiday_date', activeDate)
    .single()

  // Fetch all telecallers
  const { data: telecallers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'telecaller')
    .eq('is_active', true)
    .order('name')

  // Fetch all active activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('is_active', true)
    .order('display_order')

  // Fetch all logs for active date
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('log_date', activeDate)

  // Fetch all entries for those logs
  const logIds = (logs ?? []).map((l: DailyLog) => l.id)
  let allEntries: DailyLogEntry[] = []
  if (logIds.length > 0) {
    const { data: entries } = await supabase
      .from('daily_log_entries')
      .select('*')
      .in('log_id', logIds)
    allEntries = (entries as DailyLogEntry[]) ?? []
  }

  // Fetch all targets (latest per user+activity)
  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .lte('effective_from', activeDate)
    .order('effective_from', { ascending: false })

  // Build target map: userId → activityId → min_value
  const targetMap: Record<string, Record<string, number>> = {}
  for (const t of (targets as Target[]) ?? []) {
    if (!targetMap[t.user_id]) targetMap[t.user_id] = {}
    if (!(t.activity_id in targetMap[t.user_id])) {
      targetMap[t.user_id][t.activity_id] = t.min_value
    }
  }

  const telecallerList = (telecallers as Profile[]) ?? []
  const activityList = (activities as Activity[]) ?? []
  const logList = (logs as DailyLog[]) ?? []

  const submitted = logList.filter(l => l.is_submitted).length
  const total = telecallerList.length

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Team Dashboard</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-[#6E6E73]">
            <CalendarDays size={14} />
            <span>{formatDisplayDate(activeDate)}</span>
            {isWeekendDay && <span className="text-[#FF9500] font-medium">· Weekend</span>}
            {holiday && <span className="text-[#FF9500] font-medium">· {(holiday as Holiday).label}</span>}
          </div>
          <div className="mt-2">
            <ManagerDateNav activeDate={activeDate} todayDate={today} />
          </div>
        </div>

        {/* Stats + Refresh */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Submission counter */}
          <div className="bg-white border border-[#E5E5EA] rounded-2xl px-5 py-3 text-center min-w-[110px]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold gradient-brand-text">{submitted}/{total}</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">Submitted today</p>
          </div>
          <Link
            href={activeDate === today ? '/manager' : `/manager?date=${activeDate}`}
            className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#DC2626] transition border border-[#E5E5EA] rounded-xl px-3 py-2.5 bg-white hover:border-[#DC2626]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Link>
        </div>
      </div>

      {/* Telecaller grid */}
      {telecallerList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5EA]">
          <Users size={36} className="mx-auto text-[#E5E5EA] mb-3" />
          <p className="text-[#6E6E73]">No telecallers added yet.</p>
          <Link href="/sales/manager/users" className="mt-3 inline-block text-[#DC2626] hover:underline text-sm font-medium">
            Add your first telecaller →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {telecallerList.map(tc => {
            const log = logList.find(l => l.user_id === tc.id) ?? null
            const logEntries = log ? allEntries.filter(e => e.log_id === log.id) : []
            const userTargets = targetMap[tc.id] ?? {}

            const entriesWithMeta = activityList.map(activity => ({
              activity,
              value: logEntries.find(e => e.activity_id === activity.id)?.value ?? 0,
              target: userTargets[activity.id] ?? 0,
              deficitReason: logEntries.find(e => e.activity_id === activity.id)?.deficit_reason ?? null,
            }))

            return (
              <TelecallerCard
                key={tc.id}
                profile={tc}
                log={log}
                entries={entriesWithMeta}
                activeDate={activeDate}
              />
            )
          })}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/manager/activities', label: 'Activities',   desc: 'Edit tracked metrics' },
          { href: '/manager/targets',    label: 'Targets',      desc: 'Set daily minimums' },
          { href: '/manager/users',      label: 'Users',        desc: 'Manage team members' },
          { href: '/manager/holidays',   label: 'Holidays',     desc: 'Mark non-working days' },
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white border border-[#E5E5EA] rounded-xl p-4 hover:border-[#DC2626] transition group"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <p className="font-semibold text-[#1D1D1F] text-[13px] group-hover:text-[#DC2626] transition">{link.label}</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
