'use client'

import { useEffect, useState, useCallback } from 'react'
import { Lock, Loader2 } from 'lucide-react'

type Role = 'manager' | 'telecaller'

interface Permission {
  role: string
  module: string
  enabled: boolean
}

interface Module {
  key: string
  label: string
  description: string
}

const MODULES: Module[] = [
  { key: 'dashboard',  label: 'Dashboard',     description: 'Overview stats and activity feed' },
  { key: 'contacts',   label: 'Contacts',       description: 'Contact directory and lead management' },
  { key: 'meetings',   label: 'Meetings',       description: 'Schedule and track meetings' },
  { key: 'callbacks',  label: 'Callbacks',      description: 'Follow-up call reminders' },
  { key: 'reports',    label: 'Reports',        description: 'Analytics and performance reports' },
  { key: 'activities', label: 'Activities',     description: 'Activity type configuration' },
  { key: 'targets',    label: 'Targets',        description: 'Sales targets and quotas' },
  { key: 'users',      label: 'Users',          description: 'User account management' },
  { key: 'holidays',   label: 'Holidays',       description: 'Holiday calendar management' },
  { key: 'settings',   label: 'Settings',       description: 'Working hours and system settings' },
  { key: 'linkedin',   label: 'LinkedIn',       description: 'LinkedIn outreach and automation' },
]

function Toggle({ enabled, onChange, saving }: { enabled: boolean; onChange: () => void; saving: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-[#DC2626]' : 'bg-[#D1D1D6]'
      } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium border ${
      type === 'success'
        ? 'bg-white border-green-200 text-green-800'
        : 'bg-white border-red-200 text-red-700'
    }`}>
      <span className={`w-2 h-2 rounded-full ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
      {msg}
    </div>
  )
}

export default function ManagerAccessPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // "role:module"
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/permissions')
    if (res.ok) {
      const data = await res.json()
      setPermissions(data.permissions ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  function isEnabled(role: string, module: string): boolean {
    const perm = permissions.find(p => p.role === role && p.module === module)
    return perm?.enabled ?? false
  }

  async function handleToggle(role: Role, module: string) {
    const key = `${role}:${module}`
    const current = isEnabled(role, module)
    const newValue = !current

    // Optimistic update
    setSaving(key)
    setPermissions(prev => {
      const exists = prev.find(p => p.role === role && p.module === module)
      if (exists) {
        return prev.map(p => p.role === role && p.module === module ? { ...p, enabled: newValue } : p)
      }
      return [...prev, { role, module, enabled: newValue }]
    })

    const res = await fetch('/api/manager/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, module, enabled: newValue }),
    })

    setSaving(null)

    if (res.ok) {
      showToast(`${module.charAt(0).toUpperCase() + module.slice(1)} ${newValue ? 'enabled' : 'disabled'} for ${role}.`)
    } else {
      // Revert on error
      setPermissions(prev =>
        prev.map(p => p.role === role && p.module === module ? { ...p, enabled: current } : p)
      )
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Failed to update permission.', 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#1D1D1F] tracking-tight">Module Access</h1>
        <p className="text-[13px] text-[#AEAEB2] mt-0.5">Control which modules each role can access</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_120px] border-b border-[#F2F2F7]">
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Module</div>
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider text-center">Manager</div>
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider text-center">Telecaller</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#AEAEB2]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading permissions…
          </div>
        ) : (
          <div className="divide-y divide-[#F2F2F7]">
            {MODULES.map(mod => (
              <div key={mod.key} className="grid grid-cols-[1fr_120px_120px] hover:bg-[#F5F5F7] transition-colors">
                {/* Module info */}
                <div className="px-5 py-4">
                  <div className="text-[13px] font-semibold text-[#1D1D1F]">{mod.label}</div>
                  <div className="text-[11px] text-[#AEAEB2] mt-0.5">{mod.description}</div>
                </div>

                {/* Manager toggle */}
                <div className="px-5 py-4 flex items-center justify-center">
                  <Toggle
                    enabled={isEnabled('manager', mod.key)}
                    onChange={() => handleToggle('manager', mod.key)}
                    saving={saving === `manager:${mod.key}`}
                  />
                </div>

                {/* Telecaller toggle */}
                <div className="px-5 py-4 flex items-center justify-center">
                  <Toggle
                    enabled={isEnabled('telecaller', mod.key)}
                    onChange={() => handleToggle('telecaller', mod.key)}
                    saving={saving === `telecaller:${mod.key}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <p className="mt-4 text-[12px] text-[#AEAEB2] flex items-center gap-1.5">
        <Lock size={11} />
        Managers always have full access to all modules and cannot be restricted.
      </p>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
