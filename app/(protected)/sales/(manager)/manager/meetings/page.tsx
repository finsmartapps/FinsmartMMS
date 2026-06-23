import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarCheck } from 'lucide-react'
import { todayIST } from '@/lib/utils'
import { ManagerMeetingsTable } from '@/components/sales/manager/ManagerMeetingsTable'
import type { Meeting, Profile } from '@/lib/types'

export const revalidate = 0

type MeetingWithProfile = Meeting & { profiles: Pick<Profile, 'name' | 'email'> }

export default async function ManagerMeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayIST()

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, profiles(name, email)')
    .order('meeting_date', { ascending: false })
    .order('meeting_time', { ascending: false })

  const all = (meetings as MeetingWithProfile[]) ?? []
  const upcoming = all.filter(m => m.meeting_date >= today)
  const past = all.filter(m => m.meeting_date < today)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Team Meetings</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">
            {all.length > 0 ? `${upcoming.length} upcoming · ${past.length} past` : 'All booked meetings across the team'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold gradient-brand-text">{upcoming.length}</p>
            <p className="text-[11px] text-[#AEAEB2]">Upcoming</p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold text-[#1D1D1F]">{all.length}</p>
            <p className="text-[11px] text-[#AEAEB2]">Total</p>
          </div>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-16"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <CalendarCheck size={36} className="mx-auto text-[#E5E5EA] mb-3" />
          <p className="font-semibold text-[#6E6E73]">No meetings logged yet</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">Telecallers log meetings from their Meetings page</p>
        </div>
      ) : (
        <ManagerMeetingsTable upcoming={upcoming} past={past} />
      )}
    </div>
  )
}
