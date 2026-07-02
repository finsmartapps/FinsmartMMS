'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Zap, ArrowLeft } from 'lucide-react'

type Entry = {
  id: string
  name: string
  allTimePoints: number; allTimeCount: number
  monthPoints:   number; monthCount:   number
  weekPoints:    number; weekCount:    number
}

type Period = 'week' | 'month' | 'all'

function getPoints(e: Entry, p: Period) {
  if (p === 'week')  return { pts: e.weekPoints,    cnt: e.weekCount    }
  if (p === 'month') return { pts: e.monthPoints,   cnt: e.monthCount   }
  return               { pts: e.allTimePoints,  cnt: e.allTimeCount  }
}

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full gradient-brand flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold" style={{ fontSize: size <= 8 ? 12 : 14 }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export function LeaderboardClient({
  leaderboard,
  currentUserId,
}: {
  leaderboard: Entry[]
  currentUserId: string
}) {
  const [period, setPeriod] = useState<Period>('all')

  const sorted = [...leaderboard]
    .sort((a, b) => getPoints(b, period).pts - getPoints(a, period).pts)

  const top3 = sorted.slice(0, 3)
  const rest  = sorted.slice(3)
  const myRank = sorted.findIndex(e => e.id === currentUserId) + 1
  const me     = sorted.find(e => e.id === currentUserId)

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/advocacy"
          className="p-2 rounded-xl border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7] transition">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-[26px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <Trophy size={22} className="text-[#FF9500]" /> Leaderboard
          </h1>
          <p className="text-[#6E6E73] text-sm mt-0.5">Top advocates by points earned</p>
        </div>
      </div>

      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {([
          { key: 'all',   label: 'All Time' },
          { key: 'month', label: 'This Month' },
          { key: 'week',  label: 'This Week' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold transition ${
              period === key
                ? 'bg-[#1D1D1F] text-white'
                : 'bg-white border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F5F5F7]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* My rank callout */}
      {me && (
        <div className="bg-[#FF9500]/5 border border-[#FF9500]/20 rounded-2xl px-5 py-4 flex items-center gap-4">
          <Avatar name={me.name} size={10} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">Your Rank</p>
            <p className="text-[12px] text-[#6E6E73]">
              {getPoints(me, period).cnt} missions · {getPoints(me, period).pts} points
            </p>
          </div>
          <p className="text-2xl font-bold text-[#FF9500]">#{myRank || '—'}</p>
        </div>
      )}

      {/* Top 3 podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {top3.map((entry, i) => {
            const { pts, cnt } = getPoints(entry, period)
            return (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border text-center px-3 py-4 ${
                  entry.id === currentUserId ? 'border-[#FF9500]/40' : 'border-[#E5E5EA]'
                } ${i === 0 ? 'ring-2 ring-[#FF9500]/20' : ''}`}
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}
              >
                <div className="text-2xl mb-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                <div className="flex justify-center mb-2">
                  <Avatar name={entry.name} size={9} />
                </div>
                <p className="text-[13px] font-semibold text-[#1D1D1F] truncate">{entry.name}</p>
                <p className="text-[20px] font-bold text-[#FF9500] mt-1">{pts}</p>
                <p className="text-[10px] text-[#AEAEB2]">{cnt} missions</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="divide-y divide-[#F2F2F7]">
            {rest.map((entry, i) => {
              const { pts, cnt } = getPoints(entry, period)
              const isMe = entry.id === currentUserId
              return (
                <div key={entry.id}
                  className={`flex items-center gap-3 px-5 py-3.5 ${isMe ? 'bg-[#FF9500]/5' : 'hover:bg-[#FAFAFA]'}`}>
                  <span className="w-6 text-center text-[13px] font-bold text-[#AEAEB2]">{i + 4}</span>
                  <Avatar name={entry.name} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1D1D1F] truncate">
                      {entry.name}{isMe && <span className="text-[#AEAEB2] font-normal ml-1">(you)</span>}
                    </p>
                    <p className="text-[11px] text-[#AEAEB2]">{cnt} missions</p>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-[#FF9500] text-[14px]">
                    <Zap size={11} /> {pts}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] py-16 text-center">
          <Trophy size={36} className="mx-auto text-[#E5E5EA] mb-3" />
          <p className="font-semibold text-[#6E6E73]">No activity yet</p>
          <p className="text-[13px] text-[#AEAEB2] mt-1">Complete missions to appear on the leaderboard</p>
        </div>
      )}
    </div>
  )
}
