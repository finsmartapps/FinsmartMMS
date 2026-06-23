'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Menu, X, Target, Users, Calendar, Activity, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NavbarProps {
  userName: string
  role: 'manager' | 'telecaller'
}

const managerLinks = [
  { href: '/manager',            label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/manager/activities', label: 'Activities',  icon: Activity },
  { href: '/manager/targets',    label: 'Targets',     icon: Target },
  { href: '/manager/users',      label: 'Users',       icon: Users },
  { href: '/manager/holidays',   label: 'Holidays',    icon: Calendar },
]

export function Navbar({ userName, role }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = role === 'manager' ? managerLinks : []

  return (
    <>
      <nav className="bg-white border-b border-[#E5E5EA] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link href={role === 'manager' ? '/manager' : '/telecaller'} className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-7 h-7 rounded-[8px] gradient-brand flex items-center justify-center">
                <span className="text-white text-xs font-bold">F</span>
              </div>
              <span className="text-[#1D1D1F] font-semibold text-[15px] tracking-tight hidden sm:block">
                Finsmart CRM
              </span>
            </Link>

            {/* Desktop nav links (manager only) */}
            {role === 'manager' && (
              <div className="hidden md:flex items-center gap-0.5">
                {links.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-[#DC2626] text-white'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* User info */}
              <div className="hidden sm:flex items-center gap-2.5 mr-1">
                <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[11px] font-bold">{userName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium text-[#1D1D1F]">{userName}</span>
                  <span className="text-[11px] text-[#AEAEB2] capitalize">{role}</span>
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1.5 text-[#6E6E73] hover:text-[#DC2626] transition text-[13px] px-2.5 py-1.5 rounded-lg hover:bg-red-50 font-medium"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sign out</span>
              </button>

              {/* Mobile hamburger */}
              {role === 'manager' && (
                <button
                  className="md:hidden p-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg transition"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && role === 'manager' && (
          <div className="md:hidden border-t border-[#F2F2F7] bg-white px-4 py-3 space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                    isActive
                      ? 'bg-[#DC2626] text-white'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>
    </>
  )
}
