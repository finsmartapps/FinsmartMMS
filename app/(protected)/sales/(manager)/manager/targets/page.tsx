'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, Info } from 'lucide-react'

interface Profile { id: string; name: string; email: string }
interface Activity { id: string; name: string; display_order: number }
interface TargetRow { user_id: string; activity_id: string; min_value: number; effective_from: string }

export default function TargetsPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [targets, setTargets] = useState<TargetRow[]>([])
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
    const allActivities: Activity[] = data.activities ?? []
    const totalCallsOnly = allActivities.filter(a => a.name === 'Total Calls')
    setActivities(totalCallsOnly)
    setTargets(data.targets ?? [])

    const d: Record<string, Record<string, string>> = {}
    for (const u of (data.users ?? [])) {
      d[u.id] = {}
      for (const a of totalCallsOnly) {
        const t = (data.targets ?? []).find((x: TargetRow) => x.user_id === u.id && x.activity_id === a.id)
        d[u.id][a.id] = t ? String(t.min_value) : '0'
      }
    }
    setDraft(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function setVal(userId: string, activityId: string, val: string) {
    setDraft(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [activityId]: val },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')

    const rows = []
    for (const userId in draft) {
      for (const activityId in draft[userId]) {
        const val = parseInt(draft[userId][activityId])
        rows.push({ user_id: userId, activity_id: activityId, min_value: isNaN(val) ? 0 : val })
      }
    }

    const res = await fetch('/api/manager/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: rows }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#DC2626]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Daily Targets</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">Set each telecaller's daily Total Calls target</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Targets'}
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5 text-blue-700 text-[13px]">
        <Info size={14} className="mt-0.5 flex-shrink-0" />
        Targets take effect immediately from today. Set to 0 to remove a target.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* User cards */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-12">
          <p className="text-[#AEAEB2]">No telecallers found. Add users first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
              {/* User header */}
              <div className="px-5 py-4 border-b border-[#F2F2F7] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="font-semibold text-[#1D1D1F] text-[15px]">{user.name}</span>
                  <span className="text-[#AEAEB2] text-xs ml-2">{user.email}</span>
                </div>
              </div>

              {/* Target inputs */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {activities.map(activity => (
                    <div key={activity.id}>
                      <label className="block text-[11px] font-medium text-[#6E6E73] mb-1.5">{activity.name}</label>
                      <input
                        type="number"
                        min={0}
                        value={draft[user.id]?.[activity.id] ?? '0'}
                        onChange={e => setVal(user.id, activity.id, e.target.value)}
                        className="w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] font-medium focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]"
                      />
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
