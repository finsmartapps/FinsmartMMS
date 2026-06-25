import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_warehouse, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active || !profile?.has_warehouse) redirect('/login')

  return <>{children}</>
}
