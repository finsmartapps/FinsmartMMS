import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminClient } from '@/components/advocacy/AdminClient'
import type { AdvocacyMission } from '@/lib/types'

export const revalidate = 0

export default async function AdvocacyAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_marketing')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && !profile.has_marketing)) {
    redirect('/advocacy')
  }

  const [missionsRes, completionsRes] = await Promise.all([
    supabase
      .from('advocacy_missions')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('advocacy_completions')
      .select('mission_id'),
  ])

  const completionCounts: Record<string, number> = {}
  for (const c of completionsRes.data ?? []) {
    completionCounts[c.mission_id] = (completionCounts[c.mission_id] ?? 0) + 1
  }

  return (
    <AdminClient
      missions={(missionsRes.data ?? []) as AdvocacyMission[]}
      completionCounts={completionCounts}
    />
  )
}
