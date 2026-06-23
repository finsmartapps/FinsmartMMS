'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, Loader2, GripVertical, Activity as ActivityIcon } from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { Badge } from '@/components/sales/ui/Badge'

interface Activity {
  id: string
  name: string
  description: string | null
  is_active: boolean
  display_order: number
}

export default function ActivitiesPage() {
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

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setError('')
    setModalOpen(true)
  }

  function openEdit(activity: Activity) {
    setEditing(activity)
    setForm({ name: activity.name, description: activity.description ?? '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')

    const method = editing ? 'PATCH' : 'POST'
    const body = editing
      ? { id: editing.id, name: form.name.trim(), description: form.description.trim() || null }
      : { name: form.name.trim(), description: form.description.trim() || null }

    const res = await fetch('/api/manager/activities', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setModalOpen(false)
    await load()
    setSaving(false)
  }

  async function toggleActive(activity: Activity) {
    await fetch('/api/manager/activities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activity.id, is_active: !activity.is_active }),
    })
    await load()
  }

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Activities</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">Define which metrics telecallers track daily</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          <Plus size={16} /> Add Activity
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-[#DC2626]" />
          </div>
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
                  {a.description && (
                    <p className="text-[12px] text-[#AEAEB2] mt-0.5 truncate">{a.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(a)}
                    className="p-2 text-[#AEAEB2] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => toggleActive(a)}
                    className="p-2 text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg transition"
                    title={a.is_active ? 'Deactivate' : 'Activate'}>
                    {a.is_active
                      ? <ToggleRight size={18} className="text-[#34C759]" />
                      : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Activity' : 'Add Activity'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Activity Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Total Calls"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description (optional)"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
          {error && <p className="text-red-600 text-[13px]">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-[#DC2626] hover:bg-[#C91C1C] text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Saving…' : editing ? 'Update' : 'Add Activity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
