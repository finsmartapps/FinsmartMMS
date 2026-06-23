'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/marketing/ui/input'
import { Label } from '@/components/marketing/ui/label'
import { Textarea } from '@/components/marketing/ui/textarea'
import { Button } from '@/components/marketing/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/marketing/ui/tabs'
import { Separator } from '@/components/marketing/ui/separator'
import { Check, Loader2, Save } from 'lucide-react'
import type { Channel, Segment, PlanEvent, Settings, MonthlyActual } from '@/types'
import { formatCurrency, deriveTargets } from '@/lib/calculations'

interface Props {
  channels: Channel[]
  segments: Segment[]
  events: PlanEvent[]
  settings: Settings
  existingMonths: MonthlyActual[]
}

const MONTHS = [
  { label: 'Apr 2026', value: '2026-04-01' },
  { label: 'May 2026', value: '2026-05-01' },
  { label: 'Jun 2026', value: '2026-06-01' },
]

export default function MonthlyActualsForm({ channels, segments, events, settings, existingMonths }: Props) {
  const supabase = createClient()
  const targets = deriveTargets(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[1].value)  // default May

  const existing = existingMonths.find(m => m.month === selectedMonth)

  const [seatsClosd, setSeatsClosd] = useState(existing?.seats_closed?.toString() ?? '0')
  const [channelData, setChannelData] = useState<Record<string, { mql: string; sql: string }>>(
    () => Object.fromEntries(channels.map(c => [
      c.id,
      {
        mql: existing?.channel_data?.find((d: { channel_id: string }) => d.channel_id === c.id)?.mql_actual?.toString() ?? '0',
        sql: existing?.channel_data?.find((d: { channel_id: string }) => d.channel_id === c.id)?.sql_actual?.toString() ?? '0',
      }
    ]))
  )
  const [segmentData, setSegmentData] = useState<Record<string, { sql: string; seats: string }>>(
    () => Object.fromEntries(segments.map(s => [
      s.id,
      {
        sql: existing?.segment_data?.find((d: { segment_id: string }) => d.segment_id === s.id)?.sql_actual?.toString() ?? '0',
        seats: existing?.segment_data?.find((d: { segment_id: string }) => d.segment_id === s.id)?.seats_closed?.toString() ?? '0',
      }
    ]))
  )
  const [eventData, setEventData] = useState<Record<string, { sqls: string; deals: string; cost: string }>>(
    () => Object.fromEntries(events.map(e => [
      e.id,
      {
        sqls: existing?.event_data?.find((d: { event_id: string }) => d.event_id === e.id)?.sqls_actual?.toString() ?? '0',
        deals: existing?.event_data?.find((d: { event_id: string }) => d.event_id === e.id)?.deals_closed?.toString() ?? '0',
        cost: existing?.event_data?.find((d: { event_id: string }) => d.event_id === e.id)?.event_cost?.toString() ?? '0',
      }
    ]))
  )
  const [pipeline, setPipeline] = useState({
    p30_closures: existing?.pipeline_30d_closures?.toString() ?? '0',
    p30_sqls:     existing?.pipeline_30d_sqls?.toString()     ?? '0',
    p30_value:    existing?.pipeline_30d_value?.toString()    ?? '0',
    p60_closures: existing?.pipeline_60d_closures?.toString() ?? '0',
    p60_sqls:     existing?.pipeline_60d_sqls?.toString()     ?? '0',
    p60_value:    existing?.pipeline_60d_value?.toString()    ?? '0',
    p90_closures: existing?.pipeline_90d_closures?.toString() ?? '0',
    p90_sqls:     existing?.pipeline_90d_sqls?.toString()     ?? '0',
    p90_value:    existing?.pipeline_90d_value?.toString()    ?? '0',
  })
  const [notes, setNotes] = useState({
    wins:       existing?.top_wins              ?? '',
    blockers:   existing?.top_blockers          ?? '',
    experiment: existing?.big_experiment        ?? '',
    support:    existing?.founder_support_needed ?? '',
  })

  function n(v: string) { return parseInt(v) || 0 }

  async function handleSave() {
    setSaving(true)
    const payload = {
      month: selectedMonth,
      seats_closed: n(seatsClosd),
      channel_data: channels.map(c => ({
        channel_id:   c.id,
        channel_name: c.name,
        mql_actual:   n(channelData[c.id]?.mql),
        sql_actual:   n(channelData[c.id]?.sql),
      })),
      segment_data: segments.map(s => ({
        segment_id:   s.id,
        segment_name: s.name,
        sql_actual:   n(segmentData[s.id]?.sql),
        seats_closed: n(segmentData[s.id]?.seats),
      })),
      event_data: events.map(e => ({
        event_id:    e.id,
        event_name:  e.name,
        sqls_actual: n(eventData[e.id]?.sqls),
        deals_closed: n(eventData[e.id]?.deals),
        event_cost:  n(eventData[e.id]?.cost),
      })),
      pipeline_30d_closures: n(pipeline.p30_closures),
      pipeline_30d_sqls:     n(pipeline.p30_sqls),
      pipeline_30d_value:    n(pipeline.p30_value),
      pipeline_60d_closures: n(pipeline.p60_closures),
      pipeline_60d_sqls:     n(pipeline.p60_sqls),
      pipeline_60d_value:    n(pipeline.p60_value),
      pipeline_90d_closures: n(pipeline.p90_closures),
      pipeline_90d_sqls:     n(pipeline.p90_sqls),
      pipeline_90d_value:    n(pipeline.p90_value),
      top_wins:               notes.wins,
      top_blockers:           notes.blockers,
      big_experiment:         notes.experiment,
      founder_support_needed: notes.support,
      updated_at:             new Date().toISOString(),
    }

    const { error } = existing
      ? await supabase.from('monthly_actuals').update(payload).eq('id', existing.id)
      : await supabase.from('monthly_actuals').insert(payload)

    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <div>
      {/* ── Control bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
          {MONTHS.map(m => (
            <button
              key={m.value}
              onClick={() => setSelectedMonth(m.value)}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                selectedMonth === m.value
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className={`gap-1.5 font-bold rounded-xl h-9 px-5 transition-all border-0 text-white ${
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

      <div>
        <Tabs defaultValue="overview">
          <TabsList className="bg-slate-100 p-0.5 h-auto gap-0.5 mb-5">
            {['overview', 'channels', 'segments', 'events', 'pipeline', 'notes'].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="text-xs font-semibold capitalize px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm text-slate-500 rounded-md transition-all"
              >
                {tab === 'overview' ? 'Overview' :
                 tab === 'channels' ? 'Channels' :
                 tab === 'segments' ? 'Segments' :
                 tab === 'events'   ? 'Events'   :
                 tab === 'pipeline' ? 'Pipeline' : 'Notes'}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  Seats Closed this month
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={seatsClosd}
                  onChange={e => setSeatsClosd(e.target.value)}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 h-11 text-lg font-bold text-center"
                />
                <p className="text-xs text-slate-400">Monthly target: ~{(settings.annual_seats_target / 12).toFixed(1)}</p>
              </div>
            </div>
          </TabsContent>

          {/* ── Channels ── */}
          <TabsContent value="channels" className="space-y-2 mt-0">
            <div className="grid grid-cols-[1fr_90px_90px] gap-2 pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Channel</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">MQL Actual</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">SQL Actual</span>
            </div>
            {channels.map(ch => (
              <div key={ch.id} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center py-1.5 border-b border-slate-50 last:border-0">
                <div className="pl-1">
                  <p className="text-sm font-semibold text-slate-700">{ch.name}</p>
                  <p className="text-[11px] text-slate-400">Target: {ch.monthly_mql_target} MQL</p>
                </div>
                <Input
                  type="number" min="0"
                  value={channelData[ch.id]?.mql ?? '0'}
                  onChange={e => setChannelData(p => ({ ...p, [ch.id]: { ...p[ch.id], mql: e.target.value } }))}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                />
                <Input
                  type="number" min="0"
                  value={channelData[ch.id]?.sql ?? '0'}
                  onChange={e => setChannelData(p => ({ ...p, [ch.id]: { ...p[ch.id], sql: e.target.value } }))}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                />
              </div>
            ))}
          </TabsContent>

          {/* ── Segments ── */}
          <TabsContent value="segments" className="space-y-2 mt-0">
            <div className="grid grid-cols-[1fr_90px_90px] gap-2 pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Segment</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">SQLs</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">Seats Closed</span>
            </div>
            {segments.map(seg => (
              <div key={seg.id} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center py-1.5 border-b border-slate-50 last:border-0">
                <div className="pl-1">
                  <p className="text-sm font-semibold text-slate-700">{seg.name}</p>
                  <p className="text-[11px] text-slate-400">Target: {seg.annual_seats_target} seats/yr</p>
                </div>
                <Input
                  type="number" min="0"
                  value={segmentData[seg.id]?.sql ?? '0'}
                  onChange={e => setSegmentData(p => ({ ...p, [seg.id]: { ...p[seg.id], sql: e.target.value } }))}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                />
                <Input
                  type="number" min="0"
                  value={segmentData[seg.id]?.seats ?? '0'}
                  onChange={e => setSegmentData(p => ({ ...p, [seg.id]: { ...p[seg.id], seats: e.target.value } }))}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                />
              </div>
            ))}
          </TabsContent>

          {/* ── Events ── */}
          <TabsContent value="events" className="space-y-2 mt-0">
            <div className="grid grid-cols-[1fr_72px_72px_110px_80px] gap-2 pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Event</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">SQLs</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">Deals</span>
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest text-center">Cost ($)</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right pr-1">ROI</span>
            </div>
            {events.map(evt => {
              const deals = n(eventData[evt.id]?.deals)
              const cost  = n(eventData[evt.id]?.cost)
              const revenue = deals * settings.avg_deal_value
              const roi = cost > 0 ? (revenue / cost).toFixed(1) + 'x' : '—'
              const roiNum = cost > 0 ? revenue / cost : 0
              const roiColor = roiNum >= 3 ? 'text-emerald-700 font-bold' : roiNum > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'
              return (
                <div key={evt.id} className="grid grid-cols-[1fr_72px_72px_110px_80px] gap-2 items-center py-1.5 border-b border-slate-50 last:border-0">
                  <div className="pl-1">
                    <p className="text-sm font-semibold text-slate-700">{evt.name}</p>
                    <p className="text-[11px] text-slate-400">{evt.quarter} · Target {evt.sql_target_min}–{evt.sql_target_max} SQLs</p>
                  </div>
                  <Input type="number" min="0"
                    value={eventData[evt.id]?.sqls ?? '0'}
                    onChange={e => setEventData(p => ({ ...p, [evt.id]: { ...p[evt.id], sqls: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                  />
                  <Input type="number" min="0"
                    value={eventData[evt.id]?.deals ?? '0'}
                    onChange={e => setEventData(p => ({ ...p, [evt.id]: { ...p[evt.id], deals: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                  />
                  <Input type="number" min="0"
                    value={eventData[evt.id]?.cost ?? '0'}
                    onChange={e => setEventData(p => ({ ...p, [evt.id]: { ...p[evt.id], cost: e.target.value } }))}
                    className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/30 text-center font-semibold h-9"
                  />
                  <div className={`text-right text-sm pr-1 ${roiColor}`}>{roi}</div>
                </div>
              )
            })}
          </TabsContent>

          {/* ── Pipeline ── */}
          <TabsContent value="pipeline" className="space-y-5 mt-0">
            {(['30', '60', '90'] as const).map(window => {
              const closures = n(pipeline[`p${window}_closures` as keyof typeof pipeline])
              const coverage = closures > 0
                ? (closures * settings.avg_deal_value / targets.monthly_arr).toFixed(1) + 'x'
                : '—'
              const coverageNum = closures > 0 ? closures * settings.avg_deal_value / targets.monthly_arr : 0
              const coverageColor = coverageNum >= 2 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : coverageNum > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-400 bg-slate-50 border-slate-200'
              return (
                <div key={window} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Next {window} Days</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Expected Closures</Label>
                      <Input type="number" min="0"
                        value={pipeline[`p${window}_closures` as keyof typeof pipeline]}
                        onChange={e => setPipeline(p => ({ ...p, [`p${window}_closures`]: e.target.value }))}
                        className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 h-9 text-center font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">SQLs in Pipeline</Label>
                      <Input type="number" min="0"
                        value={pipeline[`p${window}_sqls` as keyof typeof pipeline]}
                        onChange={e => setPipeline(p => ({ ...p, [`p${window}_sqls`]: e.target.value }))}
                        className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 h-9 text-center font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Pipeline Value ($)</Label>
                      <Input type="number" min="0"
                        value={pipeline[`p${window}_value` as keyof typeof pipeline]}
                        onChange={e => setPipeline(p => ({ ...p, [`p${window}_value`]: e.target.value }))}
                        className="border-indigo-200 focus-visible:ring-indigo-500/30 bg-indigo-50/30 h-9 text-center font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Coverage vs Monthly</Label>
                      <div className={`h-9 flex items-center justify-center text-sm font-bold rounded-md border ${coverageColor}`}>
                        {coverage}
                      </div>
                    </div>
                  </div>
                  {window !== '90' && <Separator className="bg-slate-100" />}
                </div>
              )
            })}
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes" className="space-y-4 mt-0">
            {[
              { key: 'wins'       as const, label: '🏆 Top 3 wins this month',                   placeholder: 'What worked well...' },
              { key: 'blockers'   as const, label: '🚧 Top 3 blockers',                           placeholder: 'What\'s slowing us down...' },
              { key: 'experiment' as const, label: '🧪 1 big experiment running',                 placeholder: 'What we\'re testing...' },
              { key: 'support'    as const, label: '🙋 Support needed from founder',              placeholder: 'What you need from Maanoj...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{label}</Label>
                <Textarea
                  value={notes[key]}
                  onChange={e => setNotes(p => ({ ...p, [key]: e.target.value }))}
                  rows={3}
                  placeholder={placeholder}
                  className="border-indigo-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 bg-indigo-50/20 resize-none text-sm"
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
