import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_sales, has_marketing')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (profile.has_sales) {
    if (profile.role === 'manager') redirect('/sales/manager')
    else redirect('/sales/telecaller')
  }
  if (profile.has_marketing) redirect('/marketing')

  redirect('/login')
}
