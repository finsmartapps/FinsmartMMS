'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Activity, Target, Users, Calendar,
  CalendarCheck, ListTodo, LogOut, Menu, X, Phone, BarChart2,
  Clock, BookUser, ShieldCheck, TrendingUp, ClipboardList,
  Inbox, Settings, Plane, ChevronDown, ChevronRight,
} from 'lucide-react'

interface NavLink {
  href: string
  label: string
  icon: React.ElementType
  module?: string
}

interface NavGroup {
  label: string | null
  links: NavLink[]
}

interface Props {
  userName: string
  salesRole: 'manager' | 'telecaller' | null  // profile.role
  hasSales: boolean
  hasMarketing: boolean
  hasExpenses: boolean
  allowedSalesModules: string[]
}

// ── Sales nav ────────────────────────────────────────────────────────────────

const managerGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/sales/manager',           label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { href: '/sales/manager/contacts',  label: 'Contacts',  icon: BookUser,        module: 'contacts'  },
      { href: '/sales/manager/meetings',  label: 'Meetings',  icon: CalendarCheck,   module: 'meetings'  },
      { href: '/sales/manager/followups', label: 'Callbacks', icon: ListTodo,        module: 'callbacks' },
      { href: '/sales/manager/reports',   label: 'Reports',   icon: BarChart2,       module: 'reports'   },
    ],
  },
  {
    label: 'Settings',
    links: [
      { href: '/sales/manager/activities', label: 'Activities',   icon: Activity,    module: 'activities' },
      { href: '/sales/manager/targets',    label: 'Targets',      icon: Target,      module: 'targets'    },
      { href: '/sales/manager/users',      label: 'Users',        icon: Users,       module: 'users'      },
      { href: '/sales/manager/holidays',   label: 'Holidays',     icon: Calendar,    module: 'holidays'   },
      { href: '/sales/manager/timings',    label: 'Settings',     icon: Clock,       module: 'settings'   },
      { href: '/sales/manager/access',     label: 'Module Access',icon: ShieldCheck, module: 'settings'   },
    ],
  },
]

const telecallerGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/sales/telecaller',           label: 'Daily Log', icon: Phone,        module: 'dashboard' },
      { href: '/sales/telecaller/contacts',  label: 'Contacts',  icon: BookUser,     module: 'contacts'  },
      { href: '/sales/telecaller/meetings',  label: 'Meetings',  icon: CalendarCheck,module: 'meetings'  },
      { href: '/sales/telecaller/followups', label: 'Callbacks', icon: ListTodo,     module: 'callbacks' },
    ],
  },
]

// ── Marketing nav ────────────────────────────────────────────────────────────

const marketingGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/marketing',              label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/marketing/leads',        label: 'Leads',        icon: Inbox           },
      { href: '/marketing/weekly',       label: 'Weekly Review',icon: ClipboardList   },
      { href: '/marketing/kpi-scorecard',label: 'KPI Scorecard',icon: BarChart2       },
      { href: '/marketing/lead-model',   label: 'Lead Model',   icon: TrendingUp      },
      { href: '/marketing/settings',     label: 'Settings',     icon: Settings        },
    ],
  },
]

// ── Expenses nav ─────────────────────────────────────────────────────────────

const expenseGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/expenses', label: 'Travel Expenses', icon: Plane },
    ],
  },
]

function filterByModules(groups: NavGroup[], allowedModules: string[]): NavGroup[] {
  if (!allowedModules.length) return groups
  return groups
    .map(g => ({ ...g, links: g.links.filter(l => !l.module || allowedModules.includes(l.module)) }))
    .filter(g => g.links.length > 0)
}

// ── Module section ────────────────────────────────────────────────────────────

function ModuleSection({
  label,
  color,
  groups,
  pathname,
  onNav,
}: {
  label: string
  color: string
  groups: NavGroup[]
  pathname: string
  onNav?: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  const exactRoots = [
    '/sales/manager', '/sales/telecaller', '/marketing', '/expenses',
    '/sales/manager/access',
  ]

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#AEAEB2] hover:text-[#6E6E73] transition"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
        <span className="flex-1 text-left">{label}</span>
        {expanded
          ? <ChevronDown size={12} />
          : <ChevronRight size={12} />
        }
      </button>

      {expanded && groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
          {group.label && (
            <p className="text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-widest px-3 mb-1">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.links.map(({ href, label: linkLabel, icon: Icon }) => {
              const isActive = exactRoots.includes(href)
                ? pathname === href
                : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNav}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-[#DC2626] text-white'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  )}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  {linkLabel}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({
  userName,
  salesRole,
  hasSales,
  hasMarketing,
  hasExpenses,
  allowedSalesModules,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const salesGroups = salesRole === 'manager'
    ? filterByModules(managerGroups, allowedSalesModules)
    : telecallerGroups

  const homeHref = hasSales
    ? (salesRole === 'manager' ? '/sales/manager' : '/sales/telecaller')
    : hasMarketing ? '/marketing'
    : '/expenses'

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function NavContent({ onNav }: { onNav?: () => void }) {
    return (
      <div className="space-y-1">
        {hasSales && (
          <ModuleSection
            label="Sales"
            color="bg-[#DC2626]"
            groups={salesGroups}
            pathname={pathname}
            onNav={onNav}
          />
        )}
        {hasMarketing && (
          <ModuleSection
            label="Marketing"
            color="bg-[#007AFF]"
            groups={marketingGroups}
            pathname={pathname}
            onNav={onNav}
          />
        )}
        {hasExpenses && (
          <ModuleSection
            label="Expenses"
            color="bg-[#34C759]"
            groups={expenseGroups}
            pathname={pathname}
            onNav={onNav}
          />
        )}
      </div>
    )
  }

  function Footer() {
    return (
      <div className="px-3 pb-4 pt-3 border-t border-[#F2F2F7]">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1D1D1F] truncate leading-tight">{userName}</p>
            <p className="text-[11px] text-[#AEAEB2] capitalize leading-tight">
              {salesRole ?? (hasMarketing ? 'marketing' : 'staff')}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#6E6E73] hover:text-[#DC2626] hover:bg-red-50 transition font-medium"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-[#E5E5EA] flex-shrink-0 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-[#F2F2F7] flex-shrink-0">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] gradient-brand flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">F</span>
            </div>
            <div>
              <div className="text-[15px] font-bold text-[#1D1D1F] tracking-tight leading-none">Finsmart</div>
              <div className="text-[10px] text-[#AEAEB2] tracking-wider uppercase mt-0.5">MMS</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavContent />
        </nav>

        <Footer />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-[#E5E5EA] flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-1.5 text-[#6E6E73] hover:text-[#1D1D1F] rounded-xl hover:bg-[#F5F5F7] transition"
        >
          <Menu size={20} />
        </button>
        <Link href={homeHref} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] gradient-brand flex items-center justify-center">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="text-[15px] font-bold text-[#1D1D1F] tracking-tight">Finsmart MMS</span>
        </Link>
        <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col shadow-2xl md:hidden transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-[#F2F2F7] flex-shrink-0">
          <Link href={homeHref} onClick={() => setOpen(false)} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] gradient-brand flex items-center justify-center">
              <span className="text-white text-sm font-bold">F</span>
            </div>
            <div className="text-[15px] font-bold text-[#1D1D1F]">Finsmart MMS</div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavContent onNav={() => setOpen(false)} />
        </nav>
        <Footer />
      </div>
    </>
  )
}
