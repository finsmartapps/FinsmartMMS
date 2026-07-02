'use client'

import { useState } from 'react'
import {
  Plus, Loader2, X, Zap, Users,
  Heart, MessageSquare, Share2, PenLine, Target,
} from 'lucide-react'
import type { AdvocacyMission, MissionType } from '@/lib/types'
import { MISSION_POINTS } from '@/lib/types'

type TypeOption = {
  value: MissionType
  label: string
  icon: React.ElementType
  color: string
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'follow',        label: 'Follow Page',    icon: Target,        color: 'text-[#007AFF]' },
  { value: 'like',          label: 'Like Post',      icon: Heart,         color: 'text-[#FF2D55]' },
  { value: 'comment',       label: 'Comment',        icon: MessageSquare, color: 'text-[#5856D6]' },
  { value: 'share',         label: 'Share / Repost', icon: Share2,        color: 'text-[#34C759]' },
  { value: 'original_post', label: 'Original Post',  icon: PenLine,       color: 'text-[#FF9500]' },
]

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2.5 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

const BLANK = {
  title:       '',
  type:        'share' as MissionType,
  description: '',
  post_copy:   '',
  linkedin_url:'',
  points:      MISSION_POINTS['share'],
  deadline:    '',
}

function MissionRow({
  mission,
  completions,
  onEnd,
  ending,
}: {
  mission: AdvocacyMission
  completions: number
  onEnd: (id: string) => void
  ending: string | null
}) {
  const opt = TYPE_OPTIONS.find(t => t.value === mission.type)
  const Icon = opt?.icon ?? Target

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] px-5 py-4 flex items-center gap-4"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <Icon size={16} className={opt?.color ?? 'text-[#6E6E73]'} />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{mission.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-[#AEAEB2]">{opt?.label}</span>
          <span className="text-[11px] font-bold text-[#FF9500] flex items-center gap-0.5">
            <Zap size={9} /> {mission.points} pts
          </span>
          {mission.deadline && (
            <span className="text-[11px] text-[#AEAEB2]">
              Due {new Date(mission.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-[#6E6E73] flex-shrink-0">
        <Users size={13} />
        <span className="font-semibold text-[#1D1D1F]">{completions}</span> completed
      </div>
      {mission.status === 'active' ? (
        <button
          onClick={() => onEnd(mission.id)}
          disabled={ending === mission.id}
          className="text-[12px] font-medium px-3 py-1.5 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:text-[#DC2626] hover:border-[#DC2626] hover:bg-red-50 transition disabled:opacity-50 flex-shrink-0"
        >
          {ending === mission.id ? 'Ending…' : 'End'}
        </button>
      ) : (
        <span className="text-[11px] font-semibold text-[#AEAEB2] px-2 py-1 bg-[#F5F5F7] rounded-lg flex-shrink-0">
          Ended
        </span>
      )}
    </div>
  )
}

export function AdminClient({
  missions: initialMissions,
  completionCounts,
}: {
  missions: AdvocacyMission[]
  completionCounts: Record<string, number>
}) {
  const [missions, setMissions]     = useState(initialMissions)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState(BLANK)
  const [creating, setCreating]     = useState(false)
  const [formError, setFormError]   = useState('')
  const [ending, setEnding]         = useState<string | null>(null)
  const [enabling, setEnabling]     = useState(false)
  const [enabledAll, setEnabledAll] = useState(false)

  function setField(k: keyof typeof BLANK, v: string | number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function selectType(t: MissionType) {
    setForm(f => ({ ...f, type: t, points: MISSION_POINTS[t] }))
  }

  async function handleCreate() {
    setFormError('')
    if (!form.title.trim()) { setFormError('Title is required'); return }

    setCreating(true)
    const res = await fetch('/api/advocacy/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        deadline:    form.deadline    || null,
        description: form.description || null,
        post_copy:   form.post_copy   || null,
        linkedin_url:form.linkedin_url|| null,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create mission'); return }
    setMissions(prev => [data.mission, ...prev])
    setShowCreate(false)
    setForm(BLANK)
  }

  async function handleEnd(id: string) {
    setEnding(id)
    await fetch(`/api/advocacy/missions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' }),
    })
    setEnding(null)
    setMissions(prev => prev.map(m => m.id === id ? { ...m, status: 'ended' as const } : m))
  }

  async function handleEnableAll() {
    setEnabling(true)
    await fetch('/api/advocacy/enable-all', { method: 'POST' })
    setEnabling(false)
    setEnabledAll(true)
  }

  const active = missions.filter(m => m.status === 'active')
  const ended  = missions.filter(m => m.status !== 'active')

  return (
    <>
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Manage Missions</h1>
            <p className="text-[#6E6E73] text-sm mt-0.5">Create and track advocacy missions for your team</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <p className="text-2xl font-bold gradient-brand-text">{active.length}</p>
              <p className="text-[11px] text-[#AEAEB2]">Active</p>
            </div>
            <button
              onClick={() => { setShowCreate(true); setFormError(''); setForm(BLANK) }}
              className="flex items-center gap-1.5 bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#B91C1C] transition"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <Plus size={15} /> New Mission
            </button>
          </div>
        </div>

        {/* Enable for all banner */}
        {!enabledAll && (
          <div className="bg-[#5856D6]/5 border border-[#5856D6]/20 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-[#1D1D1F]">Enable Advocacy for all employees</p>
              <p className="text-[12px] text-[#6E6E73] mt-0.5">
                One click to grant access to all 200+ active employees
              </p>
            </div>
            <button
              onClick={handleEnableAll}
              disabled={enabling}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl bg-[#5856D6] text-white hover:bg-[#4B4ACF] disabled:opacity-60 transition flex-shrink-0"
            >
              {enabling ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
              {enabling ? 'Enabling…' : 'Enable for All'}
            </button>
          </div>
        )}
        {enabledAll && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-[13px] font-semibold text-[#34C759]">
            ✓ Advocacy enabled for all active employees
          </div>
        )}

        {/* Active missions */}
        <div>
          <p className="text-[12px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-3">
            Active Missions
          </p>
          {active.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] text-center py-12"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <p className="font-semibold text-[#6E6E73]">No active missions</p>
              <p className="text-[13px] text-[#AEAEB2] mt-1">Create your first mission to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(m => (
                <MissionRow key={m.id} mission={m}
                  completions={completionCounts[m.id] ?? 0}
                  onEnd={handleEnd} ending={ending} />
              ))}
            </div>
          )}
        </div>

        {/* Ended missions */}
        {ended.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-[#AEAEB2] uppercase tracking-widest mb-3">
              Ended Missions
            </p>
            <div className="space-y-3 opacity-60">
              {ended.map(m => (
                <MissionRow key={m.id} mission={m}
                  completions={completionCounts[m.id] ?? 0}
                  onEnd={handleEnd} ending={ending} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#E5E5EA]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F2F7]">
                <div>
                  <div className="text-[15px] font-semibold text-[#1D1D1F]">New Mission</div>
                  <div className="text-[12px] text-[#AEAEB2] mt-0.5">Create an advocacy task for your team</div>
                </div>
                <button onClick={() => setShowCreate(false)}
                  className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]">
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Type selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-2">
                    Mission Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_OPTIONS.map(opt => {
                      const Icon = opt.icon
                      const selected = form.type === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => selectType(opt.value)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ${
                            selected ? 'border-[#DC2626] bg-red-50' : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                          }`}
                        >
                          <Icon size={14} className={selected ? 'text-[#DC2626]' : opt.color} />
                          <div>
                            <p className={`text-[12px] font-semibold ${selected ? 'text-[#DC2626]' : 'text-[#1D1D1F]'}`}>
                              {opt.label}
                            </p>
                            <p className="text-[10px] text-[#AEAEB2]">{MISSION_POINTS[opt.value]} pts</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                    Title *
                  </label>
                  <input className={inputCls}
                    placeholder="e.g. Share our Q2 funding announcement"
                    value={form.title}
                    onChange={e => setField('title', e.target.value)} />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                    Instructions
                  </label>
                  <input className={inputCls}
                    placeholder="Any specific instructions for employees"
                    value={form.description}
                    onChange={e => setField('description', e.target.value)} />
                </div>

                {/* Post copy */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                    Post Copy
                  </label>
                  <textarea className={`${inputCls} resize-none`} rows={4}
                    placeholder="Pre-written text employees can copy and paste to LinkedIn…"
                    value={form.post_copy}
                    onChange={e => setField('post_copy', e.target.value)} />
                </div>

                {/* LinkedIn URL */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                    LinkedIn URL
                  </label>
                  <input className={inputCls}
                    placeholder="https://linkedin.com/posts/..."
                    value={form.linkedin_url}
                    onChange={e => setField('linkedin_url', e.target.value)} />
                </div>

                {/* Points + Deadline */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                      Points
                    </label>
                    <input type="number" className={inputCls} min={1} max={100}
                      value={form.points}
                      onChange={e => setField('points', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider mb-1.5">
                      Deadline (optional)
                    </label>
                    <input type="date" className={inputCls}
                      value={form.deadline}
                      onChange={e => setField('deadline', e.target.value)} />
                  </div>
                </div>

                {formError && (
                  <p className="text-[12px] text-[#DC2626] bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F2F2F7]">
                <button onClick={() => setShowCreate(false)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-60 transition">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? 'Creating…' : 'Create Mission'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
