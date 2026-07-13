import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MsSocialLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_ms_social')
    .eq('id', user.id)
    .single()

  if (!profile?.has_ms_social) redirect('/login')

  return <>{children}</>
}
