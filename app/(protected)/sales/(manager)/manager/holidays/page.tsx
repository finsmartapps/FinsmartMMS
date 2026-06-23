'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, CalendarDays } from 'lucide-react'
import { Modal } from '@/components/sales/ui/Modal'
import { formatDisplayDate } from '@/lib/utils'

interface Holiday { id: string; holiday_date: string; label: string }

export default function HolidaysPage() {
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

  function openNew() {
    setForm({ date: '', label: '' })
    setError('')
    setModalOpen(true)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.label.trim()) { setError('Both date and label are required.'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/manager/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holiday_date: form.date, label: form.label.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to add holiday.'); setSaving(false); return }
    setModalOpen(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this holiday?')) return
    await fetch('/api/manager/holidays', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = holidays.filter(h => h.holiday_date >= today)
  const past = holidays.filter(h => h.holiday_date < today)

  const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Holidays</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">Mark non-working days — no log submission required</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[#DC2626]" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-12"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <CalendarDays size={36} className="mx-auto text-[#E5E5EA] mb-3" />
          <p className="text-[#AEAEB2] text-[13px]">No holidays added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              <div className="px-5 py-3 border-b border-[#F2F2F7]">
                <h3 className="font-semibold text-[#1D1D1F] text-[13px]">Upcoming & Current</h3>
              </div>
              <div className="divide-y divide-[#F2F2F7]">
                {upcoming.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                        <CalendarDays size={16} className="text-[#FF9500]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#1D1D1F] text-[15px]">{h.label}</p>
                        <p className="text-[12px] text-[#AEAEB2]">{formatDisplayDate(h.holiday_date)}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(h.id)}
                      className="p-2 text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden opacity-60">
              <div className="px-5 py-3 border-b border-[#F2F2F7]">
                <h3 className="font-semibold text-[#6E6E73] text-[13px]">Past Holidays</h3>
              </div>
              <div className="divide-y divide-[#F2F2F7]">
                {past.slice(0, 5).map(h => (
                  <div key={h.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-medium text-[#6E6E73] text-[13px]">{h.label}</p>
                      <p className="text-[11px] text-[#AEAEB2]">{formatDisplayDate(h.holiday_date)}</p>
                    </div>
                    <button onClick={() => handleDelete(h.id)}
                      className="p-1.5 text-[#E5E5EA] hover:text-[#FF3B30] rounded-lg transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Holiday">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Date *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">Holiday Name *</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Diwali, Republic Day"
              className={inputCls} />
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
              {saving ? 'Adding…' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
