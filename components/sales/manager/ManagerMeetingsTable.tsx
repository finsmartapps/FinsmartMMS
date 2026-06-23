'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, RotateCcw, TrendingUp, Clock, ThumbsDown, X, CalendarDays, Clock3, MapPin, Building2, Users, Tag, StickyNote } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import type { Meeting, Profile, MeetingOutcome, MeetingResult } from '@/lib/types'

type MeetingWithProfile = Meeting & { profiles: Pick<Profile, 'name' | 'email'> }

function OutcomeBadge({ outcome }: { outcome: MeetingOutcome | null }) {
  if (!outcome) return <span className="text-[#AEAEB2]">—</span>
  const map = {
    completed:   { icon: CheckCircle2, cls: 'text-[#34C759] bg-green-50 border-green-200' },
    cancelled:   { icon: XCircle,      cls: 'text-[#DC2626] bg-red-50 border-red-200' },
    rescheduled: { icon: RotateCcw,    cls: 'text-[#FF9500] bg-orange-50 border-orange-200' },
  }
  const { icon: Icon, cls } = map[outcome]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      <Icon size={10} /> {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
    </span>
  )
}

function ResultBadge({ result }: { result: MeetingResult | null }) {
  if (!result) return <span className="text-[#AEAEB2]">—</span>
  const map: Record<MeetingResult, { icon: React.ElementType; cls: string; label: string }> = {
    converted_opportunity: { icon: TrendingUp, cls: 'text-[#34C759] bg-green-50 border-green-200',  label: 'Converted to Opportunity' },
    future_followup:       { icon: Clock,      cls: 'text-[#3B82F6] bg-blue-50 border-blue-200',    label: 'Future Follow-up' },
    lost:                  { icon: ThumbsDown, cls: 'text-[#6E6E73] bg-[#F5F5F7] border-[#E5E5EA]', label: 'Lost' },
  }
  const { icon: Icon, cls, label } = map[result]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      <Icon size={10} /> {label}
    </span>
  )
}

function MeetingModal({ meeting, onClose }: { meeting: MeetingWithProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-[#E5E5EA] w-full max-w-md shadow-2xl"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#F2F2F7] flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] tracking-tight">
              {meeting.first_name} {meeting.last_name}
            </h2>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">{meeting.company_name}</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Date / Time */}
          <div className="flex items-start gap-3">
            <CalendarDays size={15} className="text-[#AEAEB2] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">{formatShortDate(meeting.meeting_date)}</p>
              <p className="text-[12px] text-[#6E6E73]">{meeting.meeting_time.slice(0, 5)} {meeting.timezone}</p>
            </div>
          </div>

          {/* Company details */}
          <div className="flex items-center gap-3">
            <Building2 size={15} className="text-[#AEAEB2] flex-shrink-0" />
            <p className="text-[13px] text-[#1D1D1F]">{meeting.company_name}</p>
          </div>

          {meeting.company_size && (
            <div className="flex items-center gap-3">
              <Users size={15} className="text-[#AEAEB2] flex-shrink-0" />
              <p className="text-[13px] text-[#6E6E73]">{meeting.company_size} employees</p>
            </div>
          )}

          {meeting.lead_source && (
            <div className="flex items-center gap-3">
              <Tag size={15} className="text-[#AEAEB2] flex-shrink-0" />
              <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[12px] font-medium border border-blue-100">
                {meeting.lead_source}
              </span>
            </div>
          )}

          {/* Outcome + Result */}
          <div className="flex items-center gap-3">
            <Clock3 size={15} className="text-[#AEAEB2] flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <OutcomeBadge outcome={meeting.outcome} />
              {meeting.result && <ResultBadge result={meeting.result} />}
            </div>
          </div>

          {/* Booked by */}
          <div className="flex items-center gap-3">
            <MapPin size={15} className="text-[#AEAEB2] flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full gradient-brand flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">{meeting.profiles.name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-[13px] text-[#6E6E73]">Booked by {meeting.profiles.name}</span>
            </div>
          </div>

          {/* Notes */}
          {meeting.notes && (
            <div className="flex items-start gap-3">
              <StickyNote size={15} className="text-[#AEAEB2] mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{meeting.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionTable({ rows, isPast }: { rows: MeetingWithProfile[]; isPast?: boolean }) {
  const [selected, setSelected] = useState<MeetingWithProfile | null>(null)
  if (rows.length === 0) return null

  return (
    <>
      <div className={`bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden ${isPast ? 'opacity-75' : ''}`}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        <div className="px-5 py-3.5 border-b border-[#F2F2F7] flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isPast ? 'bg-[#AEAEB2]' : 'bg-[#34C759]'}`} />
          <p className="text-[12px] font-semibold text-[#1D1D1F] uppercase tracking-wider">
            {isPast ? 'Past Meetings' : 'Upcoming Meetings'}
          </p>
          <span className="ml-auto text-[11px] text-[#AEAEB2] font-medium">{rows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-[13px]">
            <thead>
              <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
                {['Name', 'Company', 'Size', 'Lead Source', 'Date & Time', 'Outcome', 'Result', 'Booked By', 'Notes'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#AEAEB2] text-[11px] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {rows.map(m => (
                <tr key={m.id} className="hover:bg-[#FAFAFA] transition">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <button
                      onClick={() => setSelected(m)}
                      className="font-semibold text-[#1D1D1F] hover:text-[#DC2626] hover:underline transition text-left"
                    >
                      {m.first_name} {m.last_name}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-[#6E6E73] max-w-[140px]">
                    <span className="truncate block">{m.company_name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    {m.company_size
                      ? <span className="inline-flex px-2 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] text-[11px] font-medium whitespace-nowrap">{m.company_size}</span>
                      : <span className="text-[#AEAEB2]">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {m.lead_source
                      ? <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[11px] font-medium border border-blue-100 whitespace-nowrap">{m.lead_source}</span>
                      : <span className="text-[#AEAEB2]">—</span>}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <p className="font-medium text-[#1D1D1F]">{formatShortDate(m.meeting_date)}</p>
                    <p className="text-[11px] text-[#AEAEB2] mt-0.5">{m.meeting_time.slice(0, 5)} {m.timezone}</p>
                  </td>
                  <td className="px-4 py-3.5"><OutcomeBadge outcome={m.outcome} /></td>
                  <td className="px-4 py-3.5"><ResultBadge result={m.result ?? null} /></td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[9px] font-bold">{m.profiles.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-[#6E6E73]">{m.profiles.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 max-w-[220px]">
                    {m.notes
                      ? <span className="text-[#6E6E73] text-[12px] italic leading-relaxed">{m.notes}</span>
                      : <span className="text-[#AEAEB2]">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <MeetingModal meeting={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

export function ManagerMeetingsTable({
  upcoming,
  past,
}: {
  upcoming: MeetingWithProfile[]
  past: MeetingWithProfile[]
}) {
  return (
    <div className="space-y-4">
      <SectionTable rows={upcoming} />
      <SectionTable rows={past} isPast />
    </div>
  )
}
