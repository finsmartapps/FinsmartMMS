'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Pencil, Trash2, ShieldCheck, Shield, Star } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────
type Role = 'manager' | 'telecaller' | 'warehouse_user' | 'employee'

const ROLES: { value: Role; label: string; icon: React.ElementType }[] = [
  { value: 'manager',        label: 'Manager',        icon: ShieldCheck },
  { value: 'telecaller',     label: 'Telecaller',     icon: Shield      },
  { value: 'warehouse_user', label: 'Warehouse User', icon: Star        },
  { value: 'employee',       label: 'Employee',       icon: Star        },
]

interface UserRow {
  id: string; name: string; email: string; role: Role | null
  is_active: boolean
  has_sales: boolean; has_marketing: boolean; has_expenses: boolean
  has_warehouse: boolean; has_advocacy: boolean; has_ms_social: boolean
  created_at: string
}

type ModuleKey = 'has_sales' | 'has_marketing' | 'has_expenses' | 'has_warehouse' | 'has_advocacy' | 'has_ms_social'
type TabKey = 'all' | 'sales' | 'marketing' | 'expenses' | 'warehouse' | 'advocacy' | 'ms_social'

const MODULES_LIST: { key: ModuleKey; label: string; dot: string; tab: TabKey }[] = [
  { key: 'has_sales',     label: 'Sales',     dot: 'bg-[#DC2626]', tab: 'sales'     },
  { key: 'has_marketing', label: 'Marketing', dot: 'bg-[#007AFF]', tab: 'marketing' },
  { key: 'has_expenses',  label: 'Expenses',  dot: 'bg-[#34C759]', tab: 'expenses'  },
  { key: 'has_warehouse', label: 'Warehouse', dot: 'bg-[#F97316]', tab: 'warehouse' },
  { key: 'has_advocacy',  label: 'Advocacy',  dot: 'bg-[#5856D6]', tab: 'advocacy'  },
  { key: 'has_ms_social', label: 'MS Social', dot: 'bg-pink-500',  tab: 'ms_social' },
]

const TABS: { key: TabKey; label: string; color: string }[] = [
  { key: 'all',       label: 'All',       color: 'text-[#1D1D1F]'  },
  { key: 'sales',     label: 'Sales',     color: 'text-[#DC2626]'  },
  { key: 'marketing', label: 'Marketing', color: 'text-[#007AFF]'  },
  { key: 'expenses',  label: 'Expenses',  color: 'text-[#34C759]'  },
  { key: 'warehouse', label: 'Warehouse', color: 'text-[#F97316]'  },
  { key: 'advocacy',  label: 'Advocacy',  color: 'text-[#5856D6]'  },
  { key: 'ms_social', label: 'MS Social', color: 'text-pink-600'   },
]

const BLANK_FORM = {
  name: '', email: '', password: '', role: 'telecaller' as Role,
  has_sales: false, has_marketing: false, has_expenses: false,
  has_warehouse: false, has_advocacy: false, has_ms_social: false,
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

// ── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium border ${
      type === 'success' ? 'bg-white border-green-200 text-green-800' : 'bg-white border-red-200 text-red-700'
    }`}>
      <span className={`w-2 h-2 rounded-full ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
      {msg}
    </div>
  )
}

// ── Module checkbox ───────────────────────────────────────────────
function ModuleCheckbox({
  label, dot, checked, onChange, disabled,
}: { label: string; dot: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border transition select-none ${
      disabled
        ? 'border-[#E5E5EA] bg-[#F5F5F7] opacity-40 cursor-not-allowed'
        : 'border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7]'
    }`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="w-4 h-4 accent-[#DC2626] rounded" />
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[13px] font-medium text-[#1D1D1F]">{label}</span>
    </label>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter()
  const [users, setUsers]               = useState<UserRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingId, setSavingId]         = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<TabKey>('all')

  // Add user modal
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState(BLANK_FORM)
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit access modal
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editAccess, setEditAccess] = useState({
    has_sales: false, has_marketing: false, has_expenses: false,
    has_warehouse: false, has_advocacy: false, has_ms_social: false, role: 'telecaller' as Role,
  })
  const [accessError, setAccessError] = useState('')
  const [savingAccess, setSavingAccess] = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/users')
    if (res.status === 403) { router.replace('/admin/users'); return }
    if (res.ok) { const d = await res.json(); setUsers(d.users ?? []) }
    setLoading(false)
  }, [router])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Filtered list for active tab
  const filteredUsers = activeTab === 'all'
    ? users
    : users.filter(u => {
        const m = MODULES_LIST.find(x => x.tab === activeTab)
        return m ? u[m.key] : true
      })

  // Count per tab
  function tabCount(tab: TabKey) {
    if (tab === 'all') return users.length
    const m = MODULES_LIST.find(x => x.tab === tab)
    return m ? users.filter(u => u[m.key]).length : 0
  }

  function openAddModal() {
    const preset = { ...BLANK_FORM }
    if (activeTab !== 'all') {
      const m = MODULES_LIST.find(x => x.tab === activeTab)
      if (m) (preset as Record<string, unknown>)[m.key] = true
    }
    setForm(preset); setFormError(''); setShowAdd(true)
  }

  function openEditModal(u: UserRow) {
    setEditUser(u)
    setEditAccess({
      has_sales: u.has_sales, has_marketing: u.has_marketing,
      has_expenses: u.has_expenses, has_warehouse: u.has_warehouse,
      has_advocacy: u.has_advocacy, has_ms_social: u.has_ms_social, role: u.role ?? 'telecaller',
    })
    setAccessError('')
  }

  async function handleCreate() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setFormError('All fields are required.'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return }
    const anyModule = MODULES_LIST.some(m => form[m.key])
    if (!anyModule) { setFormError('Select at least one module.'); return }
    setCreating(true)
    const res = await fetch('/api/manager/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create user.'); return }
    setShowAdd(false); setForm(BLANK_FORM)
    showToast('User created successfully.'); fetchUsers()
  }

  async function handleSaveAccess() {
    if (!editUser) return
    setAccessError('')
    const anyModule = MODULES_LIST.some(m => editAccess[m.key])
    if (!anyModule) { setAccessError('Select at least one module.'); return }
    setSavingAccess(true)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editUser.id,
        has_sales: editAccess.has_sales, has_marketing: editAccess.has_marketing,
        has_expenses: editAccess.has_expenses, has_warehouse: editAccess.has_warehouse,
        has_advocacy: editAccess.has_advocacy, has_ms_social: editAccess.has_ms_social,
        role: editAccess.role,
      }),
    })
    const data = await res.json()
    setSavingAccess(false)
    if (!res.ok) { setAccessError(data.error ?? 'Failed to save.'); return }
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editAccess } : u))
    setEditUser(null); showToast('Access updated.')
  }

  async function handleToggleActive(id: string, current: boolean) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setSavingId(null)
    if (res.ok) {
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x))
      showToast(!current ? 'User activated.' : 'User deactivated.')
    } else {
      const d = await res.json(); showToast(d.error ?? 'Failed to update.', 'error')
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSavingId(null); setConfirmDelete(null)
    if (res.ok) { setUsers(u => u.filter(x => x.id !== id)); showToast('User deleted.') }
    else { const d = await res.json(); showToast(d.error ?? 'Failed to delete user.', 'error') }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Settings</h1>
        <p className="text-[13px] text-[#AEAEB2] mt-1">Manage user accounts and module access across the app</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
          <div>
            <div className="text-[15px] font-semibold text-[#1D1D1F]">Users</div>
            <div className="text-[12px] text-[#AEAEB2] mt-0.5">
              {loading ? 'Loading…' : `${users.length} ${users.length === 1 ? 'member' : 'members'} total`}
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition"
          >
            <Plus size={15} /> Add User
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-[#F2F2F7] overflow-x-auto">
          {TABS.map(tab => {
            const count = tabCount(tab.key)
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  isActive
                    ? `border-[#DC2626] ${tab.color}`
                    : 'border-transparent text-[#AEAEB2] hover:text-[#6E6E73]'
                }`}
              >
                {tab.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-[#F5F5F7] text-[#AEAEB2]'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#AEAEB2]">
            <Loader2 size={20} className="animate-spin mr-2" />Loading users…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-[#AEAEB2] text-[13px]">
            {activeTab === 'all' ? 'No users yet. Add one to get started.' : `No users with ${TABS.find(t => t.key === activeTab)?.label} access.`}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F2F2F7]">
                {['Name / Email', 'Role', 'Modules', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-[#F5F5F7] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#DC2626] to-[#2454a0] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#1D1D1F]">{u.name}</div>
                        <div className="text-[12px] text-[#AEAEB2]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {u.role ? (() => {
                      const r = ROLES.find(x => x.value === u.role)
                      const Icon = r?.icon ?? ShieldCheck
                      const cls = u.role === 'manager' ? 'bg-blue-50 text-blue-700' : u.role === 'warehouse_user' ? 'bg-sky-50 text-sky-700' : 'bg-green-50 text-green-700'
                      return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}><Icon size={10} />{r?.label ?? u.role}</span>
                    })() : <span className="text-[11px] text-[#AEAEB2]">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {MODULES_LIST.filter(m => u[m.key]).map(m => (
                        <span key={m.key} className="flex items-center gap-1 text-[11px] font-medium text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
                        </span>
                      ))}
                      {!MODULES_LIST.some(m => u[m.key]) && <span className="text-[11px] text-[#AEAEB2]">None</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium w-fit">
                      <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-[#D1D1D6]'}`} />
                      <span className={u.is_active ? 'text-green-700' : 'text-[#AEAEB2]'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {savingId === u.id ? (
                        <Loader2 size={14} className="animate-spin text-[#AEAEB2]" />
                      ) : (
                        <>
                          <button onClick={() => openEditModal(u)}
                            className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-[#1D1D1F] hover:text-[#1D1D1F] transition">
                            <Pencil size={12} /> Access
                          </button>
                          <button onClick={() => handleToggleActive(u.id, u.is_active)}
                            className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition ${
                              u.is_active
                                ? 'border-[#E5E5EA] text-[#6E6E73] hover:border-[#DC2626] hover:text-[#DC2626]'
                                : 'border-[#E5E5EA] text-[#6E6E73] hover:border-green-500 hover:text-green-700'
                            }`}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {confirmDelete === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[#6E6E73]">Delete?</span>
                              <button onClick={() => handleDelete(u.id)}
                                className="text-[12px] font-semibold text-white bg-[#DC2626] px-2.5 py-1 rounded-lg hover:bg-[#B91C1C] transition">Yes</button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="text-[12px] text-[#6E6E73] px-2 py-1 rounded-lg hover:bg-[#F5F5F7] transition">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)}
                              className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#DC2626] hover:bg-red-50 transition">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ADD USER MODAL ── */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <div className="text-[15px] font-semibold text-[#1D1D1F]">Add User</div>
                  <div className="text-[12px] text-[#AEAEB2] mt-0.5">Create a new account and assign module access</div>
                </div>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input className={inputCls} placeholder="Jane Smith" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Email Address</label>
                  <input className={inputCls} type="email" placeholder="jane@company.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Temporary Password</label>
                  <input className={inputCls} type="password" placeholder="Min. 6 characters" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES_LIST.map(m => (
                      <ModuleCheckbox key={m.key} label={m.label} dot={m.dot}
                        checked={form[m.key]}
                        disabled={form.role === 'warehouse_user' && m.key !== 'has_warehouse'}
                        onChange={() => setForm(f => ({ ...f, [m.key]: !f[m.key] }))} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(r => {
                      const Icon = r.icon
                      return (
                        <label key={r.value} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition select-none ${
                          form.role === r.value ? 'border-[#DC2626] bg-red-50 text-[#DC2626]' : 'border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
                        }`}>
                          <input type="radio" className="accent-[#DC2626]" checked={form.role === r.value}
                            onChange={() => setForm(f => ({
                              ...f,
                              role: r.value,
                              ...(r.value === 'warehouse_user' ? { has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: true, has_advocacy: false, has_ms_social: false } : {}),
                            }))} />
                          <Icon size={13} />
                          <span className="text-[12px] font-medium">{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                {formError && <p className="text-[12px] text-[#DC2626] bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowAdd(false)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EDIT ACCESS MODAL ── */}
      {editUser && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="px-6 py-4 border-b border-[#F2F2F7]">
                <div className="text-[15px] font-semibold text-[#1D1D1F]">Edit Access — {editUser.name}</div>
                <div className="text-[12px] text-[#AEAEB2] mt-0.5">{editUser.email}</div>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES_LIST.map(m => (
                      <ModuleCheckbox key={m.key} label={m.label} dot={m.dot}
                        checked={editAccess[m.key]}
                        disabled={editAccess.role === 'warehouse_user' && m.key !== 'has_warehouse'}
                        onChange={() => setEditAccess(a => ({ ...a, [m.key]: !a[m.key] }))} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map(r => {
                      const Icon = r.icon
                      return (
                        <label key={r.value} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition select-none ${
                          editAccess.role === r.value ? 'border-[#DC2626] bg-red-50 text-[#DC2626]' : 'border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
                        }`}>
                          <input type="radio" className="accent-[#DC2626]" checked={editAccess.role === r.value}
                            onChange={() => setEditAccess(a => ({
                              ...a,
                              role: r.value,
                              ...(r.value === 'warehouse_user' ? { has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: true, has_advocacy: false, has_ms_social: false } : {}),
                            }))} />
                          <Icon size={13} />
                          <span className="text-[12px] font-medium">{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                {accessError && <p className="text-[12px] text-[#DC2626] bg-red-50 px-3 py-2 rounded-lg">{accessError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setEditUser(null)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleSaveAccess} disabled={savingAccess}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {savingAccess && <Loader2 size={14} className="animate-spin" />}
                  {savingAccess ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
