'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/marketing/ui/card'
import { Textarea } from '@/components/marketing/ui/textarea'
import { Label } from '@/components/marketing/ui/label'
import { Button } from '@/components/marketing/ui/button'
import { Check, Loader2, Save, TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react'
import type { DerivedTargets, Settings, WeeklyActual, Lead } from '@/types'
import { classifyLeadSource } from '@/lib/leads'
import { HBarChart, DonutChart } from '@/components/marketing/charts/dashboard-charts'

type LeadLite = Pick<Lead, 'lead_date' | 'became_sql_date' | 'lead_source' | 'lead_status' | 'assigned_to'>

interface Props {
  targets: DerivedTargets
  settings: Settings
  existingWeeks: WeeklyActual[]
  leads: LeadLite[]
}

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end:   sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  }
}

const WEEK_OPTIONS = [0, -1, -2, -3].map(o => ({ ...getWeekDates(o), offset: o }))

function statsFor(leads: LeadLite[], start: string, end: string) {
  const inWeek = (d?: string | null) => !!d && d >= start && d <= end
  const week = leads.filter(l => inWeek(l.lead_date))
  const mql  = week.filter(l => l.lead_status === 'MQL').length
  const sql  = week.filter(l => l.lead_status === 'SQL').length

  const bySource = Object.entries(
    week.reduce<Record<string, number>>((a, l) => { const k = l.lead_source || 'Unspecified'; a[k] = (a[k] ?? 0) + 1; return a }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byStatus = Object.entries(
    week.reduce<Record<string, number>>((a, l) => { const k = l.lead_status || 'Unknown'; a[k] = (a[k] ?? 0) + 1; return a }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byAssignee = Object.entries(
    week.reduce<Record<string, number>>((a, l) => { const k = l.assigned_to?.trim() || 'Unassigned'; a[k] = (a[k] ?? 0) + 1; return a }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  // source-category breakdown
  const byCategory = (['Digital MQL', 'Direct SQL', 'Event SQL', 'Unclassified'] as const)
    .map(cat => ({ name: cat, value: week.filter(l => classifyLeadSource(l.lead_source) === cat).length }))
    .filter(d => d.value > 0)

  return { total: week.length, mql, sql, bySource, byStatus, byAssignee, byCategory }
}

function StatCard({ label, value, target, foot, color }: {
  label: string; value: number; target?: number; foot: string; color: string
}) {
  const delta = target !== undefined ? value - target : null
  const positive = delta !== null && delta >= 0
  const DeltaIcon = delta === null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${color} relative overflow-hidden`}>
      <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-white tabular-nums">{value}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <p className="text-[10px] text-white/60 flex items-center gap-0.5">
          <ArrowUpRight className="h-3 w-3" /> {foot}
        </p>
        {DeltaIcon && delta !== null && (
          <span className={`ml-auto text-[11px] font-bold flex items-center gap-0.5 ${positive ? 'text-emerald-200' : 'text-red-200'}`}>
            <DeltaIcon className="h-3 w-3" />
            {delta >= 0 ? `+${delta}` : delta} vs target
          </span>
        )}
      </div>
    </div>
  )
}

export default function WeeklyReviewForm({ targets, settings, existingWeeks, leads }: Props) {
  const supabase = createClient()
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(WEEK_OPTIONS[0].start)

  const wk       = WEEK_OPTIONS.find(w => w.start === selectedWeek)!
  const existing = existingWeeks.find(w => w.week_start === selectedWeek)

  const [discussion, setDiscussion] = useState({
    wins:      existing?.wins             ?? '',
    concerns:  existing?.concerns         ?? '',
    decisions: existing?.decisions_needed ?? '',
    support:   existing?.founder_support  ?? '',
  })

  const stats = statsFor(leads, wk.start, wk.end)

  async function handleSave() {
    setSaving(true)
    const payload = {
      week_start:       wk.start,
      week_end:         wk.end,
      mql_actual:       stats.mql,
      sql_actual:       stats.sql,
      meetings_actual:  existing?.meetings_actual ?? 0,
      pipeline_created: stats.sql * settings.avg_deal_value * 12,
      wins:             discussion.wins,
      concerns:         discussion.concerns,
      decisions_needed: discussion.decisions,
      founder_support:  discussion.support,
      channel_snapshot:     existing?.channel_snapshot     ?? [],
      segment_performance:  existing?.segment_performance  ?? [],
      sdr_productivity:     existing?.sdr_productivity     ?? [],
      updated_at: new Date().toISOString(),
    }
    const { error } = existing
      ? await supabase.from('weekly_actuals').update(payload).eq('id', existing.id)
      : await supabase.from('weekly_actuals').insert(payload)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const isEmpty = stats.total === 0

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Review Setup</p>
              <p className="text-xs text-slate-400 mt-0.5">Prepared by Chirag · Review owner: Maanoj + Chirag</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {WEEK_OPTIONS.map(w => (
                  <button
                    key={w.start}
                    onClick={() => setSelectedWeek(w.start)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150 ${
                      selectedWeek === w.start
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {w.offset === 0 ? 'This week' : w.offset === -1 ? 'Last week' : w.label.split('–')[0].trim()}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className={`gap-1.5 font-bold rounded-xl border-0 text-white transition-all ${
                  saved
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500'
                }`}
              >
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : saved ? <><Check className="h-3.5 w-3.5" /> Saved</>
                  : <><Save className="h-3.5 w-3.5" /> Save Notes</>}
              </Button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-600">Week of:</span> {wk.label}
              {existing
                ? <span className="ml-2 text-emerald-600 font-medium">· Notes saved</span>
                : <span className="ml-2 text-amber-500 font-medium">· No notes yet</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New Leads"   value={stats.total} foot="added this week"
          color="from-slate-600 to-slate-800" />
        <StatCard label="MQLs"        value={stats.mql}   target={Math.round(targets.weekly_mqls)} foot={`target ${Math.round(targets.weekly_mqls)}/wk`}
          color="from-indigo-500 via-indigo-600 to-violet-700" />
        <StatCard label="SQLs"        value={stats.sql}   target={Math.round(targets.weekly_sqls)} foot={`target ${Math.round(targets.weekly_sqls)}/wk`}
          color="from-emerald-500 via-teal-600 to-cyan-700" />
        <StatCard label="Funnel Mix"  value={stats.byCategory.length} foot={stats.byCategory.map(c => `${c.name.split(' ')[0]} ${c.value}`).join(' · ')}
          color="from-fuchsia-500 via-purple-600 to-pink-700" />
      </div>

      {/* ── Charts ── */}
      {isEmpty ? (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200">
          <CardContent className="py-16 text-center text-slate-400 text-sm">
            No leads imported for this week yet. Import your CSV to see the breakdown.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* By Source */}
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Leads by Source</p>
              <DonutChart
                data={stats.bySource}
                centerValue={stats.total.toString()}
                centerLabel="this week"
              />
            </CardContent>
          </Card>

          {/* By Status */}
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Leads by Status</p>
              <HBarChart data={stats.byStatus} />
            </CardContent>
          </Card>

          {/* By Assignee */}
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Leads by Assignee</p>
              <HBarChart data={stats.byAssignee} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Discussion notes ── */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-5 space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Discussion Notes</p>
          {([
            { key: 'wins'      as const, label: '🏆 Wins this week',          placeholder: 'What went well this week...' },
            { key: 'concerns'  as const, label: '🚧 Concerns / blockers',      placeholder: "What's blocking progress..." },
            { key: 'decisions' as const, label: '🔑 Decisions needed',         placeholder: "What needs Maanoj's input..." },
            { key: 'support'   as const, label: '🙋 Founder support needed',   placeholder: 'Specific ask from the founder...' },
          ]).map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{label}</Label>
              <Textarea
                rows={2}
                value={discussion[key]}
                onChange={e => setDiscussion(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/20 resize-none text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  )
}
