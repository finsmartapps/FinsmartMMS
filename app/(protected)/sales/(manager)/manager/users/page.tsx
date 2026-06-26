'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Loader2, Trash2, ShieldCheck, Pencil } from 'lucide-react'

type Role = 'manager' | 'telecaller'

interface UserRow {
  id: string
  name: string
  email: string
  role: Role | null
  is_active: boolean
  has_sales: boolean
  has_marketing: boolean
  has_expenses: boolean
  has_warehouse: boolean
  created_at: string
}

const MODULES = [
  { key: 'has_sales'     as const, label: 'Sales',     dot: 'bg-[#DC2626]' },
  { key: 'has_marketing' as const, label: 'Marketing', dot: 'bg-[#007AFF]' },
  { key: 'has_expenses'  as const, label: 'Expenses',  dot: 'bg-[#34C759]' },
  { key: 'has_warehouse' as const, label: 'Warehouse', dot: 'bg-[#F97316]' },
]

const roleBadge: Record<Role, string> = {
  manager: 'bg-blue-100 text-blue-700',
  telecaller: 'bg-green-100 text-green-700',
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${roleBadge[role]}`}>
      {role === 'manager' && <ShieldCheck size={10} />}
      {role}
    </span>
  )
}

function ModuleDots({ user }: { user: UserRow }) {
  const active = MODULES.filter(m => user[m.key])
  if (!active.length) return <span className="text-[11px] text-[#AEAEB2]">None</span>
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {active.map(m => (
        <span key={m.key} className="flex items-center gap-1 text-[11px] font-medium text-[#6E6E73]">
          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
          {m.label}
        </span>
      ))}
    </div>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-[#AEAEB2]'}`} />
      <span className={active ? 'text-green-700' : 'text-[#AEAEB2]'}>{active ? 'Active' : 'Inactive'}</span>
    </span>
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

const BLANK_FORM = {
  name: '', email: '', password: '',
  role: 'telecaller' as Role,
  has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: false,
}

export default function ManagerUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add user form
  const [form, setForm] = useState(BLANK_FORM)
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit access form
  const [editAccess, setEditAccess] = useState({
    has_sales: false, has_marketing: false, has_expenses: false, has_warehouse: false,
    role: 'telecaller' as Role,
  })
  const [savingAccess, setSavingAccess] = useState(false)
  const [accessError, setAccessError] = useState('')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/manager/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function openEditModal(u: UserRow) {
    setEditUser(u)
    setEditAccess({
      has_sales: u.has_sales,
      has_marketing: u.has_marketing,
      has_expenses: u.has_expenses,
      has_warehouse: u.has_warehouse,
      role: u.role ?? 'telecaller',
    })
    setAccessError('')
  }

  async function handleCreate() {
    setFormError('')
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('All fields are required.')
      return
    }
    if (form.password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (!form.has_sales && !form.has_marketing && !form.has_expenses && !form.has_warehouse) {
      setFormError('Select at least one module.')
      return
    }
    setCreating(true)
    const res = await fetch('/api/manager/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setFormError(data.error ?? 'Failed to create user.')
      return
    }
    setShowAddModal(false)
    setForm(BLANK_FORM)
    showToast('User created successfully.')
    fetchUsers()
  }

  async function handleSaveAccess() {
    if (!editUser) return
    setAccessError('')
    if (!editAccess.has_sales && !editAccess.has_marketing && !editAccess.has_expenses && !editAccess.has_warehouse) {
      setAccessError('Select at least one module.')
      return
    }
    setSavingAccess(true)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editUser.id,
        has_sales: editAccess.has_sales,
        has_marketing: editAccess.has_marketing,
        has_expenses: editAccess.has_expenses,
        has_warehouse: editAccess.has_warehouse,
        role: editAccess.has_sales ? editAccess.role : null,
      }),
    })
    const data = await res.json()
    setSavingAccess(false)
    if (!res.ok) {
      setAccessError(data.error ?? 'Failed to save.')
      return
    }
    setUsers(prev => prev.map(u => u.id === editUser.id
      ? {
          ...u,
          has_sales: editAccess.has_sales,
          has_marketing: editAccess.has_marketing,
          has_expenses: editAccess.has_expenses,
          has_warehouse: editAccess.has_warehouse,
          role: editAccess.has_sales ? editAccess.role : null,
        }
      : u
    ))
    setEditUser(null)
    showToast('Access updated.')
  }

  async function handleToggleActive(id: string, current: boolean) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setSavingId(null)
    if (res.ok) {
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !current } : x))
      showToast(!current ? 'User activated.' : 'User deactivated.')
    } else {
      const d = await res.json()
      showToast(d.error ?? 'Failed to update status.', 'error')
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSavingId(null)
    setConfirmDelete(null)
    if (res.ok) {
      setUsers(u => u.filter(x => x.id !== id))
      showToast('User deleted.')
    } else {
      const d = await res.json()
      showToast(d.error ?? 'Failed to delete user.', 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1D1D1F] tracking-tight">Team Members</h1>
          <p className="text-[13px] text-[#AEAEB2] mt-0.5">
            {loading ? 'Loading...' : `${users.length} ${users.length === 1 ? 'member' : 'members'} total`}
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setFormError(''); setForm(BLANK_FORM) }}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition"
        >
          <Plus size={15} />
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#AEAEB2]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-[#AEAEB2] text-[13px]">No users found.</div>
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
                    {u.role ? <RoleBadge role={u.role} /> : <span className="text-[11px] text-[#AEAEB2]">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <ModuleDots user={u} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusDot active={u.is_active} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {savingId === u.id ? (
                        <Loader2 size={14} className="animate-spin text-[#AEAEB2]" />
                      ) : (
                        <>
                          <button
                            onClick={() => openEditModal(u)}
                            className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:border-[#1D1D1F] hover:text-[#1D1D1F] transition"
                            title="Edit module access"
                          >
                            <Pencil size={12} />
                            Access
                          </button>
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition ${
                              u.is_active
                                ? 'border-[#E5E5EA] text-[#6E6E73] hover:border-[#DC2626] hover:text-[#DC2626]'
                                : 'border-[#E5E5EA] text-[#6E6E73] hover:border-green-500 hover:text-green-700'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {confirmDelete === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-[#6E6E73]">Delete?</span>
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="text-[12px] font-semibold text-white bg-[#DC2626] px-2.5 py-1 rounded-lg hover:bg-[#B91C1C] transition"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-[12px] text-[#6E6E73] px-2 py-1 rounded-lg hover:bg-[#F5F5F7] transition"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(u.id)}
                              className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#DC2626] hover:bg-red-50 transition"
                              title="Delete user"
                            >
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

      {/* ── Add User Modal ─────────────────────────────────────────────────────── */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <h2 className="text-[17px] font-bold text-[#1D1D1F]">Add User</h2>
                  <p className="text-[12px] text-[#AEAEB2] mt-0.5">Create a new account and assign module access</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-xl text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@company.com"
                    className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Temporary Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder:text-[#C7C7CC] focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                  />
                </div>

                {/* Module access */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES.map(m => (
                      <label key={m.key} className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7] transition">
                        <input
                          type="checkbox"
                          checked={form[m.key]}
                          onChange={e => setForm(f => ({ ...f, [m.key]: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#DC2626]"
                        />
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        <span className="text-[13px] font-medium text-[#1D1D1F]">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Role — only when Sales is selected */}
                {form.has_sales && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Sales Role</label>
                    <select
                      value={form.role}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                      className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                    >
                      <option value="telecaller">Telecaller</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-60 transition"
                >
                  {creating && <Loader2 size={13} className="animate-spin" />}
                  Create User
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Access Modal ──────────────────────────────────────────────────── */}
      {editUser && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <h2 className="text-[17px] font-bold text-[#1D1D1F]">Edit Access</h2>
                  <p className="text-[12px] text-[#AEAEB2] mt-0.5 truncate max-w-[220px]">{editUser.name}</p>
                </div>
                <button onClick={() => setEditUser(null)} className="p-1.5 rounded-xl text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {accessError && (
                  <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700">
                    {accessError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-2">Module Access</label>
                  <div className="space-y-2">
                    {MODULES.map(m => (
                      <label key={m.key} className="flex items-center gap-3 p-3 rounded-xl border border-[#E5E5EA] cursor-pointer hover:bg-[#F5F5F7] transition">
                        <input
                          type="checkbox"
                          checked={editAccess[m.key]}
                          onChange={e => setEditAccess(a => ({ ...a, [m.key]: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#DC2626]"
                        />
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        <span className="text-[13px] font-medium text-[#1D1D1F]">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {editAccess.has_sales && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Sales Role</label>
                    <select
                      value={editAccess.role}
                      onChange={e => setEditAccess(a => ({ ...a, role: e.target.value as Role }))}
                      className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                    >
                      <option value="telecaller">Telecaller</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setEditUser(null)} className="px-4 py-2 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition">
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccess}
                  disabled={savingAccess}
                  className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-60 transition"
                >
                  {savingAccess && <Loader2 size={13} className="animate-spin" />}
                  Save
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
