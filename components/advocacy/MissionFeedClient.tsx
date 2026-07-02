'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check, Copy, ExternalLink, Trophy, Zap,
  Heart, MessageSquare, Share2, PenLine, Target,
} from 'lucide-react'
import type { AdvocacyMission, MissionType } from '@/lib/types'

type TypeConfig = { label: string; icon: React.ElementType; color: string; bg: string; border: string }

const TYPE_CFG: Record<MissionType, TypeConfig> = {
  follow:        { label: 'Follow',        icon: Target,        color: 'text-[#007AFF]', bg: 'bg-blue-50',   border: 'border-blue-200'   },
  like:          { label: 'Like',          icon: Heart,         color: 'text-[#FF2D55]', bg: 'bg-rose-50',   border: 'border-rose-200'   },
  comment:       { label: 'Comment',       icon: MessageSquare, color: 'text-[#5856D6]', bg: 'bg-purple-50', border: 'border-purple-200' },
  share:         { label: 'Share',         icon: Share2,        color: 'text-[#34C759]', bg: 'bg-green-50',  border: 'border-green-200'  },
  original_post: { label: 'Original Post', icon: PenLine,       color: 'text-[#FF9500]', bg: 'bg-orange-50', border: 'border-orange-200' },
}

function MissionCard({
  mission,
  completed,
  onMarkDone,
  completing,
}: {
  mission: AdvocacyMission
  completed: boolean
  onMarkDone: (id: string) => void
  completing: string | null
}) {
  const [copied, setCopied] = useState(false)
  const cfg = TYPE_CFG[mission.type]
  const Icon = cfg.icon

  function handleCopy() {
    if (!mission.post_copy) return
    navigator.clipboard.writeText(mission.post_copy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden transition-all ${
        completed ? 'border-[#34C759]/30 opacity-70' : 'border-[#E5E5EA]'
      }`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.border}`}>
          <Icon size={16} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-[11px] font-bold text-[#FF9500] flex items-center gap-0.5">
              <Zap size={10} /> {mission.points} pts
            </span>
            {mission.deadline && (
              <span className="text-[11px] text-[#AEAEB2]">
                Due {new Date(mission.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {completed && (
              <span className="text-[11px] font-semibold text-[#34C759] flex items-center gap-0.5">
                <Check size={10} /> Done
              </span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold text-[#1D1D1F] mt-1 leading-snug">{mission.title}</h3>
          {mission.description && (
            <p className="text-[12px] text-[#6E6E73] mt-0.5 leading-relaxed">{mission.description}</p>
          )}
        </div>
      </div>

      {/* Post copy */}
      {mission.post_copy && (
        <div className="mx-5 mb-3">
          <div className="bg-[#F5F5F7] rounded-xl p-3 relative">
            <p className="text-[12px] text-[#3A3A3C] leading-relaxed whitespace-pre-wrap pr-8">
              {mission.post_copy}
            </p>
            <button
              onClick={handleCopy}
              title="Copy text"
              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white border border-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] transition"
            >
              {copied
                ? <Check size={12} className="text-[#34C759]" />
                : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-4 flex items-center gap-2">
        {mission.linkedin_url && (
          <a
            href={mission.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl border border-[#0A66C2] text-[#0A66C2] hover:bg-blue-50 transition"
          >
            <ExternalLink size={12} /> Open LinkedIn
          </a>
        )}
        {!completed ? (
          <button
            onClick={() => onMarkDone(mission.id)}
            disabled={completing === mission.id}
            className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl bg-[#1D1D1F] text-white hover:bg-[#3A3A3C] disabled:opacity-60 transition"
          >
            {completing === mission.id
              ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Check size={12} />}
            {completing === mission.id ? 'Saving…' : 'Mark Done'}
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-[#34C759]">
            <Check size={13} /> Completed
          </div>
        )}
      </div>
    </div>
  )
}

export function MissionFeedClient({
  missions,
  completedIds: initialCompletedIds,
  totalPoints: initialTotalPoints,
  userName,
}: {
  missions: AdvocacyMission[]
  completedIds: string[]
  totalPoints: number
  userName: string
}) {
  const [completedIds, setCompletedIds] = useState(() => new Set(initialCompletedIds))
  const [totalPoints, setTotalPoints]   = useState(initialTotalPoints)
  const [completing, setCompleting]     = useState<string | null>(null)
  const [filter, setFilter]             = useState<'all' | 'pending' | 'done'>('pending')

  async function handleMarkDone(missionId: string) {
    setCompleting(missionId)
    const res = await fetch('/api/advocacy/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId }),
    })
    setCompleting(null)
    if (res.ok) {
      const mission = missions.find(m => m.id === missionId)
      setCompletedIds(prev => new Set([...prev, missionId]))
      setTotalPoints(prev => prev + (mission?.points ?? 0))
    }
  }

  const completedCount = missions.filter(m => completedIds.has(m.id)).length
  const pendingCount   = missions.length - completedCount

  const filtered = missions.filter(m => {
    if (filter === 'pending') return !completedIds.has(m.id)
    if (filter === 'done')    return  completedIds.has(m.id)
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight">Employee Advocacy</h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">
            Help grow Finsmart&apos;s LinkedIn presence — earn points for every action
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold text-[#FF9500]">{totalPoints}</p>
            <p className="text-[11px] text-[#AEAEB2]">My Points</p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-xl px-4 py-2.5 text-center"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <p className="text-2xl font-bold text-[#34C759]">{completedCount}</p>
            <p className="text-[11px] text-[#AEAEB2]">Done</p>
          </div>
          <Link
            href="/advocacy/leaderboard"
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] transition"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Trophy size={14} className="text-[#FF9500]" /> Leaderboard
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: 'pending', label: `Pending (${pendingCount})` },
          { key: 'done',    label: `Done (${completedCount})` },
          { key: 'all',     label: `All (${missions.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold transition ${
              filter === key
                ? 'bg-[#1D1D1F] text-white'
                : 'bg-white border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mission grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] py-16 text-center"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p className="font-semibold text-[#6E6E73]">
            {filter === 'done'
              ? 'No completed missions yet'
              : filter === 'pending'
              ? 'All missions completed! 🎉'
              : 'No missions right now'}
          </p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">
            {filter === 'done'
              ? 'Complete a mission to see it here'
              : filter === 'pending'
              ? 'Check back soon for new missions'
              : 'New missions will appear here when published'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              completed={completedIds.has(mission.id)}
              onMarkDone={handleMarkDone}
              completing={completing}
            />
          ))}
        </div>
      )}
    </div>
  )
}
