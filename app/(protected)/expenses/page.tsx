import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'finance_manager'

  return <ExpensesClient userName={profile.name} isAdmin={isAdmin} />
}
