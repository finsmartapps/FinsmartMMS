'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ManagerMeetingsTable } from './ManagerMeetingsTable'
import { TIMEZONES, COMPANY_SIZES } from '@/lib/types'
import type { Meeting, Profile, MeetingTimezone } from '@/lib/types'

type MeetingWithProfile = Meeting & { profiles: Pick<Profile, 'name' | 'email'> }

const today = new Date().toISOString().split('T')[0]

const BLANK = {
  first_name: '', last_name: '', company_name: '', company_size: '',
  meeting_date: today, meeting_time: '', timezone: 'IST' as MeetingTimezone,
  lead_source: '', notes: '',
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

export function ManagerMeetingsClient({
  upcoming,
  past,
  totalCount,
}: {
  upcoming: MeetingWithProfile[]
  past: MeetingWithProfile[]
  totalCount: number
}) {
  const router = useRouter()
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState(BLANK)
  const [formError, setFormError] = useState('')
  const [creating, setCreating]   = useState(false)

  function setField<K extends keyof typeof BLANK>(k: K, v: typeof BLANK[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleCreate() {
    setFormError('')
    if (!form.first_name.trim() || !form.last_name.trim() || !form.company_name.trim())
      { setFormError('First name, last name and company are required.'); return }
    if (!form.meeting_date || !form.meeting_time)
      { setFormError('Date and time are required.'); return }

    setCreating(true)
    const res = await fetch('/api/telecaller/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)

    if (!res.ok) { setFormError(data.error ?? 'Failed to save meeting.'); return }
    setShowAdd(false)
    setForm(BLANK)
    router.refresh()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Team Meetings</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">
            {totalCount > 0
              ? `${upcoming.length} upcoming · ${past.length} past`
              : 'All booked meetings across the team'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold gradient-brand-text">{upcoming.length}</p>
            <p className="text-[11px] text-[#AEAEB2]">Upcoming</p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold text-[#1D1D1F]">{totalCount}</p>
            <p className="text-[11px] text-[#AEAEB2]">Total</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setFormError(''); setForm(BLANK) }}
            className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Plus size={15} /> Add Meeting
          </button>
        </div>
      </div>

      {/* List */}
      {totalCount === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-16"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p className="font-semibold text-[#6E6E73]">No meetings logged yet</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">Click Add Meeting to log the first one</p>
        </div>
      ) : (
        <ManagerMeetingsTable upcoming={upcoming} past={past} />
      )}

      {/* Add Meeting Modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <div className="text-[15px] font-semibold text-[#1D1D1F]">Add Meeting</div>
                  <div className="text-[12px] text-[#AEAEB2] mt-0.5">Log a new meeting to the team calendar</div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">First Name *</label>
                    <input className={inputCls} placeholder="John" value={form.first_name}
                      onChange={e => setField('first_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Last Name *</label>
                    <input className={inputCls} placeholder="Smith" value={form.last_name}
                      onChange={e => setField('last_name', e.target.value)} />
                  </div>
                </div>

                {/* Company row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Company *</label>
                    <input className={inputCls} placeholder="Acme Corp" value={form.company_name}
                      onChange={e => setField('company_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Company Size</label>
                    <select className={inputCls} value={form.company_size}
                      onChange={e => setField('company_size', e.target.value)}>
                      <option value="">— Select —</option>
                      {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date / Time / Timezone */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Date *</label>
                    <input type="date" className={inputCls} value={form.meeting_date}
                      onChange={e => setField('meeting_date', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Time *</label>
                    <input type="time" className={inputCls} value={form.meeting_time}
                      onChange={e => setField('meeting_time', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Timezone</label>
                    <select className={inputCls} value={form.timezone}
                      onChange={e => setField('timezone', e.target.value as MeetingTimezone)}>
                      {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.value}</option>)}
                    </select>
                  </div>
                </div>

                {/* Lead source */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Lead Source</label>
                  <input className={inputCls} placeholder="e.g. LinkedIn, Referral, Cold Call" value={form.lead_source}
                    onChange={e => setField('lead_source', e.target.value)} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">Notes</label>
                  <textarea className={`${inputCls} resize-none`} rows={3}
                    placeholder="Agenda, context, or any other notes…"
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)} />
                </div>

                {formError && (
                  <p className="text-[12px] text-[#DC2626] bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowAdd(false)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'Saving…' : 'Add Meeting'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
