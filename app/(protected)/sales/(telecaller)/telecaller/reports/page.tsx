'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Phone, CalendarCheck, TrendingUp, ListTodo,
  Loader2, CheckCircle2, XCircle, Download,
} from 'lucide-react'
import { PeriodSelector, getPeriodDates } from '@/components/sales/manager/PeriodSelector'
import { IndividualChart } from '@/components/sales/manager/ReportCharts'
import type { Period, DateRange } from '@/components/sales/manager/PeriodSelector'
import { formatShortDate } from '@/lib/utils'

interface ActivityRow { id: string; name: string; value: number; deficit_reason: string | null }
interface LogRow { id: string; date: string; submittedAt: string | null; calls: number; hitTarget: boolean; activities: ActivityRow[] }
interface MeetingRow { id: string; first_name: string; last_name: string; company_name: string; meeting_date: string; lead_source: string | null }
interface DailyPoint { date: string; calls: number; target: number; submitted: boolean }

interface UserData {
  profile: { id: string; name: string; email: string }
  period: { from: string; to: string; workingDays: number }
  summary: {
    totalCalls: number; callTarget: number; totalTarget: number
    achievementPct: number | null; daysSubmitted: number
    submissionRate: number; meetings: number; followupsDone: number; followupsTotal: number
  }
  dailyChart: DailyPoint[]
  submittedLogs: LogRow[]
  meetings: MeetingRow[]
  activities: { id: string; name: string }[]
}

function exportCSV(data: UserData) {
  const callActId = data.activities.find(a => a.name === 'Total Calls')?.id
  const rows = [
    ['Date', ...data.activities.map(a => a.name), 'Target Hit', 'Deficit Reason'],
    ...data.submittedLogs.map(log => {
      const callRow = log.activities.find(a => a.id === callActId)
      return [
        formatShortDate(log.date),
        ...log.activities.map(a => a.value),
        log.hitTarget ? 'Yes' : 'No',
        callRow?.deficit_reason ?? '',
      ]
    }),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `my-report-${data.period.from}-to-${data.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function initSel(searchFrom?: string | null, searchTo?: string | null): { period: Period; from: string; to: string } {
  if (searchFrom && searchTo) return { period: 'custom', from: searchFrom, to: searchTo }
  const range = getPeriodDates('month')
  return { period: 'month', ...range }
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] px-5 py-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={15} className="text-white" />
      </div>
      <p className="text-[24px] font-bold text-[#1D1D1F] leading-none">{value}</p>
      <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-[#AEAEB2] mt-0.5">{sub}</p>}
    </div>
  )
}

export default function TelecallerReportsPage() {
  const searchParams = useSearchParams()
  const [sel, setSel] = useState(() => initSel(searchParams.get('from'), searchParams.get('to')))
  const [data, setData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    const res = await fetch(`/api/telecaller/reports?from=${from}&to=${to}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(sel.from, sel.to)
  }, [sel.from, sel.to, fetchData])

  function handlePeriodChange(range: DateRange, period: Period) {
    setSel({ period, ...range })
    fetchData(range.from, range.to)
  }

  const s = data?.summary
  const periodLabel = data
    ? `${formatShortDate(data.period.from)}${data.period.from !== data.period.to ? ` – ${formatShortDate(data.period.to)}` : ''}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">My Reports</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">{periodLabel || 'Your performance overview'}</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-3">
          {data && (
            <button
              onClick={() => exportCSV(data)}
              className="flex items-center gap-1.5 border border-[#E5E5EA] bg-white text-[#6E6E73] hover:text-[#1D1D1F] text-[13px] font-medium px-3 py-2 rounded-xl transition hover:border-[#D1D1D6]"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
          <PeriodSelector value={sel} onChange={handlePeriodChange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#DC2626]" />
        </div>
      ) : !data ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Phone} label="Total Calls" value={s!.totalCalls.toLocaleString()} sub={`target ${s!.callTarget}/day`} color="bg-[#DC2626]" />
            <KpiCard
              icon={TrendingUp}
              label="Achievement"
              value={s!.achievementPct !== null ? `${s!.achievementPct}%` : '—'}
              sub="vs daily target"
              color={s!.achievementPct !== null && s!.achievementPct >= 100 ? 'bg-[#34C759]' : s!.achievementPct !== null && s!.achievementPct >= 80 ? 'bg-[#FF9500]' : 'bg-[#DC2626]'}
            />
            <KpiCard icon={CalendarCheck} label="Meetings Booked" value={String(s!.meetings)} color="bg-blue-500" />
            <KpiCard icon={ListTodo} label="Follow-ups Done" value={`${s!.followupsDone} / ${s!.followupsTotal}`} color="bg-purple-500" />
          </div>

          {/* Daily chart */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-4 mb-1">
              <h2 className="text-[14px] font-semibold text-[#1D1D1F]">Daily Calls vs Target</h2>
              <div className="flex items-center gap-3 ml-auto text-[11px] text-[#6E6E73]">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#34C759] inline-block" /> Met target</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF9500] inline-block" /> Near target</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#DC2626] inline-block" /> Below</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#E5E5EA] inline-block" /> Not submitted</span>
              </div>
            </div>
            <p className="text-[12px] text-[#AEAEB2] mb-4">Dashed line = daily target ({s!.callTarget} calls)</p>
            <IndividualChart data={data.dailyChart} target={s!.callTarget} />
          </div>

          {/* Submitted log table */}
          {data.submittedLogs.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-3.5 border-b border-[#F2F2F7]">
                <h2 className="text-[14px] font-semibold text-[#1D1D1F]">Daily Log Detail</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">Date</th>
                      {data.activities.map(a => (
                        <th key={a.id} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{a.name}</th>
                      ))}
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">Target Hit</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Deficit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F2F7]">
                    {data.submittedLogs.map(log => {
                      const callRow = log.activities.find(a => a.name === 'Total Calls')
                      return (
                        <tr key={log.id} className="hover:bg-[#FAFAFA] transition">
                          <td className="px-4 py-3 font-medium text-[#1D1D1F] whitespace-nowrap">{formatShortDate(log.date)}</td>
                          {log.activities.map((a) => (
                            <td key={a.id} className="px-4 py-3 text-[#1D1D1F] font-semibold">{a.value}</td>
                          ))}
                          <td className="px-4 py-3">
                            {s!.callTarget > 0
                              ? log.hitTarget
                                ? <CheckCircle2 size={15} className="text-[#34C759]" />
                                : <XCircle size={15} className="text-[#DC2626]" />
                              : <span className="text-[#AEAEB2]">—</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <span className="text-[12px] text-[#AEAEB2] italic truncate block">{callRow?.deficit_reason || '—'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Meetings in period */}
          {data.meetings.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-3.5 border-b border-[#F2F2F7]">
                <h2 className="text-[14px] font-semibold text-[#1D1D1F]">Meetings Booked ({data.meetings.length})</h2>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                    {['Contact', 'Company', 'Date', 'Lead Source'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F7]">
                  {data.meetings.map(m => (
                    <tr key={m.id} className="hover:bg-[#FAFAFA] transition">
                      <td className="px-4 py-3 font-semibold text-[#1D1D1F] whitespace-nowrap">{m.first_name} {m.last_name}</td>
                      <td className="px-4 py-3 text-[#6E6E73] max-w-[160px] truncate">{m.company_name}</td>
                      <td className="px-4 py-3 text-[#6E6E73] whitespace-nowrap">{formatShortDate(m.meeting_date)}</td>
                      <td className="px-4 py-3">
                        {m.lead_source
                          ? <span className="inline-flex px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px] font-semibold border border-blue-100">{m.lead_source}</span>
                          : <span className="text-[#AEAEB2]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
