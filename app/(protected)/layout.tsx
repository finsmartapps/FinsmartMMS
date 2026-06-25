import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, has_sales, has_marketing, has_expenses, has_warehouse, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')

  // Fetch sales module permissions only if user has sales access
  let allowedSalesModules: string[] = []
  if (profile.has_sales && profile.role) {
    const { data: perms } = await supabase
      .from('role_permissions')
      .select('module, enabled')
      .eq('role', profile.role)

    allowedSalesModules = (perms ?? [])
      .filter(p => p.enabled)
      .map(p => p.module)
  }

  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      <Sidebar
        userName={profile.name}
        salesRole={profile.role}
        hasSales={profile.has_sales}
        hasMarketing={profile.has_marketing}
        hasExpenses={profile.has_expenses}
        hasWarehouse={profile.has_warehouse ?? false}
        allowedSalesModules={allowedSalesModules}
      />
      <div className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
