import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPursuitLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_account_pursuit')
    .eq('id', user.id)
    .single()

  if (!profile?.has_account_pursuit) redirect('/login')

  return <>{children}</>
}
