'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, CheckCircle2, Network } from 'lucide-react'

interface Settings {
  linkedin_daily_quota: number
}

const DEFAULT: Settings = { linkedin_daily_quota: 15 }

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [draft, setDraft] = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/manager/settings')
      .then(r => r.json())
      .then(d => {
        const s: Settings = { linkedin_daily_quota: d.linkedin_daily_quota ?? 15 }
        setSettings(s)
        setDraft(s)
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const res = await fetch('/api/manager/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_daily_quota: String(draft.linkedin_daily_quota) }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }
    setSettings(draft)
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const isDirty = draft.linkedin_daily_quota !== settings.linkedin_daily_quota

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Settings</h1>
        <p className="text-[#6E6E73] text-sm mt-0.5">Configure app-wide settings for your team</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-[#AEAEB2]">
          <Loader2 size={18} className="animate-spin" /> Loading settings…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* LinkedIn Daily Quota */}
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Network size={13} className="text-blue-500" />
              </div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">LinkedIn Daily Quota</p>
            </div>
            <p className="text-[12px] text-[#AEAEB2] mb-4">
              How many LinkedIn contacts each telecaller receives per day in their queue.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={100}
                value={draft.linkedin_daily_quota}
                onChange={e => setDraft(d => ({ ...d, linkedin_daily_quota: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) }))}
                className="w-24 border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] text-center font-semibold"
              />
              <span className="text-[13px] text-[#6E6E73]">contacts / day &nbsp;·&nbsp; max 100</span>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-[13px] text-[#34C759] font-medium">
                <CheckCircle2 size={15} /> Saved
              </span>
            )}
            {isDirty && !saving && (
              <button type="button" onClick={() => setDraft(settings)} className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition">
                Discard
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
