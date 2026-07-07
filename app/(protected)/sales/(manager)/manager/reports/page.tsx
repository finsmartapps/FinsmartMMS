'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, CalendarCheck, TrendingUp, CheckSquare, ChevronRight, Loader2, BarChart2, Download, MessageSquare } from 'lucide-react'
import { PeriodSelector, getPeriodDates } from '@/components/sales/manager/PeriodSelector'
import { TeamTrendChart, MultiUserTrendChart, MeetingsTrendChart } from '@/components/sales/manager/ReportCharts'
import type { Period, DateRange } from '@/components/sales/manager/PeriodSelector'
import { formatShortDate } from '@/lib/utils'

interface TelecallerStat {
  id: string
  name: string
  daysSubmitted: number
  workingDays: number
  submissionRate: number
  totalCalls: number
  callTarget: number
  achievementPct: number | null
  daysHitTarget: number
  meetings: number
}

interface DeficitReason {
  telecallerId: string
  telecallerName: string
  date: string
  reason: string
}

interface TeamData {
  period: { from: string; to: string; workingDays: number; useMonthly: boolean }
  summary: { teamTotalCalls: number; teamMeetings: number; teamMeetingsCompleted: number; avgAchievement: number | null; teamSubmissionRate: number }
  telecallers: TelecallerStat[]
  trend: { label: string; calls: number }[]
  trendByUser: Record<string, { label: string; calls: number }[]>
  meetingTrend: { label: string; booked: number; completed: number }[]
  deficitReasons: DeficitReason[]
}

function initPeriod(): { period: Period; from: string; to: string } {
  const range = getPeriodDates('month')
  return { period: 'month', ...range }
}

function exportTeamCSV(data: TeamData) {
  const rows = [
    ['Telecaller', 'Total Calls', 'Call Target/day', 'Achievement %', 'Days Hit Target', 'Days Submitted', 'Submission Rate %', 'Meetings'],
    ...data.telecallers.map(tc => [
      tc.name,
      tc.totalCalls,
      tc.callTarget || '—',
      tc.achievementPct !== null ? tc.achievementPct + '%' : '—',
      tc.callTarget > 0 ? `${tc.daysHitTarget} / ${tc.daysSubmitted}` : '—',
      tc.daysSubmitted,
      tc.submissionRate + '%',
      tc.meetings,
    ]),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `team-report-${data.period.from}-to-${data.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function KpiCard({ icon: Icon, label, value, sub, color, extra }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
  extra?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] px-5 py-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <p className="text-[13px] text-[#6E6E73] font-medium">{label}</p>
      </div>
      <p className="text-[28px] font-bold text-[#1D1D1F] leading-none">{value}</p>
      {sub && <p className="text-[12px] text-[#AEAEB2] mt-1">{sub}</p>}
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  )
}

function AchievementBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[#AEAEB2] text-[13px]">—</span>
  const color = pct >= 100 ? 'text-[#34C759] bg-green-50 border-green-100' : pct >= 80 ? 'text-[#FF9500] bg-orange-50 border-orange-100' : 'text-[#DC2626] bg-red-50 border-red-100'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[12px] font-semibold border ${color}`}>{pct}%</span>
  )
}

function SubmissionBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#34C759' : rate >= 70 ? '#FF9500' : '#DC2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden" style={{ minWidth: 60 }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-medium text-[#6E6E73] w-9 text-right">{rate}%</span>
    </div>
  )
}

export default function ReportsPage() {
  const router = useRouter()
  const [sel, setSel] = useState(initPeriod)
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    const res = await fetch(`/api/manager/reports/team?from=${from}&to=${to}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData(sel.from, sel.to)
  }, [sel.from, sel.to, fetchData])

  function handlePeriodChange(range: DateRange, period: Period) {
    setSelectedUserId(null)
    setSel({ period, ...range })
  }

  const s = data?.summary
  const periodLabel = data ? `${formatShortDate(data.period.from)}${data.period.from !== data.period.to ? ` – ${formatShortDate(data.period.to)}` : ''}` : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Reports</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">{periodLabel || 'Team performance overview'}</p>
        </div>
        <div className="sm:ml-auto flex items-center gap-3">
          {data && (
            <button
              onClick={() => exportTeamCSV(data)}
              className="flex items-center gap-1.5 border border-[#E5E5EA] bg-white text-[#6E6E73] hover:text-[#1D1D1F] text-[13px] font-medium px-3 py-2 rounded-xl transition hover:border-[#D1D1D6]"
            >
              <Download size={13} /> Export CSV
            </button>
          )}
          <PeriodSelector
            value={sel}
            onChange={(range, period) => {
              handlePeriodChange(range, period)
              fetchData(range.from, range.to)
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[#DC2626]" />
        </div>
      ) : !data ? null : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Phone} label="Total Calls" value={s!.teamTotalCalls.toLocaleString()} sub={`across ${data.period.workingDays} working days`} color="bg-[#DC2626]" />
            <KpiCard
              icon={CalendarCheck}
              label="Meetings Booked"
              value={String(s!.teamMeetings)}
              color="bg-blue-500"
              extra={
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#34C759] transition-all"
                      style={{ width: s!.teamMeetings > 0 ? `${Math.round((s!.teamMeetingsCompleted / s!.teamMeetings) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="text-[12px] text-[#6E6E73] whitespace-nowrap">
                    {s!.teamMeetingsCompleted} completed
                    {s!.teamMeetings > 0 && (
                      <span className="ml-1 font-semibold text-[#34C759]">
                        ({Math.round((s!.teamMeetingsCompleted / s!.teamMeetings) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
              }
            />
            <KpiCard icon={TrendingUp} label="Avg Achievement" value={s!.avgAchievement !== null ? `${s!.avgAchievement}%` : '—'} sub="vs daily target" color="bg-[#34C759]" />
            <KpiCard icon={CheckSquare} label="Submission Rate" value={`${s!.teamSubmissionRate}%`} sub="days submitted" color="bg-[#FF9500]" />
          </div>

          {/* Trend chart */}
          {data.trend.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 size={15} className="text-[#AEAEB2]" />
                  <h2 className="text-[14px] font-semibold text-[#1D1D1F]">
                    {data.period.useMonthly ? 'Monthly Call Trend' : 'Daily Call Trend'}
                    {selectedUserId && (
                      <span className="text-[#6E6E73] font-normal">
                        {' '}— {data.telecallers.find(t => t.id === selectedUserId)?.name}
                      </span>
                    )}
                  </h2>
                </div>
                {/* Telecaller filter dropdown — shown when 2+ telecallers */}
                {data.telecallers.length > 1 && (
                  <select
                    value={selectedUserId ?? ''}
                    onChange={e => setSelectedUserId(e.target.value || null)}
                    className="text-[12px] border border-[#E5E5EA] rounded-xl px-3 py-1.5 bg-white text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition cursor-pointer"
                  >
                    <option value="">All Telecallers</option>
                    {data.telecallers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {selectedUserId ? (
                <TeamTrendChart data={data.trendByUser?.[selectedUserId] ?? []} />
              ) : data.telecallers.length > 1 ? (
                <MultiUserTrendChart trendByUser={data.trendByUser ?? {}} telecallers={data.telecallers} />
              ) : (
                <TeamTrendChart data={data.trend} />
              )}
            </div>
          )}

          {/* Meetings trend chart */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-2 mb-4">
              <CalendarCheck size={15} className="text-[#AEAEB2]" />
              <h2 className="text-[14px] font-semibold text-[#1D1D1F]">
                {data.period.useMonthly ? 'Monthly Meeting Trend' : 'Daily Meeting Trend'}
              </h2>
            </div>
            <MeetingsTrendChart data={data.meetingTrend ?? []} />
          </div>

          {/* Telecaller table */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="px-5 py-3.5 border-b border-[#F2F2F7]">
              <h2 className="text-[14px] font-semibold text-[#1D1D1F]">Individual Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                    {['Telecaller', 'Calls', 'Target', 'Achievement', 'Days Hit', 'Submission', 'Meetings', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F7]">
                  {data.telecallers.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-[#AEAEB2]">No telecallers found</td></tr>
                  ) : (
                    data.telecallers.map(tc => (
                      <tr
                        key={tc.id}
                        className="hover:bg-[#FAFAFA] transition cursor-pointer group"
                        onClick={() => router.push(`/sales/manager/reports/${tc.id}?from=${data.period.from}&to=${data.period.to}`)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[10px] font-bold">{tc.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="font-semibold text-[#1D1D1F]">{tc.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#1D1D1F]">{tc.totalCalls.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-[#6E6E73]">{tc.callTarget > 0 ? `${tc.callTarget}/day` : '—'}</td>
                        <td className="px-4 py-3.5"><AchievementBadge pct={tc.achievementPct} /></td>
                        <td className="px-4 py-3.5 text-[#6E6E73]">
                          {tc.callTarget > 0 ? `${tc.daysHitTarget} / ${tc.daysSubmitted}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 min-w-[120px]"><SubmissionBar rate={tc.submissionRate} /></td>
                        <td className="px-4 py-3.5 text-[#6E6E73]">{tc.meetings}</td>
                        <td className="px-4 py-3.5">
                          <ChevronRight size={14} className="text-[#D1D1D6] group-hover:text-[#DC2626] transition" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Deficit Reasons */}
          {data.deficitReasons.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-3.5 border-b border-[#F2F2F7] flex items-center gap-2">
                <MessageSquare size={14} className="text-[#AEAEB2]" />
                <h2 className="text-[14px] font-semibold text-[#1D1D1F]">
                  Deficit Reasons <span className="text-[#AEAEB2] font-normal text-[13px]">({data.deficitReasons.length})</span>
                </h2>
                <p className="text-[12px] text-[#AEAEB2] ml-2">Days telecallers missed their call target and gave a reason</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                      {['Date', 'Telecaller', 'Reason'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F2F7]">
                    {data.deficitReasons.map((dr, i) => (
                      <tr key={i} className="hover:bg-[#FAFAFA] transition">
                        <td className="px-4 py-3 text-[#6E6E73] whitespace-nowrap font-medium">{formatShortDate(dr.date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[9px] font-bold">{dr.telecallerName.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="font-semibold text-[#1D1D1F]">{dr.telecallerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6E6E73] italic max-w-[420px]">{dr.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
