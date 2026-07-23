'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarCheck, ListTodo, LogOut, Menu, X,
  Phone, BarChart2, BookUser, ClipboardList,
  Inbox, Settings, ChevronDown, ChevronRight,
  Package, CalendarDays, Truck, FileBarChart2, Users,
  Megaphone, Trophy, LayoutList, Share2, Target, Clock,
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
  salesRole: 'admin' | 'manager' | 'telecaller' | 'warehouse_user' | 'employee' | null
  hasSales: boolean
  hasMarketing: boolean
  hasWarehouse: boolean
  hasAdvocacy: boolean
  hasMsSocial: boolean
  hasAccountPursuit: boolean
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
      { href: '/sales/manager/settings',  label: 'Settings',  icon: Settings,        module: 'settings'  },
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
      { href: '/sales/telecaller/reports',   label: 'Reports',   icon: BarChart2,    module: 'reports'   },
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
    ],
  },
]

// ── Account Pursuit nav ───────────────────────────────────────────────────────

const accountPursuitGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/account-pursuit',          label: 'Follow-ups Due', icon: CalendarCheck },
      { href: '/account-pursuit/accounts',  label: 'Accounts',       icon: Target        },
      { href: '/account-pursuit/awaiting',  label: 'Awaiting',       icon: Clock         },
      { href: '/account-pursuit/import',    label: 'Import',         icon: FileBarChart2 },
    ],
  },
]

// ── Admin nav ─────────────────────────────────────────────────────────────────

const adminGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/admin/users', label: 'Users & Access', icon: Users },
    ],
  },
]

const managerAdminGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/settings', label: 'Users & Access', icon: Users },
    ],
  },
]

// ── Warehouse nav ─────────────────────────────────────────────────────────────

const warehouseGroups: NavGroup[] = [
  {
    label: null,
    links: [
      { href: '/warehouse',           label: 'Dashboard',  icon: LayoutDashboard },
      { href: '/warehouse/inventory', label: 'Inventory',  icon: Package         },
      { href: '/warehouse/events',    label: 'Events',     icon: CalendarDays    },
      { href: '/warehouse/shipments', label: 'Shipments',  icon: Truck           },
      { href: '/warehouse/reports',   label: 'Reports',    icon: FileBarChart2   },
      { href: '/warehouse/settings',  label: 'Settings',   icon: Settings        },
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

const exactRoots = [
  '/sales/manager', '/sales/telecaller', '/marketing', '/warehouse',
  '/sales/manager/settings', '/settings', '/advocacy', '/admin/users', '/ms-social',
  '/account-pursuit',
]

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
  const isCurrentSection = groups.some(g =>
    g.links.some(({ href }) =>
      exactRoots.includes(href) ? pathname === href : pathname.startsWith(href)
    )
  )

  const [expanded, setExpanded] = useState(isCurrentSection)

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

// ── Nav content (must be outside Sidebar to avoid remounting on re-renders) ───

interface NavContentProps {
  hasSales: boolean
  hasMarketing: boolean
  hasWarehouse: boolean
  hasAdvocacy: boolean
  hasMsSocial: boolean
  hasAccountPursuit: boolean
  isManager: boolean
  isAdmin: boolean
  salesGroups: NavGroup[]
  pathname: string
  onNav?: () => void
}

function getMsSocialGroups(isManagerOrAdmin: boolean): NavGroup[] {
  const links: NavLink[] = isManagerOrAdmin
    ? [
        { href: '/ms-social/review',    label: 'Review Posts', icon: LayoutList },
        { href: '/ms-social/analytics', label: 'Analytics',    icon: BarChart2  },
      ]
    : [
        { href: '/ms-social',       label: 'My Posts', icon: Share2    },
        { href: '/ms-social/stats', label: 'My Stats', icon: BarChart2 },
      ]
  return [{ label: null, links }]
}

function getAdvocacyGroups(isAdmin: boolean): NavGroup[] {
  const links: NavLink[] = [
    { href: '/advocacy',             label: 'Mission Feed',    icon: Megaphone  },
    { href: '/advocacy/leaderboard', label: 'Leaderboard',     icon: Trophy     },
  ]
  if (isAdmin) {
    links.push({ href: '/advocacy/admin', label: 'Manage Missions', icon: LayoutList })
  }
  return [{ label: null, links }]
}

function NavContent({
  hasSales, hasMarketing, hasWarehouse, hasAdvocacy, hasMsSocial, hasAccountPursuit,
  isManager, isAdmin, salesGroups, pathname, onNav,
}: NavContentProps) {
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
      {hasWarehouse && (
        <ModuleSection
          label="Warehouse"
          color="bg-[#F97316]"
          groups={warehouseGroups}
          pathname={pathname}
          onNav={onNav}
        />
      )}
      {hasAdvocacy && (
        <ModuleSection
          label="Advocacy"
          color="bg-[#5856D6]"
          groups={getAdvocacyGroups(isManager || hasMarketing)}
          pathname={pathname}
          onNav={onNav}
        />
      )}
      {hasMsSocial && (
        <ModuleSection
          label="MS Social"
          color="bg-pink-500"
          groups={getMsSocialGroups(isManager || isAdmin)}
          pathname={pathname}
          onNav={onNav}
        />
      )}
      {hasAccountPursuit && (
        <ModuleSection
          label="Account Pursuit"
          color="bg-teal-500"
          groups={accountPursuitGroups}
          pathname={pathname}
          onNav={onNav}
        />
      )}
      {(isAdmin || isManager) && (
        <ModuleSection
          label="Admin"
          color="bg-[#6E6E73]"
          groups={isAdmin ? adminGroups : managerAdminGroups}
          pathname={pathname}
          onNav={onNav}
        />
      )}
    </div>
  )
}

// ── Footer (must be outside Sidebar to avoid remounting on re-renders) ────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  telecaller: 'Telecaller',
  warehouse_user: 'Warehouse User',
  employee: 'Employee',
}

interface FooterProps {
  userName: string
  salesRole: 'admin' | 'manager' | 'telecaller' | 'warehouse_user' | 'employee' | null
  hasMarketing: boolean
  loggingOut: boolean
  onLogout: () => void
}

function Footer({ userName, salesRole, hasMarketing, loggingOut, onLogout }: FooterProps) {
  return (
    <div className="px-3 pb-4 pt-3 border-t border-[#F2F2F7]">
      <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
        <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#1D1D1F] truncate leading-tight">{userName}</p>
          <p className="text-[11px] text-[#AEAEB2] leading-tight">
            {salesRole ? (ROLE_LABELS[salesRole] ?? salesRole) : (hasMarketing ? 'Marketing' : 'Staff')}
          </p>
        </div>
      </div>
      <button
        onClick={onLogout}
        disabled={loggingOut}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#6E6E73] hover:text-[#DC2626] hover:bg-red-50 transition font-medium"
      >
        <LogOut size={15} />
        Sign out
      </button>
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function Sidebar({
  userName,
  salesRole,
  hasSales,
  hasMarketing,
  hasWarehouse,
  hasAdvocacy,
  hasMsSocial,
  hasAccountPursuit,
  allowedSalesModules,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const salesGroups = salesRole === 'manager'
    ? filterByModules(managerGroups, allowedSalesModules)
    : salesRole === 'telecaller'
      ? telecallerGroups
      : []

  const homeHref = hasSales && (salesRole === 'manager' || salesRole === 'telecaller')
    ? (salesRole === 'manager' ? '/sales/manager' : '/sales/telecaller')
    : hasMarketing ? '/marketing'
    : hasAdvocacy ? '/advocacy'
    : hasAccountPursuit ? '/account-pursuit'
    : '/warehouse'

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navProps: NavContentProps = {
    hasSales, hasMarketing, hasWarehouse, hasAdvocacy, hasMsSocial, hasAccountPursuit,
    salesGroups, pathname,
    isManager: salesRole === 'manager',
    isAdmin: salesRole === 'admin',
  }
  const footerProps: FooterProps = {
    userName, salesRole, hasMarketing, loggingOut, onLogout: handleLogout,
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
          <NavContent {...navProps} />
        </nav>

        <Footer {...footerProps} />
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
          <NavContent {...navProps} onNav={() => setOpen(false)} />
        </nav>
        <Footer {...footerProps} />
      </div>
    </>
  )
}
