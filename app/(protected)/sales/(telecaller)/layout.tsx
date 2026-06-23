import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SalesTelecallerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, has_sales')
    .eq('id', user.id)
    .single()

  if (!profile?.has_sales || profile.role !== 'telecaller') redirect('/login')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
      {children}
    </div>
  )
}
