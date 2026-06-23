'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { getAchievementColor } from '@/lib/utils'
import type { Activity, DailyLog, DailyLogEntry } from '@/lib/types'

interface FormEntry {
  activityId: string
  value: string
  deficitReason: string
}

interface Props {
  activities: Activity[]
  targetMap: Record<string, number>
  existingLog: DailyLog | null
  existingEntries: DailyLogEntry[]
  userId: string
  activeDate: string
}

const barColor = {
  green:  'bg-[#34C759]',
  yellow: 'bg-[#FF9500]',
  red:    'bg-[#FF3B30]',
  gray:   'bg-[#E5E5EA]',
}

const badgeColor = {
  green:  'bg-green-50 text-green-700 border-green-100',
  yellow: 'bg-orange-50 text-orange-600 border-orange-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  gray:   'bg-[#F5F5F7] text-[#6E6E73] border-[#E5E5EA]',
}

export function DailyLogForm({ activities, targetMap, existingLog, existingEntries, userId, activeDate }: Props) {
  const router = useRouter()
  const isAlreadySubmitted = existingLog?.is_submitted ?? false
  const [isEditing, setIsEditing] = useState(false)

  const [entries, setEntries] = useState<FormEntry[]>(() =>
    activities.map(a => {
      const existing = existingEntries.find(e => e.activity_id === a.id)
      return {
        activityId: a.id,
        value: existing ? String(existing.value) : '',
        deficitReason: existing?.deficit_reason ?? '',
      }
    })
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // When a breakdown activity changes, recompute Total Calls automatically
  function updateEntry(activityId: string, field: 'value' | 'deficitReason', val: string) {
    setEntries(prev => {
      const updated = prev.map(e => e.activityId === activityId ? { ...e, [field]: val } : e)

      // Auto-sum into Total Calls whenever a non-TC activity value changes
      if (field === 'value' && totalCallsActivity && activityId !== totalCallsActivity.id) {
        const sum = updated
          .filter(e => e.activityId !== totalCallsActivity.id)
          .reduce((s, e) => s + (parseInt(e.value) || 0), 0)
        return updated.map(e =>
          e.activityId === totalCallsActivity.id ? { ...e, value: String(sum) } : e
        )
      }
      return updated
    })
  }

  function validate(): string | null {
    for (const entry of entries) {
      const act = activities.find(a => a.id === entry.activityId)
      const isTotalCalls = act?.name === 'Total Calls'
      const target = targetMap[entry.activityId] ?? 0
      const val = parseInt(entry.value)

      // Total Calls is auto-calculated — skip manual validation, treat 0 as valid
      if (isTotalCalls && isAutoCalculated) {
        if (target > 0 && (isNaN(val) ? 0 : val) < target && !entry.deficitReason.trim()) {
          return `Total Calls (${isNaN(val) ? 0 : val}) is below target (${target}). Please explain why.`
        }
        continue
      }

      if (entry.value === '' || isNaN(val) || val < 0) {
        return `Please enter a valid number for "${act?.name}".`
      }
      if (target > 0 && val < target && !entry.deficitReason.trim()) {
        return `Please explain why Total Calls (${val}) is below target (${target}).`
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true)

    const payload = {
      userId,
      logDate: activeDate,
      entries: entries.map(e => ({
        activityId: e.activityId,
        value: parseInt(e.value),
        deficitReason: e.deficitReason.trim() || null,
      })),
    }

    const res = await fetch('/api/telecaller/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    router.refresh()
  }

  // ── Submitted state ───────────────────────────────────────────────
  if ((success || isAlreadySubmitted) && !isEditing) {
    const tcEntry = entries.find(e => {
      const act = activities.find(a => a.id === e.activityId)
      return act?.name === 'Total Calls'
    })
    const tcAct = activities.find(a => a.name === 'Total Calls')
    const tcVal = tcEntry ? parseInt(tcEntry.value) || 0 : 0
    const tcTarget = tcAct ? (targetMap[tcAct.id] ?? 0) : 0
    const tcPct = tcTarget > 0 ? Math.min(100, Math.round((tcVal / tcTarget) * 100)) : 0
    const tcColor = tcTarget > 0 ? getAchievementColor(tcVal, tcTarget) : 'gray'

    return (
      <div className="space-y-4">
        {/* Success banner */}
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-[#34C759] flex-shrink-0" size={22} />
            <div>
              <p className="text-green-800 font-semibold text-[15px]">Log submitted!</p>
              <p className="text-green-600 text-xs mt-0.5">Your manager will review it shortly.</p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="flex-shrink-0 text-[12px] font-semibold text-green-700 border border-green-200 bg-white hover:bg-green-50 px-3 py-1.5 rounded-lg transition"
          >
            Edit
          </button>
        </div>

        {/* Total Calls summary card */}
        {tcAct && (
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-[#6E6E73]">Total Calls</span>
              {tcTarget > 0 && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor[tcColor]}`}>
                  {tcPct}% of target
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#1D1D1F] leading-none">{tcVal}</span>
              {tcTarget > 0 && (
                <span className="text-[#6E6E73] text-sm mb-1">/ {tcTarget}</span>
              )}
            </div>
            {tcTarget > 0 && (
              <div className="h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor[tcColor]}`} style={{ width: `${tcPct}%` }} />
              </div>
            )}
            {tcEntry?.deficitReason && (
              <p className="mt-2 text-xs text-[#FF9500] italic">↳ {tcEntry.deficitReason}</p>
            )}
          </div>
        )}

        {/* Other activities */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="px-5 py-3 border-b border-[#F2F2F7]">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">Activity Summary</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#F2F2F7]">
            {activities.filter(a => a.name !== 'Total Calls').map(activity => {
              const entry = entries.find(e => e.activityId === activity.id)
              const val = entry ? parseInt(entry.value) || 0 : 0
              return (
                <div key={activity.id} className="bg-white px-4 py-3">
                  <p className="text-[11px] font-medium text-[#6E6E73] leading-tight">{activity.name}</p>
                  {activity.description && (
                    <p className="text-[10px] text-[#AEAEB2] mt-0.5 leading-snug">{activity.description}</p>
                  )}
                  <p className="text-xl font-bold text-[#1D1D1F] mt-1">{val}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Form state ────────────────────────────────────────────────────
  const totalCallsActivity = activities.find(a => a.name === 'Total Calls')
  const otherActivities = activities.filter(a => a.name !== 'Total Calls')
  // Total Calls is auto-calculated when there are breakdown activities
  const isAutoCalculated = otherActivities.length > 0

  const tcEntry = totalCallsActivity ? entries.find(e => e.activityId === totalCallsActivity.id) : null
  const tcTarget = totalCallsActivity ? (targetMap[totalCallsActivity.id] ?? 0) : 0
  const tcVal = tcEntry && tcEntry.value !== '' ? parseInt(tcEntry.value) : NaN
  const tcHasVal = !isNaN(tcVal)
  const tcColor = tcHasVal && tcTarget > 0 ? getAchievementColor(tcVal, tcTarget) : 'gray'
  const tcPct = tcHasVal && tcTarget > 0 ? Math.min(100, Math.round((tcVal / tcTarget) * 100)) : 0
  const tcBelowTarget = tcTarget > 0 && tcHasVal && tcVal < tcTarget

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Total Calls — Hero Card ── */}
      {totalCallsActivity && tcEntry && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">Total Calls</p>
              {totalCallsActivity.description && (
                <p className="text-[11px] text-[#AEAEB2] mt-0.5 leading-snug">{totalCallsActivity.description}</p>
              )}
              {tcTarget > 0 && (
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">Daily target: {tcTarget}</p>
              )}
            </div>
            {tcHasVal && tcTarget > 0 && (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badgeColor[tcColor]}`}>
                {tcPct}%
              </span>
            )}
          </div>

          {/* Total Calls value — auto-calculated from breakdown, or manual if no breakdown */}
          {isAutoCalculated ? (
            <div className="w-full border border-[#E5E5EA] rounded-xl px-4 py-3.5 bg-[#F5F5F7] text-center">
              <span className={`text-2xl font-bold ${tcHasVal ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'}`}>
                {tcHasVal ? tcVal : '0'}
              </span>
              <p className="text-[10px] text-[#AEAEB2] mt-0.5 uppercase tracking-wider font-medium">Auto-calculated from breakdown</p>
            </div>
          ) : (
            <input
              type="number"
              min={0}
              value={tcEntry.value}
              onChange={e => updateEntry(totalCallsActivity.id, 'value', e.target.value)}
              placeholder="0"
              className="w-full border border-[#E5E5EA] rounded-xl px-4 py-3.5 text-[#1D1D1F] text-2xl font-bold text-center focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#E5E5EA]"
            />
          )}

          {/* Progress bar */}
          {tcHasVal && tcTarget > 0 && (
            <div className="mt-3 h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor[tcColor]}`}
                style={{ width: `${tcPct}%` }} />
            </div>
          )}
          {tcHasVal && tcTarget > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-[#AEAEB2]">0</span>
              <span className="text-[11px] text-[#AEAEB2]">{tcTarget}</span>
            </div>
          )}

          {/* Deficit reason */}
          {tcBelowTarget && (
            <div className="mt-4 bg-orange-50 rounded-xl p-4">
              <label className="block text-[12px] font-semibold text-orange-700 mb-2">
                Why didn't you meet the target? <span className="text-orange-500">*</span>
              </label>
              <textarea
                value={tcEntry.deficitReason}
                onChange={e => updateEntry(totalCallsActivity.id, 'deficitReason', e.target.value)}
                placeholder="Explain the reason for the shortfall…"
                rows={2}
                className="w-full border border-orange-200 rounded-lg px-3 py-2.5 text-[#1D1D1F] text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 resize-none transition bg-white"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Other Activities — 2-column grid ── */}
      {otherActivities.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="px-5 py-3.5 border-b border-[#F2F2F7]">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">Call Breakdown</p>
            <p className="text-[11px] text-[#AEAEB2] mt-0.5">Enter counts for each activity below</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#F2F2F7]">
            {otherActivities.map(activity => {
              const entry = entries.find(e => e.activityId === activity.id)!
              return (
                <div key={activity.id} className="bg-white px-4 py-3.5">
                  <label className="block text-[11px] font-medium text-[#6E6E73] leading-tight">
                    {activity.name}
                  </label>
                  {activity.description && (
                    <p className="text-[10px] text-[#AEAEB2] mt-0.5 mb-2 leading-snug">{activity.description}</p>
                  )}
                  {!activity.description && <div className="mb-2" />}
                  <input
                    type="number"
                    min={0}
                    value={entry.value}
                    onChange={e => updateEntry(activity.id, 'value', e.target.value)}
                    placeholder="0"
                    className="w-full border border-[#E5E5EA] rounded-lg px-3 py-2 text-[#1D1D1F] text-sm font-medium focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#DC2626] hover:bg-[#C91C1C] active:bg-[#B91C1C] text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 text-[15px]"
      >
        {submitting && <Loader2 size={18} className="animate-spin" />}
        {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Daily Log'}
      </button>

    </form>
  )
}
