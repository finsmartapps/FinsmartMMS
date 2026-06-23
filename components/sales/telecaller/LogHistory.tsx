'use client'

import { useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { getAchievementColor } from '@/lib/utils'

interface ActivityVal { name: string; value: number; deficit_reason: string | null }
export interface HistoryRow {
  date: string
  calls: number
  hitTarget: boolean
  activities: ActivityVal[]
}

interface Props {
  rows: HistoryRow[]
  activityNames: string[]   // ordered list of activity names (for column headers)
  callTarget: number
}

const INITIAL_SHOW = 10

function shortDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const barBg = { green: 'bg-[#34C759]', yellow: 'bg-[#FF9500]', red: 'bg-[#FF3B30]', gray: 'bg-[#E5E5EA]' }
const textCol = { green: 'text-[#34C759]', yellow: 'text-[#FF9500]', red: 'text-[#DC2626]', gray: 'text-[#AEAEB2]' }

export function LogHistory({ rows, activityNames, callTarget }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (rows.length === 0) return null

  const visible = showAll ? rows : rows.slice(0, INITIAL_SHOW)
  const hasMore = rows.length > INITIAL_SHOW

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)' }}>

      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F2F2F7]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#F5F5F7] flex items-center justify-center">
            <History size={13} className="text-[#6E6E73]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#1D1D1F]">Submission History</p>
            <p className="text-[11px] text-[#AEAEB2]">Last {rows.length} submitted {rows.length === 1 ? 'day' : 'days'}</p>
          </div>
        </div>
        {callTarget > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-[#6E6E73]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#34C759] inline-block" /> Met</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#FF9500] inline-block" /> Near</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#DC2626] inline-block" /> Below</span>
          </div>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[400px]">
          <thead>
            <tr className="border-b border-[#F2F2F7] bg-[#FAFAFA]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap sticky left-0 bg-[#FAFAFA] z-10">
                Date
              </th>
              {activityNames.map(name => (
                <th key={name} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">
                  {name}
                </th>
              ))}
              {callTarget > 0 && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider whitespace-nowrap">
                  vs Target
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {visible.map((row) => {
              const tcAct = row.activities.find(a => a.name === 'Total Calls')
              const color = callTarget > 0 && tcAct
                ? getAchievementColor(tcAct.value, callTarget)
                : 'gray'
              const pct = callTarget > 0 && tcAct
                ? Math.min(100, Math.round((tcAct.value / callTarget) * 100))
                : null
              const deficitReason = tcAct?.deficit_reason

              return (
                <tr key={row.date} className="hover:bg-[#FAFAFA] transition">
                  {/* Date — sticky on mobile */}
                  <td className="px-4 py-3 font-semibold text-[#1D1D1F] whitespace-nowrap sticky left-0 bg-white group-hover:bg-[#FAFAFA] z-10">
                    {shortDate(row.date)}
                  </td>

                  {activityNames.map(name => {
                    const act = row.activities.find(a => a.name === name)
                    const val = act?.value ?? 0
                    const isTotalCalls = name === 'Total Calls'

                    return (
                      <td key={name} className="px-4 py-3">
                        {isTotalCalls ? (
                          <div className="flex items-center gap-2.5 min-w-[90px]">
                            <span className={`text-[13px] font-bold ${textCol[color]}`}>{val}</span>
                            {callTarget > 0 && (
                              <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden min-w-[40px]">
                                <div className={`h-full rounded-full ${barBg[color]}`} style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#1D1D1F] font-medium">{val}</span>
                        )}
                        {isTotalCalls && deficitReason && (
                          <p className="text-[11px] text-[#FF9500] italic mt-0.5 max-w-[200px] truncate" title={deficitReason}>
                            ↳ {deficitReason}
                          </p>
                        )}
                      </td>
                    )
                  })}

                  {callTarget > 0 && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {pct !== null ? (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          color === 'green' ? 'bg-green-50 text-green-700 border border-green-100'
                          : color === 'yellow' ? 'bg-orange-50 text-orange-600 border border-orange-100'
                          : 'bg-red-50 text-[#DC2626] border border-red-100'
                        }`}>
                          {pct}%
                        </span>
                      ) : <span className="text-[#AEAEB2]">—</span>}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-[#F2F2F7] text-[13px] text-[#6E6E73] hover:text-[#DC2626] hover:bg-[#FAFAFA] transition font-medium"
        >
          {showAll
            ? <><ChevronUp size={14} /> Show less</>
            : <><ChevronDown size={14} /> Show {rows.length - INITIAL_SHOW} more</>
          }
        </button>
      )}
    </div>
  )
}
