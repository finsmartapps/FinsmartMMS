import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { todayIST } from '@/lib/utils'
import { ManagerMeetingsClient } from '@/components/sales/manager/ManagerMeetingsClient'
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
      <ManagerMeetingsClient upcoming={upcoming} past={past} totalCount={all.length} />
    </div>
  )
}
