'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Loader2, X, Trash2, ShieldCheck, Pencil,
  ToggleLeft, ToggleRight, GripVertical, Activity as ActivityIcon,
  CalendarDays, Save, CheckCircle2, Network, Lock,
  Target, Settings as SettingsIcon,
} from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { Badge } from '@/components/sales/ui/Badge'
import { formatDisplayDate } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Role = 'manager' | 'telecaller'
type Tab = 'activities' | 'targets' | 'holidays' | 'access' | 'general'
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
  { key: 'activities', label: 'Activities',     icon: ActivityIcon },
  { key: 'targets',    label: 'Targets',        icon: Target       },
  { key: 'holidays',   label: 'Holidays',       icon: CalendarDays },
  { key: 'access',     label: 'Module Access',  icon: ShieldCheck  },
  { key: 'general',    label: 'General',        icon: SettingsIcon },
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
  const [tab, setTab] = useState<Tab>('activities')

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
      {tab === 'activities' && <ActivitiesTab />}
      {tab === 'targets'    && <TargetsTab />}
      {tab === 'holidays'   && <HolidaysTab />}
      {tab === 'access'     && <ModuleAccessTab />}
      {tab === 'general'    && <GeneralTab />}
    </div>
  )
}
