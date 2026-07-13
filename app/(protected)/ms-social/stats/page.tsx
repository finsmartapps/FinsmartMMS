import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MsSocialStatsClient } from '@/components/ms-social/MsSocialStatsClient'

export const revalidate = 0

export default async function MsSocialStatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) redirect('/login')

  const { data: posts } = await supabase
    .from('ms_social_posts')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  return (
    <MsSocialStatsClient
      posts={posts ?? []}
      userName={profile.name}
    />
  )
}
