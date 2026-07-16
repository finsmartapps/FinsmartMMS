import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MsSocialAnalyticsClient } from '@/components/ms-social/MsSocialAnalyticsClient'

export const revalidate = 0

export default async function MsSocialAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    redirect('/ms-social')
  }

  const { data: postsRaw } = await supabase
    .from('ms_social_posts')
    .select('*, creator:profiles!created_by(name)')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRaw ?? []).map((p: any) => ({
    ...p,
    creator_name: p.creator?.name ?? null,
    creator: undefined,
  }))

  return <MsSocialAnalyticsClient posts={posts} />
}
