'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Phone, CalendarCheck, TrendingUp, CheckSquare, ListTodo,
  Loader2, CheckCircle2, XCircle, Pencil, Trash2, X, Save, AlertTriangle, Download,
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
    achievementPct: number | null; daysSubmitted: number; daysHitTarget: number
    submissionRate: number; meetings: number; meetingsCompleted: number; followupsDone: number; followupsTotal: number
  }
  dailyChart: DailyPoint[]
  submittedLogs: LogRow[]
  meetings: MeetingRow[]
  activities: { id: string; name: string }[]
}

// ── Edit form types ──────────────────────────────────────────────────────────
interface EditEntry { activityId: string; name: string; value: string; deficitReason: string }

function initEditEntries(log: LogRow): EditEntry[] {
  return log.activities.map(a => ({
    activityId: a.id,
    name: a.name,
    value: String(a.value),
    deficitReason: a.deficit_reason ?? '',
  }))
}

// ── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  log, callTarget, onClose, onSaved,
}: {
  log: LogRow
  callTarget: number
  onClose: () => void
  onSaved: (updated: LogRow) => void
}) {
  const [entries, setEntries] = useState<EditEntry[]>(() => initEditEntries(log))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(activityId: string, field: 'value' | 'deficitReason', val: string) {
    setEntries(prev => prev.map(e => e.activityId === activityId ? { ...e, [field]: val } : e))
  }

  async function handleSave() {
    setError('')
    for (const e of entries) {
      const n = parseInt(e.value)
      if (e.value === '' || isNaN(n) || n < 0) {
        setError(`Enter a valid number for "${e.name}".`)
        return
      }
    }
    setSaving(true)
    const res = await fetch(`/api/manager/logs/${log.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: entries.map(e => ({
          activityId: e.activityId,
          value: parseInt(e.value),
          deficitReason: e.deficitReason || null,
        })),
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to save.')
      setSaving(false)
      return
    }
    // Build updated LogRow
    const tcEntry = entries.find(e => e.name === 'Total Calls')
    const calls = tcEntry ? parseInt(tcEntry.value) : log.calls
    const updated: LogRow = {
      ...log,
      calls,
      hitTarget: callTarget > 0 && calls >= callTarget,
      activities: entries.map(e => ({
        id: e.activityId,
        name: e.name,
        value: parseInt(e.value),
        deficit_reason: e.deficitReason || null,
      })),
    }
    onSaved(updated)
  }

  const tcEntry = entries.find(e => e.name === 'Total Calls')
  const tcVal = tcEntry ? parseInt(tcEntry.value) : NaN
  const tcBelowTarget = callTarget > 0 && !isNaN(tcVal) && tcVal < callTarget

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-[#1D1D1F]">Edit Log</h2>
            <p className="text-[12px] text-[#AEAEB2] mt-0.5">{formatShortDate(log.date)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {entries.map(entry => (
            <div key={entry.activityId}>
              <label className="block text-[12px] font-semibold text-[#1D1D1F] mb-1.5">{entry.name}</label>
              <input
                type="number"
                min={0}
                value={entry.value}
                onChange={e => update(entry.activityId, 'value', e.target.value)}
                className="w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]"
              />
              {/* Show deficit reason field for Total Calls when below target */}
              {entry.name === 'Total Calls' && tcBelowTarget && (
                <div className="mt-2 bg-orange-50 rounded-xl p-3">
                  <label className="block text-[11px] font-semibold text-orange-700 mb-1.5">
                    Reason for deficit <span className="text-orange-400">(optional)</span>
                  </label>
                  <textarea
                    value={entry.deficitReason}
                    onChange={e => update(entry.activityId, 'deficitReason', e.target.value)}
                    rows={2}
                    className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-orange-400 resize-none bg-white transition"
                  />
                </div>
              )}
            </div>
          ))}

          {error && (
            <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F2F2F7] flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({
  log, onClose, onDeleted,
}: {
  log: LogRow
  onClose: () => void
  onDeleted: (logId: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/manager/logs/${log.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to delete.')
      setDeleting(false)
      return
    }
    onDeleted(log.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle size={18} className="text-[#DC2626]" />
        </div>
        <h2 className="text-[16px] font-bold text-[#1D1D1F] mb-1">Delete log for {formatShortDate(log.date)}?</h2>
        <p className="text-[13px] text-[#6E6E73] mb-5">
          This will permanently remove this submission and all its activity data. The telecaller will need to re-submit.
        </p>
        {error && (
          <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">{error}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button onClick={onClose} className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function exportUserCSV(data: UserData) {
  const activityHeaders = data.activities.map(a => a.name)
  const rows = [
    ['Date', ...activityHeaders, 'Target Hit', 'Deficit Reason'],
    ...data.submittedLogs.map(log => {
      const callRow = log.activities.find(a => a.name === 'Total Calls')
      return [
        log.date,
        ...data.activities.map(a => {
          const entry = log.activities.find(e => e.id === a.id)
          return entry?.value ?? 0
        }),
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
  a.download = `${data.profile.name.replace(/\s+/g, '-')}-report-${data.period.from}-to-${data.period.to}.csv`
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function UserReportPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = params.userId as string

  const [sel, setSel] = useState(() => initSel(searchParams.get('from'), searchParams.get('to')))
  const [data, setData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit / delete state
  const [editingLog, setEditingLog] = useState<LogRow | null>(null)
  const [deletingLog, setDeletingLog] = useState<LogRow | null>(null)

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    const res = await fetch(`/api/manager/reports/user/${userId}?from=${from}&to=${to}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchData(sel.from, sel.to)
  }, [sel.from, sel.to, fetchData])

  function handlePeriodChange(range: DateRange, period: Period) {
    setSel({ period, ...range })
    fetchData(range.from, range.to)
  }

  // After editing a log: replace it in local state
  function handleSaved(updated: LogRow) {
    setEditingLog(null)
    setData(prev => {
      if (!prev) return prev
      const newLogs = prev.submittedLogs.map(l => l.id === updated.id ? updated : l)
      // Recalculate summary totals
      const callTarget = prev.summary.callTarget
      const totalCalls = newLogs.reduce((s, l) => s + l.calls, 0)
      const daysHitTarget = newLogs.filter(l => l.hitTarget).length
      const daysSubmitted = newLogs.length
      const totalTarget = callTarget * daysSubmitted
      const achievementPct = totalTarget > 0 ? Math.round((totalCalls / totalTarget) * 100) : null
      // Rebuild daily chart
      const dailyChart = prev.dailyChart.map(pt => {
        const log = newLogs.find(l => l.date === pt.date)
        if (!log) return pt
        return { ...pt, calls: log.calls }
      })
      return {
        ...prev,
        submittedLogs: newLogs,
        dailyChart,
        summary: { ...prev.summary, totalCalls, daysHitTarget, achievementPct },
      }
    })
  }

  // After deleting a log: remove from local state
  function handleDeleted(logId: string) {
    setDeletingLog(null)
    setData(prev => {
      if (!prev) return prev
      const newLogs = prev.submittedLogs.filter(l => l.id !== logId)
      const callTarget = prev.summary.callTarget
      const totalCalls = newLogs.reduce((s, l) => s + l.calls, 0)
      const daysHitTarget = newLogs.filter(l => l.hitTarget).length
      const daysSubmitted = newLogs.length
      const totalTarget = callTarget * daysSubmitted
      const achievementPct = totalTarget > 0 ? Math.round((totalCalls / totalTarget) * 100) : null
      const submissionRate = prev.period.workingDays > 0
        ? Math.round((daysSubmitted / prev.period.workingDays) * 100) : 0
      const dailyChart = prev.dailyChart.map(pt =>
        pt.date === prev.submittedLogs.find(l => l.id === logId)?.date
          ? { ...pt, calls: 0, submitted: false }
          : pt
      )
      return {
        ...prev,
        submittedLogs: newLogs,
        dailyChart,
        summary: { ...prev.summary, totalCalls, daysHitTarget, daysSubmitted, achievementPct, submissionRate },
      }
    })
  }

  const s = data?.summary
  const periodLabel = data
    ? `${formatShortDate(data.period.from)}${data.period.from !== data.period.to ? ` – ${formatShortDate(data.period.to)}` : ''}`
    : ''

  return (
    <>
      {/* ── Modals ── */}
      {editingLog && data && (
        <EditModal
          log={editingLog}
          callTarget={data.summary.callTarget}
          onClose={() => setEditingLog(null)}
          onSaved={handleSaved}
        />
      )}
      {deletingLog && (
        <DeleteModal
          log={deletingLog}
          onClose={() => setDeletingLog(null)}
          onDeleted={handleDeleted}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push(`/sales/manager/reports?from=${sel.from}&to=${sel.to}`)}
            className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] hover:text-[#DC2626] transition mb-3 font-medium"
          >
            <ArrowLeft size={14} /> Back to Team Report
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">
                {data?.profile.name ?? '…'}
              </h1>
              <p className="text-[#6E6E73] text-sm mt-0.5">{periodLabel || 'Individual performance'}</p>
            </div>
            <div className="sm:ml-auto flex items-center gap-3">
              {data && (
                <button
                  onClick={() => exportUserCSV(data)}
                  className="flex items-center gap-1.5 border border-[#E5E5EA] bg-white text-[#6E6E73] hover:text-[#1D1D1F] text-[13px] font-medium px-3 py-2 rounded-xl transition hover:border-[#D1D1D6]"
                >
                  <Download size={13} /> Export CSV
                </button>
              )}
              <PeriodSelector value={sel} onChange={handlePeriodChange} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-[#DC2626]" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <KpiCard icon={Phone} label="Total Calls" value={s!.totalCalls.toLocaleString()} sub={`target ${s!.callTarget}/day`} color="bg-[#DC2626]" />
              <KpiCard
                icon={TrendingUp}
                label="Achievement"
                value={s!.achievementPct !== null ? `${s!.achievementPct}%` : '—'}
                sub="vs daily target"
                color={s!.achievementPct !== null && s!.achievementPct >= 100 ? 'bg-[#34C759]' : s!.achievementPct !== null && s!.achievementPct >= 80 ? 'bg-[#FF9500]' : 'bg-[#DC2626]'}
              />
              <KpiCard icon={CalendarCheck} label="Meetings Booked" value={String(s!.meetings)} color="bg-blue-500" />
              <KpiCard
                icon={CheckCircle2}
                label="Meetings Completed"
                value={String(s!.meetingsCompleted)}
                sub={s!.meetings > 0 ? `${Math.round((s!.meetingsCompleted / s!.meetings) * 100)}% success rate` : 'of meetings booked'}
                color="bg-[#34C759]"
              />
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
                  <p className="text-[12px] text-[#AEAEB2] mt-0.5">Hover a row to edit or delete</p>
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
                        <th className="px-4 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F2F7]">
                      {data.submittedLogs.map(log => {
                        const callRow = log.activities.find(a => a.name === 'Total Calls')
                        const deficitReason = callRow?.deficit_reason
                        return (
                          <tr key={log.id} className="group hover:bg-[#FAFAFA] transition">
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
                              <span className="text-[12px] text-[#AEAEB2] italic truncate block">{deficitReason || '—'}</span>
                            </td>
                            {/* Action buttons — visible on row hover */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setEditingLog(log)}
                                  title="Edit"
                                  className="p-1.5 text-[#6E6E73] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeletingLog(log)}
                                  title="Delete"
                                  className="p-1.5 text-[#6E6E73] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
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
    </>
  )
}
