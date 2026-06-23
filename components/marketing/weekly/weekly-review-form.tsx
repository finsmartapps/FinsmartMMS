'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/marketing/ui/card'
import { Input } from '@/components/marketing/ui/input'
import { Label } from '@/components/marketing/ui/label'
import { Textarea } from '@/components/marketing/ui/textarea'
import { Button } from '@/components/marketing/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/marketing/ui/tabs'
import { Check, Loader2, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DerivedTargets, Settings, Segment, Channel, WeeklyActual, Lead } from '@/types'
import { formatCurrency } from '@/lib/calculations'
import { classifyLeadSource } from '@/lib/leads'

type LeadLite = Pick<Lead, 'lead_date' | 'became_sql_date' | 'lead_source'>

interface Props {
  targets: DerivedTargets
  settings: Settings
  segments: Segment[]
  channels: Channel[]
  existingWeeks: WeeklyActual[]
  leads: LeadLite[]
}

const SDR_NAMES = ['Palak Pandey', 'Aaryan Yadav', 'SDR 3', 'Piyush (0.5 AE / 0.5 SDR)']

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  }
}

const WEEK_OPTIONS = [0, -1, -2, -3].map(o => ({ ...getWeekDates(o), offset: o }))

// Achieved MQL/SQL for a Mon–Sun week, counted live from the leads register.
// MQL = Digital MQL leads by lead_date; SQL = became_sql_date when set, else
// arrival date for Direct/Event SQL leads (SQL on arrival).
function leadStatsFor(leads: LeadLite[], start: string, end: string) {
  const inWeek = (d?: string | null) => !!d && d >= start && d <= end
  const sqlDate = (l: LeadLite) => {
    if (l.became_sql_date) return l.became_sql_date
    const cat = classifyLeadSource(l.lead_source)
    return cat === 'Direct SQL' || cat === 'Event SQL' ? l.lead_date : null
  }
  const mql = leads.filter(l => classifyLeadSource(l.lead_source) === 'Digital MQL' && inWeek(l.lead_date)).length
  const sql = leads.filter(l => inWeek(sqlDate(l))).length
  return { mql, sql }
}

export default function WeeklyReviewForm({ targets, settings, segments, channels, existingWeeks, leads }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(WEEK_OPTIONS[0].start)

  const wk = WEEK_OPTIONS.find(w => w.start === selectedWeek)!
  const existing = existingWeeks.find(w => w.week_start === selectedWeek)

  // MQL & SQL are auto-counted from leads for the selected week (no manual entry).
  const auto = leadStatsFor(leads, wk.start, wk.end)

  const [nums, setNums] = useState({
    meetings: existing?.meetings_actual?.toString() ?? '0',
  })

  const [discussion, setDiscussion] = useState({
    wins:      existing?.wins            ?? '',
    concerns:  existing?.concerns        ?? '',
    decisions: existing?.decisions_needed ?? '',
    support:   existing?.founder_support  ?? '',
  })

  const [channelSnap, setChannelSnap] = useState<Record<string, { mql: string; sql: string; moved: string; broke: string; action: string }>>(
    () => Object.fromEntries(channels.map(c => {
      const ex = existing?.channel_snapshot?.find((s: { channel_name: string }) => s.channel_name === c.name)
      return [c.name, {
        mql:    ex?.weekly_mql?.toString()   ?? '0',
        sql:    ex?.weekly_sql?.toString()   ?? '0',
        moved:  ex?.what_moved               ?? '',
        broke:  ex?.what_broke               ?? '',
        action: ex?.action_next_week         ?? '',
      }]
    }))
  )

  const [segSnap, setSegSnap] = useState<Record<string, { sql: string; mtd: string; seats: string; notes: string }>>(
    () => Object.fromEntries(segments.map(s => {
      const ex = existing?.segment_performance?.find((p: { segment_name: string }) => p.segment_name === s.name)
      return [s.name, {
        sql:   ex?.actual_sql?.toString()        ?? '0',
        mtd:   ex?.mtd_sql?.toString()           ?? '0',
        seats: ex?.seats_closed_mtd?.toString()  ?? '0',
        notes: ex?.notes                         ?? '',
      }]
    }))
  )

  const [sdrData, setSdrData] = useState<Record<string, { booked: string; showRate: string; sqlRate: string }>>(
    () => Object.fromEntries(SDR_NAMES.map(name => {
      const ex = existing?.sdr_productivity?.find((s: { sdr_name: string }) => s.sdr_name === name)
      return [name, {
        booked:   ex?.meetings_booked?.toString() ?? '0',
        showRate: ex?.show_rate?.toString()        ?? '0',
        sqlRate:  ex?.meeting_sql_rate?.toString() ?? '0',
      }]
    }))
  )

  function n(v: string) { return parseInt(v) || 0 }
  function f(v: string) { return parseFloat(v) || 0 }

  const mqlActual = auto.mql
  const sqlActual = auto.sql

  function variance(val: number, target: number) {
    const v = val - target
    return {
      v,
      positive: v >= 0,
      label: v >= 0 ? `+${v}` : `${v}`,
      color: v >= 0 ? 'text-emerald-600' : 'text-red-500',
      bgColor: v >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
      Icon: v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus,
    }
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      week_start: wk.start,
      week_end: wk.end,
      mql_actual: mqlActual,
      sql_actual: sqlActual,
      meetings_actual: n(nums.meetings),
      pipeline_created: sqlActual * settings.avg_deal_value * 12,
      wins: discussion.wins,
      concerns: discussion.concerns,
      decisions_needed: discussion.decisions,
      founder_support: discussion.support,
      channel_snapshot: channels.map(c => ({
        channel_name: c.name,
        weekly_mql:      n(channelSnap[c.name]?.mql),
        weekly_sql:      n(channelSnap[c.name]?.sql),
        what_moved:      channelSnap[c.name]?.moved  ?? '',
        what_broke:      channelSnap[c.name]?.broke  ?? '',
        action_next_week: channelSnap[c.name]?.action ?? '',
      })),
      segment_performance: segments.map(s => ({
        segment_name:    s.name,
        actual_sql:      n(segSnap[s.name]?.sql),
        mtd_sql:         n(segSnap[s.name]?.mtd),
        seats_closed_mtd: n(segSnap[s.name]?.seats),
        notes:           segSnap[s.name]?.notes ?? '',
      })),
      sdr_productivity: SDR_NAMES.map(name => ({
        sdr_name:         name,
        meetings_booked:  n(sdrData[name]?.booked),
        show_rate:        f(sdrData[name]?.showRate),
        meeting_sql_rate: f(sdrData[name]?.sqlRate),
      })),
      updated_at: new Date().toISOString(),
    }

    const { error } = existing
      ? await supabase.from('weekly_actuals').update(payload).eq('id', existing.id)
      : await supabase.from('weekly_actuals').insert(payload)

    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div className="space-y-5">

      {/* ── Header card ────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Review Setup</p>
              <p className="text-xs text-slate-400 mt-0.5">Prepared by Chirag · Review owner: Maanoj + Chirag</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Week selector */}
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

              {/* Save button */}
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
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : saved ? (
                  <><Check className="h-3.5 w-3.5" /> Saved</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Save</>
                )}
              </Button>
            </div>
          </div>
          {/* Week date display */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              <span className="font-medium text-slate-600">Week of:</span> {wk.label}
              {existing && <span className="ml-2 text-emerald-600 font-medium">· Data exists</span>}
              {!existing && <span className="ml-2 text-amber-500 font-medium">· No data yet</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs defaultValue="numbers">
        <TabsList className="bg-slate-100 p-0.5 h-auto gap-0.5">
          {[
            { value: 'numbers',    label: 'Numbers First' },
            { value: 'segments',   label: 'Segments'      },
            { value: 'channels',   label: 'Channels'      },
            { value: 'sdr',        label: 'SDR'           },
            { value: 'discussion', label: 'Discussion'    },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm text-slate-500 rounded-md transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Numbers First ── */}
        <TabsContent value="numbers" className="mt-3">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5 space-y-4">

              {/* Header row */}
              <div className="grid grid-cols-[2fr_100px_100px_100px] gap-3 pb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Metric</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Target</span>
                <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">Actual</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Variance</span>
              </div>

              {[
                { label: 'Digital MQLs', target: targets.weekly_mqls,     value: mqlActual,        auto: true  },
                { label: 'SQLs',         target: targets.weekly_sqls,     value: sqlActual,        auto: true  },
                { label: 'Meetings',     target: targets.weekly_meetings, value: n(nums.meetings), auto: false },
              ].map(row => {
                const v = variance(row.value, row.target)
                const hasData = row.auto || row.value > 0
                return (
                  <div key={row.label} className="grid grid-cols-[2fr_100px_100px_100px] gap-3 items-center">
                    <span className="text-sm font-semibold text-slate-700">
                      {row.label}
                      {row.auto && (
                        <span className="ml-2 align-middle text-[9px] font-bold text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wider">
                          auto · leads
                        </span>
                      )}
                    </span>
                    <div className="text-center">
                      <span className="text-sm font-bold text-slate-500 bg-slate-100 rounded-lg px-3 py-1.5 inline-block">
                        {row.target}
                      </span>
                    </div>
                    {row.auto ? (
                      <div className="text-center">
                        <span className="text-sm font-bold text-indigo-700 bg-indigo-50 rounded-lg px-3 py-1.5 inline-block w-full" title="Counted automatically from the Leads register for this week">
                          {row.value}
                        </span>
                      </div>
                    ) : (
                      <Input
                        type="number" min="0"
                        value={nums.meetings}
                        onChange={e => setNums(p => ({ ...p, meetings: e.target.value }))}
                        className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-bold h-10"
                      />
                    )}
                    <div className={`flex items-center justify-center gap-1 h-9 rounded-lg border text-sm font-bold ${hasData ? v.bgColor : 'bg-slate-50 border-slate-200'} ${hasData ? v.color : 'text-slate-400'}`}>
                      {hasData && <v.Icon className="h-3.5 w-3.5" />}
                      {hasData ? v.label : '—'}
                    </div>
                  </div>
                )
              })}

              {/* Pipeline summary */}
              <div className="grid grid-cols-[2fr_100px_100px_100px] gap-3 items-center pt-3 border-t border-slate-100">
                <span className="text-sm font-semibold text-slate-600">Pipeline Created</span>
                <div className="text-center text-xs font-medium text-slate-500">
                  {formatCurrency(targets.weekly_sqls * settings.avg_deal_value * 12)}
                </div>
                <div className="text-center text-sm font-bold text-emerald-700">
                  {sqlActual > 0 ? formatCurrency(sqlActual * settings.avg_deal_value * 12) : '—'}
                </div>
                <div />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Segments ── */}
        <TabsContent value="segments" className="mt-3">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-[2fr_80px_80px_70px_80px_1fr] gap-2 pb-2 border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest">
                <span className="text-slate-400 pl-1">Segment</span>
                <span className="text-slate-400 text-center">Wkly Target</span>
                <span className="text-indigo-500 text-center">Actual SQL</span>
                <span className="text-slate-400 text-center">Gap</span>
                <span className="text-indigo-500 text-center">MTD SQL</span>
                <span className="text-indigo-500">Notes</span>
              </div>
              {segments.map(seg => {
                const weeklyTarget = seg.annual_seats_target > 0
                  ? Math.ceil(Math.ceil(seg.annual_seats_target / settings.sql_seat_conversion) / 12 / 4)
                  : 0
                const actual = n(segSnap[seg.name]?.sql)
                const gap = actual - weeklyTarget
                const hasData = actual > 0
                return (
                  <div key={seg.id} className="grid grid-cols-[2fr_80px_80px_70px_80px_1fr] gap-2 items-center py-1">
                    <span className="text-sm font-semibold text-slate-700 pl-1">{seg.name}</span>
                    <div className="text-center text-sm font-bold text-slate-400 bg-slate-50 rounded-md h-9 flex items-center justify-center">
                      {weeklyTarget}
                    </div>
                    <Input type="number" min="0"
                      value={segSnap[seg.name]?.sql ?? '0'}
                      onChange={e => setSegSnap(p => ({ ...p, [seg.name]: { ...p[seg.name], sql: e.target.value } }))}
                      className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 text-center font-bold h-9"
                    />
                    <div className={`text-center text-sm font-bold h-9 flex items-center justify-center rounded-md border ${hasData ? (gap >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200') : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
                      {hasData ? (gap >= 0 ? `+${gap}` : gap) : '—'}
                    </div>
                    <Input type="number" min="0"
                      value={segSnap[seg.name]?.mtd ?? '0'}
                      onChange={e => setSegSnap(p => ({ ...p, [seg.name]: { ...p[seg.name], mtd: e.target.value } }))}
                      className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 text-center font-bold h-9"
                    />
                    <Input
                      value={segSnap[seg.name]?.notes ?? ''}
                      onChange={e => setSegSnap(p => ({ ...p, [seg.name]: { ...p[seg.name], notes: e.target.value } }))}
                      className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/20 text-sm h-9"
                      placeholder="Notes…"
                    />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Channels ── */}
        <TabsContent value="channels" className="mt-3">
          <div className="space-y-3">
            {channels.map(ch => (
              <Card key={ch.id} className="border-0 shadow-sm ring-1 ring-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <p className="text-sm font-bold text-slate-800">{ch.name}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { key: 'mql',    label: 'Weekly MQL',       type: 'number' },
                      { key: 'sql',    label: 'Weekly SQL',       type: 'number' },
                      { key: 'moved',  label: 'What moved',       type: 'text'   },
                      { key: 'broke',  label: 'What broke',       type: 'text'   },
                      { key: 'action', label: 'Action next week', type: 'text'   },
                    ].map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                          {field.label}
                        </Label>
                        <Input
                          type={field.type}
                          min={field.type === 'number' ? '0' : undefined}
                          value={channelSnap[ch.name]?.[field.key as keyof (typeof channelSnap)[string]] ?? ''}
                          onChange={e => setChannelSnap(p => ({
                            ...p,
                            [ch.name]: { ...p[ch.name], [field.key]: e.target.value }
                          }))}
                          className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/20 h-9"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── SDR Productivity ── */}
        <TabsContent value="sdr" className="mt-3">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-[2fr_110px_110px_110px] gap-3 pb-2 border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest">
                <span className="text-slate-400 pl-1">SDR</span>
                <span className="text-indigo-500 text-center">Meetings Booked</span>
                <span className="text-indigo-500 text-center">Show Rate %</span>
                <span className="text-indigo-500 text-center">Mtg→SQL %</span>
              </div>
              {SDR_NAMES.map(name => (
                <div key={name} className="grid grid-cols-[2fr_110px_110px_110px] gap-3 items-center py-1">
                  <span className="text-sm font-semibold text-slate-700 pl-1">{name}</span>
                  <Input type="number" min="0"
                    value={sdrData[name]?.booked ?? '0'}
                    onChange={e => setSdrData(p => ({ ...p, [name]: { ...p[name], booked: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 text-center font-bold h-9"
                  />
                  <Input type="number" min="0" max="100"
                    value={sdrData[name]?.showRate ?? '0'}
                    onChange={e => setSdrData(p => ({ ...p, [name]: { ...p[name], showRate: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 text-center font-bold h-9"
                  />
                  <Input type="number" min="0" max="100"
                    value={sdrData[name]?.sqlRate ?? '0'}
                    onChange={e => setSdrData(p => ({ ...p, [name]: { ...p[name], sqlRate: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 text-center font-bold h-9"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Discussion ── */}
        <TabsContent value="discussion" className="mt-3">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardContent className="p-5 space-y-4">
              {[
                { key: 'wins'      as const, label: '🏆 Wins this week',              placeholder: 'What went well this week...' },
                { key: 'concerns'  as const, label: '🚧 Concerns / blockers',          placeholder: 'What\'s blocking progress...' },
                { key: 'decisions' as const, label: '🔑 Decisions needed',             placeholder: 'What needs Maanoj\'s input...' },
                { key: 'support'   as const, label: '🙋 Founder support needed',       placeholder: 'Specific ask from the founder...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                    {label}
                  </Label>
                  <Textarea
                    rows={3}
                    value={discussion[key]}
                    onChange={e => setDiscussion(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/20 resize-none text-sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
