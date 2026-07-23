'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert, Star, Info, AlertTriangle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'manager' | 'telecaller' | 'warehouse_user' | 'employee'

interface UserRow {
  id: string; name: string; email: string; role: Role | null; is_active: boolean
  has_sales: boolean; has_marketing: boolean
  has_warehouse: boolean; has_advocacy: boolean; has_ms_social: boolean; has_account_pursuit: boolean; created_at: string
}

type ModuleKey = 'has_sales' | 'has_marketing' | 'has_warehouse' | 'has_advocacy' | 'has_ms_social' | 'has_account_pursuit'
type TabKey    = 'all' | 'sales' | 'marketing' | 'warehouse' | 'advocacy' | 'ms_social' | 'account_pursuit'

const MODULES: { key: ModuleKey; label: string; dot: string; tab: TabKey }[] = [
  { key: 'has_sales',     label: 'Sales',     dot: 'bg-[#DC2626]', tab: 'sales'     },
  { key: 'has_marketing', label: 'Marketing', dot: 'bg-[#007AFF]', tab: 'marketing' },
  { key: 'has_warehouse', label: 'Warehouse', dot: 'bg-[#F97316]', tab: 'warehouse' },
  { key: 'has_advocacy',  label: 'Advocacy',  dot: 'bg-[#5856D6]', tab: 'advocacy'  },
  { key: 'has_ms_social', label: 'MS Social', dot: 'bg-pink-500',  tab: 'ms_social' },
  { key: 'has_account_pursuit', label: 'Account Pursuit', dot: 'bg-teal-500', tab: 'account_pursuit' },
]

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'sales',     label: 'Sales'     },
  { key: 'marketing', label: 'Marketing' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'advocacy',  label: 'Advocacy'  },
  { key: 'ms_social', label: 'MS Social' },
  { key: 'account_pursuit', label: 'Account Pursuit' },
]

const ROLES: { value: Role; label: string; icon: React.ElementType; badge: string }[] = [
  { value: 'admin',           label: 'Admin',           icon: ShieldAlert,    badge: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { value: 'manager',         label: 'Manager',         icon: ShieldCheck,    badge: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  { value: 'telecaller',      label: 'Telecaller',      icon: Shield,         badge: 'bg-green-50 text-green-700 ring-green-200'    },
  { value: 'warehouse_user',   label: 'Warehouse User',   icon: Star,           badge: 'bg-sky-50 text-sky-700 ring-sky-200'         },
  { value: 'employee',         label: 'Employee',         icon: Star,           badge: 'bg-purple-50 text-purple-700 ring-purple-200'  },
]

const BLANK_FORM = {
  name: '', email: '', password: '',
  role: 'telecaller' as Role,
  has_sales: false, has_marketing: false,
  has_warehouse: false, has_advocacy: false, has_ms_social: false, has_account_pursuit: false,
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

function roleMeta(role: Role | null) {
  return ROLES.find(r => r.value === role) ?? null
}

// ── Sub-components ────────────────────────────────────────────────────────────
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

function RoleBadge({ role }: { role: Role | null }) {
  const meta = roleMeta(role)
  if (!meta) return <span className="text-[11px] text-[#AEAEB2]">—</span>
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${meta.badge}`}>
      <Icon size={10} /> {meta.label}
    </span>
  )
}

function ModuleCheckbox({ label, dot, checked, onChange, disabled }: { label: string; dot: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border transition select-none ${
      disabled
        ? 'border-[#E5E5EA] bg-[#F5F5F7] opacity-40 cursor-not-allowed'
        : 'border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7]'
    }`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="w-4 h-4 accent-violet-600 rounded" />
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[13px] font-medium text-[#1D1D1F]">{label}</span>
    </label>
  )
}

type ModuleState = { has_sales: boolean; has_marketing: boolean; has_warehouse: boolean; has_advocacy: boolean; has_ms_social: boolean; has_account_pursuit: boolean }

function getHints(role: Role, m: ModuleState): { type: 'info' | 'warning'; text: string }[] {
  const hints: { type: 'info' | 'warning'; text: string }[] = []
  const noModules = !m.has_sales && !m.has_marketing && !m.has_warehouse && !m.has_advocacy && !m.has_ms_social && !m.has_account_pursuit

  if (role === 'warehouse_user') {
    hints.push({ type: 'info', text: 'Warehouse Users get a simplified shipment queue view with no sidebar — designed for external partners like GTL Delivers.' })
    if (!m.has_warehouse)
      hints.push({ type: 'warning', text: 'Enable the Warehouse module so this user can log in.' })
    if (m.has_sales || m.has_marketing || m.has_advocacy)
      hints.push({ type: 'warning', text: 'Modules other than Warehouse won\'t be visible to this user — only the shipment queue is accessible for this role.' })
  }

  if (role === 'employee') {
    if (noModules)
      hints.push({ type: 'warning', text: 'No modules selected — this user will have no landing page after login.' })
    if (m.has_sales)
      hints.push({ type: 'info', text: 'Employees with Sales access land on the telecaller view, not the manager dashboard.' })
    if (m.has_warehouse)
      hints.push({ type: 'warning', text: 'Employees with Warehouse access see the full admin UI (inventory, events, shipments). For external partners who only need a shipment queue, use Warehouse User role instead.' })
  }

  if (role === 'telecaller') {
    if (!m.has_sales)
      hints.push({ type: 'warning', text: 'Telecaller without Sales module — this user will have no landing page after login.' })
  }

  if (role === 'manager' || role === 'admin') {
    if (m.has_sales)
      hints.push({ type: 'info', text: 'Manager / Admin with Sales access lands on the manager dashboard with full team controls.' })
    if (noModules)
      hints.push({ type: 'warning', text: 'No modules selected — this user will have no landing page after login.' })
  }

  return hints
}

function FormHints({ role, modules }: { role: Role; modules: ModuleState }) {
  const hints = getHints(role, modules)
  if (hints.length === 0) return null
  return (
    <div className="space-y-2">
      {hints.map((h, i) => (
        <div key={i} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-[12px] ${
          h.type === 'warning'
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-blue-50 border border-blue-100 text-blue-800'
        }`}>
          {h.type === 'warning'
            ? <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            : <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />}
          {h.text}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers]                 = useState<UserRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingId, setSavingId]           = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<TabKey>('all')

  // Add modal
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState(BLANK_FORM)
  const [formError, setFormError] = useState('')
  const [creating, setCreating]   = useState(false)

  // Edit modal
  const [editUser, setEditUser]       = useState<UserRow | null>(null)
  const [editForm, setEditForm]       = useState<{ role: Role; has_sales: boolean; has_marketing: boolean; has_warehouse: boolean; has_advocacy: boolean; has_ms_social: boolean; has_account_pursuit: boolean }>({ role: 'telecaller', has_sales: false, has_marketing: false, has_warehouse: false, has_advocacy: false, has_ms_social: false, has_account_pursuit: false })
  const [editError, setEditError]     = useState('')
  const [savingEdit, setSavingEdit]   = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) { const d = await res.json(); setUsers(d.users ?? []) }
    else showToast('Failed to load users.', 'error')
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = activeTab === 'all'
    ? users
    : users.filter(u => { const m = MODULES.find(x => x.tab === activeTab); return m ? u[m.key] : true })

  function tabCount(tab: TabKey) {
    if (tab === 'all') return users.length
    const m = MODULES.find(x => x.tab === tab)
    return m ? users.filter(u => u[m.key]).length : 0
  }

  function openAdd() {
    const preset = { ...BLANK_FORM }
    if (activeTab !== 'all') { const m = MODULES.find(x => x.tab === activeTab); if (m) (preset as Record<string,unknown>)[m.key] = true }
    setForm(preset); setFormError(''); setShowAdd(true)
  }

  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({ role: u.role ?? 'telecaller', has_sales: u.has_sales, has_marketing: u.has_marketing, has_warehouse: u.has_warehouse, has_advocacy: u.has_advocacy, has_ms_social: u.has_ms_social, has_account_pursuit: u.has_account_pursuit })
    setEditError('')
  }

  async function handleCreate() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setFormError('All fields are required.'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return }
    setCreating(true)
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create user.'); return }
    setShowAdd(false); setForm(BLANK_FORM); showToast('User created.'); fetchUsers()
  }

  async function handleSaveEdit() {
    if (!editUser) return
    setEditError('')
    setSavingEdit(true)
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    setSavingEdit(false)
    if (!res.ok) { setEditError(data.error ?? 'Failed to save.'); return }
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm } : u))
    setEditUser(null); showToast('User updated.')
  }

  async function handleToggleActive(id: string, current: boolean) {
    setSavingId(id)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    setSavingId(null)
    if (res.ok) { setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x)); showToast(!current ? 'User activated.' : 'User deactivated.') }
    else { const d = await res.json(); showToast(d.error ?? 'Failed to update.', 'error') }
  }

  async function handleDelete(id: string) {
    setSavingId(id)
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    setSavingId(null); setConfirmDelete(null)
    if (res.ok) { setUsers(u => u.filter(x => x.id !== id)); showToast('User deleted.') }
    else { const d = await res.json(); showToast(d.error ?? 'Failed to delete.', 'error') }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">Users & Access</h1>
        <p className="text-[13px] text-[#AEAEB2] mt-1">Manage user accounts, roles, and module access</p>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {ROLES.map(r => {
          const Icon = r.icon
          const count = users.filter(u => u.role === r.value).length
          return (
            <div key={r.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ring-1 ${r.badge}`}>
              <Icon size={11} /> {r.label} <span className="opacity-60">· {count}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ring-1 bg-slate-50 text-slate-500 ring-slate-200">
          Total · {users.length}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
          <div>
            <div className="text-[15px] font-semibold text-[#1D1D1F]">All Users</div>
            <div className="text-[12px] text-[#AEAEB2] mt-0.5">
              {loading ? 'Loading…' : `${users.length} ${users.length === 1 ? 'member' : 'members'}`}
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-violet-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-violet-700 transition">
            <Plus size={15} /> Add User
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-[#F2F2F7] overflow-x-auto">
          {TABS.map(tab => {
            const count = tabCount(tab.key)
            const active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  active ? 'border-violet-600 text-violet-700' : 'border-transparent text-[#AEAEB2] hover:text-[#6E6E73]'
                }`}>
                {tab.label}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? 'bg-violet-100 text-violet-700' : 'bg-[#F5F5F7] text-[#AEAEB2]'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#AEAEB2]">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#AEAEB2] text-[13px]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#F2F2F7]">
                  {['Name / Email', 'Role', 'Modules', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider last:text-right whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F2F7]">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-[#F5F5F7] transition-colors">
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#1D1D1F]">{u.name}</div>
                          <div className="text-[12px] text-[#AEAEB2]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-4 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                    {/* Modules */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {MODULES.filter(m => u[m.key]).map(m => (
                          <span key={m.key} className="flex items-center gap-1 text-[11px] font-medium text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full">
                            <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
                          </span>
                        ))}
                        {!MODULES.some(m => u[m.key]) && <span className="text-[11px] text-[#AEAEB2]">—</span>}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium w-fit">
                        <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-[#D1D1D6]'}`} />
                        <span className={u.is_active ? 'text-green-700' : 'text-[#AEAEB2]'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {savingId === u.id ? <Loader2 size={14} className="animate-spin text-[#AEAEB2]" /> : (
                          <>
                            <button onClick={() => openEdit(u)}
                              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-violet-400 hover:text-violet-700 transition">
                              <Pencil size={12} /> Edit
                            </button>
                            <button onClick={() => handleToggleActive(u.id, u.is_active)}
                              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition ${
                                u.is_active
                                  ? 'border-[#E5E5EA] text-[#6E6E73] hover:border-red-300 hover:text-red-600'
                                  : 'border-[#E5E5EA] text-[#6E6E73] hover:border-green-400 hover:text-green-700'
                              }`}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            {confirmDelete === u.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-[#6E6E73]">Delete?</span>
                                <button onClick={() => handleDelete(u.id)} className="text-[12px] font-semibold text-white bg-red-600 px-2.5 py-1 rounded-lg hover:bg-red-700 transition">Yes</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-[12px] text-[#6E6E73] px-2 py-1 rounded-lg hover:bg-[#F5F5F7] transition">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-red-600 hover:bg-red-50 transition">
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
          </div>
        )}
      </div>

      {/* ── ADD USER MODAL ── */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="px-6 py-4 border-b border-[#F2F2F7]">
                <div className="text-[15px] font-semibold text-[#1D1D1F]">Add User</div>
                <div className="text-[12px] text-[#AEAEB2] mt-0.5">Create a new account and assign a role</div>
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
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => {
                      const Icon = r.icon
                      return (
                        <label key={r.value} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition select-none ${
                          form.role === r.value ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
                        }`}>
                          <input type="radio" className="accent-violet-600" checked={form.role === r.value}
                            onChange={() => setForm(f => ({
                              ...f,
                              role: r.value,
                              ...(r.value === 'warehouse_user' ? { has_sales: false, has_marketing: false, has_warehouse: true, has_advocacy: false, has_ms_social: false, has_account_pursuit: false } : {}),
                            }))} />
                          <Icon size={13} />
                          <span className="text-[12px] font-medium">{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES.map(m => (
                      <ModuleCheckbox key={m.key} label={m.label} dot={m.dot}
                        checked={form[m.key]}
                        disabled={form.role === 'warehouse_user' && m.key !== 'has_warehouse'}
                        onChange={() => setForm(f => ({ ...f, [m.key]: !f[m.key] }))} />
                    ))}
                  </div>
                </div>
                <FormHints role={form.role} modules={form} />
                {formError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowAdd(false)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="px-6 py-4 border-b border-[#F2F2F7]">
                <div className="text-[15px] font-semibold text-[#1D1D1F]">Edit — {editUser.name}</div>
                <div className="text-[12px] text-[#AEAEB2] mt-0.5">{editUser.email}</div>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => {
                      const Icon = r.icon
                      return (
                        <label key={r.value} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition select-none ${
                          editForm.role === r.value ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
                        }`}>
                          <input type="radio" className="accent-violet-600" checked={editForm.role === r.value}
                            onChange={() => setEditForm(f => ({
                              ...f,
                              role: r.value,
                              ...(r.value === 'warehouse_user' ? { has_sales: false, has_marketing: false, has_warehouse: true, has_advocacy: false, has_ms_social: false, has_account_pursuit: false } : {}),
                            }))} />
                          <Icon size={13} />
                          <span className="text-[12px] font-medium">{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES.map(m => (
                      <ModuleCheckbox key={m.key} label={m.label} dot={m.dot}
                        checked={editForm[m.key]}
                        disabled={editForm.role === 'warehouse_user' && m.key !== 'has_warehouse'}
                        onChange={() => setEditForm(f => ({ ...f, [m.key]: !f[m.key] }))} />
                    ))}
                  </div>
                </div>
                <FormHints role={editForm.role} modules={editForm} />
                {editError && <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setEditUser(null)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={savingEdit}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 transition">
                  {savingEdit && <Loader2 size={14} className="animate-spin" />}
                  {savingEdit ? 'Saving…' : 'Save Changes'}
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
