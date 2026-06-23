import { getAchievementPct, getAchievementColor } from '@/lib/utils'
import type { Profile, DailyLog, Activity } from '@/lib/types'

interface Entry {
  activity: Activity
  value: number
  target: number
  deficitReason: string | null
}

interface Props {
  profile: Profile
  log: DailyLog | null
  entries: Entry[]
  activeDate: string
}

// Status-coded accent colors
const statusBorder = {
  submitted_met:    'border-l-[3px] border-l-[#34C759]',
  submitted_missed: 'border-l-[3px] border-l-[#FF9500]',
  pending:          'border-l-[3px] border-l-[#E5E5EA]',
}

const pctColors = {
  green:  { bar: 'bg-[#34C759]', badge: 'bg-green-50 text-green-700',  val: 'text-[#34C759]' },
  yellow: { bar: 'bg-[#FF9500]', badge: 'bg-orange-50 text-orange-600', val: 'text-[#FF9500]' },
  red:    { bar: 'bg-[#FF3B30]', badge: 'bg-red-50 text-red-600',       val: 'text-[#FF3B30]' },
  gray:   { bar: 'bg-[#E5E5EA]', badge: 'bg-[#F5F5F7] text-[#6E6E73]', val: 'text-[#6E6E73]' },
}

export function TelecallerCard({ profile, log, entries }: Props) {
  const isSubmitted = log?.is_submitted ?? false
  const totalCallsEntry = entries.find(e => e.activity.name === 'Total Calls')
  const hasTCTarget = (totalCallsEntry?.target ?? 0) > 0

  // Determine border status
  let borderClass = statusBorder.pending
  if (isSubmitted) {
    const pct = hasTCTarget
      ? getAchievementPct(totalCallsEntry!.value, totalCallsEntry!.target)
      : 100
    borderClass = pct >= 100 ? statusBorder.submitted_met : statusBorder.submitted_missed
  }

  return (
    <div className={`bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden ${borderClass}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>

      {/* Card header — clean, no dark bg */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#F2F2F7]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-[#1D1D1F] text-[15px] leading-tight">{profile.name}</h3>
            <p className="text-[#AEAEB2] text-xs mt-0.5">{profile.email}</p>
          </div>
        </div>

        {/* Status pill */}
        <div className="flex flex-col items-end gap-1">
          {isSubmitted ? (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-[#F5F5F7] text-[#AEAEB2] text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[#E5E5EA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#AEAEB2] inline-block" />
              Pending
            </span>
          )}
          {isSubmitted && totalCallsEntry && (
            <span className="text-[#6E6E73] text-xs">
              {hasTCTarget
                ? `${totalCallsEntry.value} / ${totalCallsEntry.target} calls`
                : `${totalCallsEntry.value} calls`}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {!isSubmitted ? (
        <div className="px-5 py-7 text-center">
          <div className="w-10 h-10 rounded-full bg-[#F5F5F7] flex items-center justify-center mx-auto mb-3">
            <span className="text-[#AEAEB2] text-lg">—</span>
          </div>
          <p className="text-[13px] font-medium text-[#6E6E73]">No submission yet</p>
          <p className="text-xs text-[#AEAEB2] mt-0.5">Window closes at 5:00 AM</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F2F2F7]">
          {entries.map(entry => {
            const isTotalCalls = entry.activity.name === 'Total Calls'
            const pct = isTotalCalls && entry.target > 0 ? getAchievementPct(entry.value, entry.target) : 0
            const color = isTotalCalls && entry.target > 0 ? getAchievementColor(entry.value, entry.target) : 'gray'
            const style = pctColors[color]

            return (
              <div key={entry.activity.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[13px] ${isTotalCalls ? 'font-semibold text-[#1D1D1F]' : 'text-[#6E6E73]'}`}>
                    {entry.activity.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-bold ${isTotalCalls && entry.target > 0 ? style.val : 'text-[#1D1D1F]'}`}>
                      {entry.value}
                    </span>
                    {isTotalCalls && entry.target > 0 && (
                      <>
                        <span className="text-xs text-[#AEAEB2]">/ {entry.target}</span>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${style.badge}`}>
                          {pct}%
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar — only for Total Calls with target */}
                {isTotalCalls && entry.target > 0 && (
                  <div className="h-1 bg-[#F2F2F7] rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${style.bar}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                )}

                {entry.deficitReason && (
                  <p className="mt-1.5 text-[11px] text-[#FF9500] italic">↳ {entry.deficitReason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
