import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MissionFeedClient } from '@/components/advocacy/MissionFeedClient'
import type { AdvocacyMission } from '@/lib/types'

export const revalidate = 0

export default async function AdvocacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, has_advocacy')
    .eq('id', user.id)
    .single()

  if (!profile?.has_advocacy) redirect('/')

  const [missionsRes, completionsRes] = await Promise.all([
    supabase
      .from('advocacy_missions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('advocacy_completions')
      .select('mission_id')
      .eq('user_id', user.id),
  ])

  const completedIds = (completionsRes.data ?? []).map(
    (c: { mission_id: string }) => c.mission_id
  )
  const completedSet = new Set(completedIds)
  const missions = (missionsRes.data ?? []) as AdvocacyMission[]
  const totalPoints = missions
    .filter(m => completedSet.has(m.id))
    .reduce((sum, m) => sum + m.points, 0)

  return (
    <MissionFeedClient
      missions={missions}
      completedIds={completedIds}
      totalPoints={totalPoints}
      userName={profile.name}
    />
  )
}
