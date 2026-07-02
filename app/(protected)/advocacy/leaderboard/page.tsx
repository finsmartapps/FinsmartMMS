import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from '@/components/advocacy/LeaderboardClient'

export const revalidate = 0

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_advocacy')
    .eq('id', user.id)
    .single()

  if (!profile?.has_advocacy) redirect('/')

  const [completionsRes, profilesRes] = await Promise.all([
    supabase
      .from('advocacy_completions')
      .select('user_id, completed_at, advocacy_missions(points)'),
    supabase
      .from('profiles')
      .select('id, name')
      .eq('has_advocacy', true)
      .eq('is_active', true),
  ])

  const now = new Date()
  const weekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  type Bucket = { p: number; c: number }
  const map: Record<string, { name: string; all: Bucket; month: Bucket; week: Bucket }> = {}

  for (const p of profilesRes.data ?? []) {
    map[p.id] = { name: p.name, all: {p:0,c:0}, month: {p:0,c:0}, week: {p:0,c:0} }
  }

  for (const c of completionsRes.data ?? []) {
    if (!map[c.user_id]) continue
    const pts = (c.advocacy_missions as unknown as { points: number } | null)?.points ?? 0
    map[c.user_id].all.p += pts; map[c.user_id].all.c += 1
    if (c.completed_at >= monthAgo) { map[c.user_id].month.p += pts; map[c.user_id].month.c += 1 }
    if (c.completed_at >= weekAgo)  { map[c.user_id].week.p  += pts; map[c.user_id].week.c  += 1 }
  }

  const leaderboard = Object.entries(map).map(([id, { name, all, month, week }]) => ({
    id, name,
    allTimePoints: all.p,   allTimeCount: all.c,
    monthPoints:   month.p, monthCount:   month.c,
    weekPoints:    week.p,  weekCount:    week.c,
  }))

  return <LeaderboardClient leaderboard={leaderboard} currentUserId={user.id} />
}
