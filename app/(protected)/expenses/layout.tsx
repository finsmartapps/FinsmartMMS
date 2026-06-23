import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('has_expenses')
    .eq('id', user.id)
    .single()

  if (!profile?.has_expenses) redirect('/login')

  return <>{children}</>
}
