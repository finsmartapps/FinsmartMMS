import { CalendarCheck, Target } from 'lucide-react'

interface Props {
  meetingsBooked: number
  meetingTarget: number
  daysLeft: number
  monthName: string
}

export function MeetingTargetBanner({ meetingsBooked, meetingTarget, daysLeft, monthName }: Props) {
  if (meetingTarget <= 0) return null

  const pct = Math.min(Math.round((meetingsBooked / meetingTarget) * 100), 100)
  const remaining = Math.max(meetingTarget - meetingsBooked, 0)

  // Color based on pace: days left / total days in month
  const onTrack = meetingsBooked >= meetingTarget || (daysLeft > 0 && (remaining / daysLeft) <= 1)
  const color = meetingsBooked >= meetingTarget ? 'green' : onTrack ? 'orange' : 'red'

  const bgMap = { green: 'bg-green-50 border-green-200', orange: 'bg-orange-50 border-orange-200', red: 'bg-red-50 border-red-200' }
  const barMap = { green: 'bg-green-500', orange: 'bg-[#FF9500]', red: 'bg-[#DC2626]' }
  const textMap = { green: 'text-green-700', orange: 'text-[#FF9500]', red: 'text-[#DC2626]' }
  const iconMap = { green: 'text-green-500', orange: 'text-[#FF9500]', red: 'text-[#DC2626]' }

  return (
    <div className={`rounded-2xl border px-5 py-4 ${bgMap[color]}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={15} className={iconMap[color]} />
          <p className="text-[13px] font-semibold text-[#1D1D1F]">
            {meetingsBooked >= meetingTarget
              ? `🎉 Meeting target hit! ${meetingsBooked} of ${meetingTarget} booked`
              : `${meetingsBooked} of ${meetingTarget} meetings booked in ${monthName}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Target size={12} className={textMap[color]} />
          <span className={`text-[12px] font-bold ${textMap[color]}`}>{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2.5">
        <div
          className={`h-full rounded-full transition-all ${barMap[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[#6E6E73]">
          {meetingsBooked >= meetingTarget
            ? 'Target complete — keep going!'
            : remaining === 1
            ? `1 more meeting to reach your target`
            : `${remaining} more meetings to reach your target`}
        </p>
        <p className="text-[12px] font-medium text-[#6E6E73]">
          {daysLeft === 0 ? 'Last day of month' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in ${monthName}`}
        </p>
      </div>
    </div>
  )
}
