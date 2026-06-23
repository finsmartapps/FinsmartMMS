'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Loader2, Trash2, ShieldCheck } from 'lucide-react'

type Role = 'manager' | 'telecaller'

interface UserRow {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
}

const ROLES: Role[] = ['manager', 'telecaller']

const roleBadge: Record<Role, string> = {
  manager: 'bg-blue-100 text-blue-700',
  telecaller: 'bg-green-100 text-green-700',
}

function Badge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${roleBadge[role]}`}>
      {role === 'manager' && <ShieldCheck size={10} />}
      {role}
    </span>
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

export default function ManagerUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // New user form
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'telecaller' as Role })
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  // Inline edit states
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

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
    setShowModal(false)
    setForm({ name: '', email: '', password: '', role: 'telecaller' })
    showToast('User created successfully.')
    fetchUsers()
  }

  async function handleRoleChange(id: string, newRole: Role) {
    setSavingId(id)
    const res = await fetch('/api/manager/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    })
    setSavingId(null)
    setEditingRole(null)
    if (res.ok) {
      setUsers(u => u.map(x => x.id === id ? { ...x, role: newRole } : x))
      showToast('Role updated.')
    } else {
      const d = await res.json()
      showToast(d.error ?? 'Failed to update role.', 'error')
    }
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
          onClick={() => { setShowModal(true); setFormError('') }}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition"
        >
          <Plus size={15} />
          Invite User
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
                    {editingRole === u.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="text-[12px] border border-[#E5E5EA] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                          defaultValue={u.role}
                          autoFocus
                          onBlur={() => setEditingRole(null)}
                          onChange={e => handleRoleChange(u.id, e.target.value as Role)}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <button onClick={() => setEditingRole(u.id)} title="Click to change role">
                        <Badge role={u.role} />
                      </button>
                    )}
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

      {/* Invite User Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E5E5EA]">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <h2 className="text-[17px] font-bold text-[#1D1D1F]">Invite User</h2>
                  <p className="text-[12px] text-[#AEAEB2] mt-0.5">Create a new account</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
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
                <div>
                  <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                    className="w-full border border-[#E5E5EA] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626] transition"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#F2F2F7]">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition"
                >
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

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
