import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, has_sales, has_marketing, has_warehouse, has_advocacy, has_ms_social, has_account_pursuit, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) redirect('/login')

  // Warehouse-only users (warehouse_user) get a clean full-screen view without the sidebar
  if (profile.role === 'warehouse_user') {
    return <div className="min-h-screen bg-slate-50">{children}</div>
  }

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
        hasWarehouse={profile.has_warehouse ?? false}
        hasAdvocacy={profile.has_advocacy ?? false}
        hasMsSocial={profile.has_ms_social ?? false}
        hasAccountPursuit={profile.has_account_pursuit ?? false}
        allowedSalesModules={allowedSalesModules}
      />
      <div className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
