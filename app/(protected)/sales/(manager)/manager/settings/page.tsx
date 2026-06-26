'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Loader2, X, Trash2, ShieldCheck, Pencil,
  ToggleLeft, ToggleRight, GripVertical, Activity as ActivityIcon,
  CalendarDays, Save, CheckCircle2, Network, Lock,
  Users2, Target, Settings as SettingsIcon,
} from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { Badge } from '@/components/sales/ui/Badge'
import { formatDisplayDate } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Role = 'manager' | 'telecaller'
type Tab = 'users' | 'activities' | 'targets' | 'holidays' | 'access' | 'general'

interface UserRow {
  id: string; name: string; email: string; role: Role | null
  is_active: boolean
  has_sales: boolean; has_marketing: boolean; has_expenses: boolean; has_warehouse: boolean
  created_at: string
}
interface Activity { id: string; name: string; description: string | null; is_active: boolean; display_order: number }
interface Profile { id: string; name: string; email: string }
interface TargetRow { user_id: string; activity_id: string; min_value: number; effective_from: string }
interface Holiday { id: string; holiday_date: string; label: string }
interface Permission { role: string; module: string; enabled: boolean }
interface AppSettings { linkedin_daily_quota: number }

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'users',      label: 'Users',         icon: Users2       },
  { key: 'activities', label: 'Activities',     icon: ActivityIcon },
  { key: 'targets',    label: 'Targets',        icon: Target       },
  { key: 'holidays',   label: 'Holidays',       icon: CalendarDays },
  { key: 'access',     label: 'Module Access',  icon: ShieldCheck  },
  { key: 'general',    label: 'General',        icon: SettingsIcon },
]

const MODULES_LIST = [
  { key: 'has_sales'     as const, label: 'Sales',     dot: 'bg-[#DC2626]' },
  { key: 'has_marketing' as const, label: 'Marketing', dot: 'bg-[#007AFF]' },
  { key: 'has_expenses'  as const, label: 'Expenses',  dot: 'bg-[#34C759]' },
  { key: 'has_warehouse' as const, label: 'Warehouse', dot: 'bg-[#F97316]' },
]

const PERMISSION_MODULES = [
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

const BLANK_USER_FORM = {
  name: '', email: '', password: '', role: 'telecaller' as Role,
  has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: false,
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

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

function Toggle({ enabled, onChange, saving }: { enabled: boolean; onChange: () => void; saving: boolean }) {
  return (
    <button onClick={onChange} disabled={saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${enabled ? 'bg-[#DC2626]' : 'bg-[#D1D1D6]'} ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch" aria-checked={enabled}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Users tab
// ─────────────────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_USER_FORM)
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editAccess, setEditAccess] = useState({ has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: false, role: 'telecaller' as Role })
  const [savingAccess, setSavingAccess] = useState(false)
  const [accessError, setAccessError] = useState('')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/users')
    if (res.ok) { const d = await res.json(); setUsers(d.users ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function openEditModal(u: UserRow) {
    setEditUser(u)
    setEditAccess({ has_sales: u.has_sales, has_marketing: u.has_marketing, has_expenses: u.has_expenses, has_warehouse: u.has_warehouse, role: u.role ?? 'telecaller' })
    setAccessError('')
  }

  async function handleCreate() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setFormError('All fields are required.'); return }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters.'); return }
    if (!form.has_sales && !form.has_marketing && !form.has_expenses && !form.has_warehouse) { setFormError('Select at least one module.'); return }
    setCreating(true)
    const res = await fetch('/api/manager/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create user.'); return }
    setShowAddModal(false); setForm(BLANK_USER_FORM)
    showToast('User created successfully.'); fetchUsers()
  }

  async function handleSaveAccess() {
    if (!editUser) return
    setAccessError('')
    if (!editAccess.has_sales && !editAccess.has_marketing && !editAccess.has_expenses && !editAccess.has_warehouse) { setAccessError('Select at least one module.'); return }
    setSavingAccess(true)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editUser.id, has_sales: editAccess.has_sales, has_marketing: editAccess.has_marketing, has_expenses: editAccess.has_expenses, has_warehouse: editAccess.has_warehouse, role: editAccess.has_sales ? editAccess.role : null }),
    })
    const data = await res.json()
    setSavingAccess(false)
    if (!res.ok) { setAccessError(data.error ?? 'Failed to save.'); return }
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editAccess, role: editAccess.has_sales ? editAccess.role : null } : u))
    setEditUser(null); showToast('Access updated.')
  }

  async function handleToggleActive(id: string, current: boolean) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !current }) })
    setSavingId(null)
    if (res.ok) { setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x)); showToast(!current ? 'User activated.' : 'User deactivated.') }
    else { const d = await res.json(); showToast(d.error ?? 'Failed to update status.', 'error') }
  }

  async function handleDelete(id: string) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSavingId(null); setConfirmDelete(null)
    if (res.ok) { setUsers(u => u.filter(x => x.id !== id)); showToast('User deleted.') }
    else { const d = await res.json(); showToast(d.error ?? 'Failed to delete user.', 'error') }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <p className="text-[13px] text-[#AEAEB2]">{loading ? '' : `${users.length} ${users.length === 1 ? 'member' : 'members'} total`}</p>
        <button onClick={() => { setShowAddModal(true); setFormError(''); setForm(BLANK_USER_FORM) }}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition">
          <Plus size={15} /> Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#AEAEB2]"><Loader2 size={20} className="animate-spin mr-2" />Loading users…</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-[#AEAEB2] text-[13px]">No users found.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F2F2F7]">
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Name / Email</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Modules</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-[#F5F5F7] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-[13px] font-semibold text-[#1D1D1F]">{u.name}</div>
                    <div className="text-[12px] text-[#AEAEB2]">{u.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role
                      ? <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {u.role === 'manager' && <ShieldCheck size={10} />}{u.role}
                        </span>
                      : <span className="text-[11px] text-[#AEAEB2]">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {MODULES_LIST.filter(m => u[m.key]).map(m => (
                        <span key={m.key} className="flex items-center gap-1 text-[11px] font-medium text-[#6E6E73]">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}
                        </span>
                      ))}
                      {!MODULES_LIST.some(m => u[m.key]) && <span className="text-[11px] text-[#AEAEB2]">None</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium">
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-[#AEAEB2]'}`} />
                      <span className={u.is_active ? 'text-green-700' : 'text-[#AEAEB2]'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {savingId === u.id ? <Loader2 size={14} className="animate-spin text-[#AEAEB2]" /> : (
                        <>
                          <button onClick={() => openEditModal(u)}
                            className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-[#1D1D1F] hover:text-[#1D1D1F] transition">
                            <Pencil size={12} /> Access
                          </button>
                          <button onClick={() => handleToggleActive(u.id, u.is_active)}
                            className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition ${u.is_active ? 'border-[#E5E5EA] text-[#6E6E73] hover:border-[#DC2626] hover:text-[#DC2626]' : 'border-[#E5E5EA] text-[#6E6E73] hover:border-green-500 hover:text-green-700'}`}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {confirmDelete === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[#6E6E73]">Delete?</span>
                              <button onClick={() => handleDelete(u.id)} className="text-[12px] font-semibold text-white bg-[#DC2626] px-2.5 py-1 rounded-lg hover:bg-[#B91C1C] transition">Yes</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-[12px] text-[#6E6E73] px-2 py-1 rounded-lg hover:bg-[#F5F5F7] transition">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#DC2626] hover:bg-red-50 transition"><Trash2 size={14} /></button>
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

      {/* Add User Modal */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div><h2 className="text-[17px] font-bold text-[#1D1D1F]">Add User</h2><p className="text-[12px] text-[#AEAEB2] mt-0.5">Create a new account and assign module access</p></div>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-xl text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition"><X size={18} /></button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{formError}</div>}
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Temporary Password</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES_LIST.map(m => (
                      <label key={m.key} className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7] transition">
                        <input type="checkbox" checked={form[m.key]} onChange={e => setForm(f => ({ ...f, [m.key]: e.target.checked }))} className="w-4 h-4 rounded accent-[#DC2626]" />
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        <span className="text-[13px] font-medium text-[#1D1D1F]">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {form.has_sales && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Sales Role</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className={inputCls}>
                      <option value="telecaller">Telecaller</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {creating && <Loader2 size={13} className="animate-spin" />} Create User
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Access Modal */}
      {editUser && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div><h2 className="text-[17px] font-bold text-[#1D1D1F]">Edit Access</h2><p className="text-[12px] text-[#AEAEB2] mt-0.5 truncate max-w-[220px]">{editUser.name}</p></div>
                <button onClick={() => setEditUser(null)} className="p-1.5 rounded-xl text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition"><X size={18} /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {accessError && <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">{accessError}</div>}
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES_LIST.map(m => (
                      <label key={m.key} className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7] transition">
                        <input type="checkbox" checked={editAccess[m.key]} onChange={e => setEditAccess(a => ({ ...a, [m.key]: e.target.checked }))} className="w-4 h-4 rounded accent-[#DC2626]" />
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        <span className="text-[13px] font-medium text-[#1D1D1F]">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {editAccess.has_sales && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Sales Role</label>
                    <select value={editAccess.role} onChange={e => setEditAccess(a => ({ ...a, role: e.target.value as Role }))} className={inputCls}>
                      <option value="telecaller">Telecaller</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setEditUser(null)} className="px-4 py-2 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition">Cancel</button>
                <button onClick={handleSaveAccess} disabled={savingAccess} className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {savingAccess && <Loader2 size={13} className="animate-spin" />} Save
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

// ─────────────────────────────────────────────────────────────────────────────
// Activities tab
// ─────────────────────────────────────────────────────────────────────────────

function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/activities')
    const data = await res.json()
    setActivities(data.activities ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setEditing(null); setForm({ name: '', description: '' }); setError(''); setModalOpen(true) }
  function openEdit(a: Activity) { setEditing(a); setForm({ name: a.name, description: a.description ?? '' }); setError(''); setModalOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    const method = editing ? 'PATCH' : 'POST'
    const body = editing ? { id: editing.id, name: form.name.trim(), description: form.description.trim() || null } : { name: form.name.trim(), description: form.description.trim() || null }
    const res = await fetch('/api/manager/activities', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setModalOpen(false); await load(); setSaving(false)
  }

  async function toggleActive(a: Activity) {
    await fetch('/api/manager/activities', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, is_active: !a.is_active }) })
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#AEAEB2]">Define which metrics telecallers track daily</p>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          <Plus size={16} /> Add Activity
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-[#DC2626]" /></div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <ActivityIcon size={36} className="mx-auto text-[#E5E5EA] mb-3" />
            <p className="text-[#AEAEB2] text-[13px]">No activities yet. Add your first one.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F2F2F7]">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAFAFA] transition">
                <GripVertical size={15} className="text-[#E5E5EA] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1D1D1F] text-[15px]">{a.name}</span>
                    <Badge color={a.is_active ? 'green' : 'gray'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  {a.description && <p className="text-[12px] text-[#AEAEB2] mt-0.5 truncate">{a.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(a)} className="p-2 text-[#AEAEB2] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition"><Pencil size={14} /></button>
                  <button onClick={() => toggleActive(a)} className="p-2 text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg transition">
                    {a.is_active ? <ToggleRight size={18} className="text-[#34C759]" /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Activity' : 'Add Activity'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Activity Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Total Calls" className={inputCls} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description (optional)" rows={2} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-red-600 text-[13px]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : editing ? 'Update' : 'Add Activity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Targets tab
// ─────────────────────────────────────────────────────────────────────────────

function TargetsTab() {
  const [users, setUsers] = useState<Profile[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/targets')
    const data = await res.json()
    setUsers(data.users ?? [])
    const totalCallsOnly = (data.activities ?? []).filter((a: Activity) => a.name === 'Total Calls')
    setActivities(totalCallsOnly)
    const d: Record<string, Record<string, string>> = {}
    for (const u of (data.users ?? [])) {
      d[u.id] = {}
      for (const a of totalCallsOnly) {
        const t = (data.targets ?? []).find((x: TargetRow) => x.user_id === u.id && x.activity_id === a.id)
        d[u.id][a.id] = t ? String(t.min_value) : '0'
      }
    }
    setDraft(d); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true); setSaved(false); setError('')
    const rows = []
    for (const userId in draft) {
      for (const activityId in draft[userId]) {
        const val = parseInt(draft[userId][activityId])
        rows.push({ user_id: userId, activity_id: activityId, min_value: isNaN(val) ? 0 : val })
      }
    }
    const res = await fetch('/api/manager/targets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets: rows }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 3000); await load()
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#DC2626]" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#AEAEB2]">Set each telecaller's daily Total Calls target</p>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Targets'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5 text-blue-700 text-[13px]">
        Targets take effect immediately from today. Set to 0 to remove a target.
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-12"><p className="text-[#AEAEB2]">No telecallers found. Add users first.</p></div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-4 border-b border-[#F2F2F7] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{user.name.charAt(0).toUpperCase()}</div>
                <div><span className="font-semibold text-[#1D1D1F] text-[15px]">{user.name}</span><span className="text-[#AEAEB2] text-xs ml-2">{user.email}</span></div>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {activities.map(activity => (
                    <div key={activity.id}>
                      <label className="block text-[11px] font-medium text-[#6E6E73] mb-1.5">{activity.name}</label>
                      <input type="number" min={0} value={draft[user.id]?.[activity.id] ?? '0'} onChange={e => setDraft(prev => ({ ...prev, [user.id]: { ...prev[user.id], [activity.id]: e.target.value } }))}
                        className="w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] font-medium focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Holidays tab
// ─────────────────────────────────────────────────────────────────────────────

function HolidaysTab() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ date: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/holidays')
    const data = await res.json()
    setHolidays(data.holidays ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.label.trim()) { setError('Both date and label are required.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/manager/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ holiday_date: form.date, label: form.label.trim() }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to add holiday.'); setSaving(false); return }
    setModalOpen(false); await load(); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this holiday?')) return
    await fetch('/api/manager/holidays', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = holidays.filter(h => h.holiday_date >= today)
  const past = holidays.filter(h => h.holiday_date < today)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#AEAEB2]">Mark non-working days — no log submission required</p>
        <button onClick={() => { setForm({ date: '', label: '' }); setError(''); setModalOpen(true) }}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={22} className="animate-spin text-[#DC2626]" /></div>
      ) : holidays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-12">
          <CalendarDays size={36} className="mx-auto text-[#E5E5EA] mb-3" />
          <p className="text-[#AEAEB2] text-[13px]">No holidays added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-3 border-b border-[#F2F2F7]"><h3 className="font-semibold text-[#1D1D1F] text-[13px]">Upcoming & Current</h3></div>
              <div className="divide-y divide-[#F2F2F7]">
                {upcoming.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0"><CalendarDays size={16} className="text-[#FF9500]" /></div>
                      <div><p className="font-medium text-[#1D1D1F] text-[15px]">{h.label}</p><p className="text-[12px] text-[#AEAEB2]">{formatDisplayDate(h.holiday_date)}</p></div>
                    </div>
                    <button onClick={() => handleDelete(h.id)} className="p-2 text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 rounded-lg transition"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden opacity-60">
              <div className="px-5 py-3 border-b border-[#F2F2F7]"><h3 className="font-semibold text-[#6E6E73] text-[13px]">Past Holidays</h3></div>
              <div className="divide-y divide-[#F2F2F7]">
                {past.slice(0, 5).map(h => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-3">
                    <div><p className="font-medium text-[#6E6E73] text-[13px]">{h.label}</p><p className="text-[11px] text-[#AEAEB2]">{formatDisplayDate(h.holiday_date)}</p></div>
                    <button onClick={() => handleDelete(h.id)} className="p-1.5 text-[#E5E5EA] hover:text-[#FF3B30] rounded-lg transition"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Holiday">
        <form onSubmit={handleAdd} className="space-y-4">
          <div><label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} /></div>
          <div><label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Holiday Name *</label><input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Diwali, Republic Day" className={inputCls} /></div>
          {error && <p className="text-red-600 text-[13px]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Adding…' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Access tab
// ─────────────────────────────────────────────────────────────────────────────

function ModuleAccessTab() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/permissions')
    if (res.ok) { const data = await res.json(); setPermissions(data.permissions ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  function isEnabled(role: string, module: string) {
    return permissions.find(p => p.role === role && p.module === module)?.enabled ?? false
  }

  async function handleToggle(role: Role, module: string) {
    const key = `${role}:${module}`
    const current = isEnabled(role, module)
    setSaving(key)
    setPermissions(prev => {
      const exists = prev.find(p => p.role === role && p.module === module)
      if (exists) return prev.map(p => p.role === role && p.module === module ? { ...p, enabled: !current } : p)
      return [...prev, { role, module, enabled: !current }]
    })
    const res = await fetch('/api/manager/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, module, enabled: !current }) })
    setSaving(null)
    if (res.ok) {
      showToast(`${module.charAt(0).toUpperCase() + module.slice(1)} ${!current ? 'enabled' : 'disabled'} for ${role}.`)
    } else {
      setPermissions(prev => prev.map(p => p.role === role && p.module === module ? { ...p, enabled: current } : p))
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Failed to update permission.', 'error')
    }
  }

  return (
    <div>
      <p className="text-[13px] text-[#AEAEB2] mb-4">Control which Sales modules each role can access</p>
      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px] border-b border-[#F2F2F7]">
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">Module</div>
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider text-center">Manager</div>
          <div className="px-5 py-3.5 text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider text-center">Telecaller</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#AEAEB2]"><Loader2 size={20} className="animate-spin mr-2" />Loading…</div>
        ) : (
          <div className="divide-y divide-[#F2F2F7]">
            {PERMISSION_MODULES.map(mod => (
              <div key={mod.key} className="grid grid-cols-[1fr_120px_120px] hover:bg-[#F5F5F7] transition-colors">
                <div className="px-5 py-4"><div className="text-[13px] font-semibold text-[#1D1D1F]">{mod.label}</div><div className="text-[11px] text-[#AEAEB2] mt-0.5">{mod.description}</div></div>
                <div className="px-5 py-4 flex items-center justify-center"><Toggle enabled={isEnabled('manager', mod.key)} onChange={() => handleToggle('manager', mod.key)} saving={saving === `manager:${mod.key}`} /></div>
                <div className="px-5 py-4 flex items-center justify-center"><Toggle enabled={isEnabled('telecaller', mod.key)} onChange={() => handleToggle('telecaller', mod.key)} saving={saving === `telecaller:${mod.key}`} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-[12px] text-[#AEAEB2] flex items-center gap-1.5"><Lock size={11} />Managers always have full access to all modules and cannot be restricted.</p>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// General tab
// ─────────────────────────────────────────────────────────────────────────────

function GeneralTab() {
  const DEFAULT: AppSettings = { linkedin_daily_quota: 15 }
  const [settings, setSettings] = useState<AppSettings>(DEFAULT)
  const [draft, setDraft] = useState<AppSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/manager/settings').then(r => r.json()).then(d => {
      const s: AppSettings = { linkedin_daily_quota: d.linkedin_daily_quota ?? 15 }
      setSettings(s); setDraft(s); setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch('/api/manager/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedin_daily_quota: String(draft.linkedin_daily_quota) }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setSettings(draft); setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 3000)
  }

  const isDirty = draft.linkedin_daily_quota !== settings.linkedin_daily_quota

  if (loading) return <div className="flex items-center gap-2 py-12 text-[#AEAEB2]"><Loader2 size={18} className="animate-spin" /> Loading settings…</div>

  return (
    <div className="max-w-2xl">
      <p className="text-[13px] text-[#AEAEB2] mb-5">Configure app-wide settings for your team</p>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Network size={13} className="text-blue-500" /></div>
            <p className="text-[14px] font-semibold text-[#1D1D1F]">LinkedIn Daily Quota</p>
          </div>
          <p className="text-[12px] text-[#AEAEB2] mb-4">How many LinkedIn contacts each telecaller receives per day in their queue.</p>
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={100}
              value={draft.linkedin_daily_quota}
              onChange={e => setDraft(d => ({ ...d, linkedin_daily_quota: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) }))}
              className="w-24 border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] text-center font-semibold" />
            <span className="text-[13px] text-[#6E6E73]">contacts / day · max 100</span>
          </div>
        </div>
        {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !isDirty} className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="flex items-center gap-1.5 text-[13px] text-[#34C759] font-medium"><CheckCircle2 size={15} /> Saved</span>}
          {isDirty && !saving && <button type="button" onClick={() => setDraft(settings)} className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition">Discard</button>}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function SalesSettingsPage() {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Settings</h1>
        <p className="text-[#6E6E73] text-sm mt-0.5">Manage your Sales team, access, and configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#F2F2F7] rounded-2xl p-1.5 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap ${
                active
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'users'      && <UsersTab />}
      {tab === 'activities' && <ActivitiesTab />}
      {tab === 'targets'    && <TargetsTab />}
      {tab === 'holidays'   && <HolidaysTab />}
      {tab === 'access'     && <ModuleAccessTab />}
      {tab === 'general'    && <GeneralTab />}
    </div>
  )
}
