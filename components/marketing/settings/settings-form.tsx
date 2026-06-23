'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/marketing/ui/card'
import { Input } from '@/components/marketing/ui/input'
import { Label } from '@/components/marketing/ui/label'
import { Button } from '@/components/marketing/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/marketing/ui/tabs'
import { Check, Loader2, Save } from 'lucide-react'
import type { Settings, Segment, Channel, PlanEvent } from '@/types'

interface Props {
  settings?: Settings
  segments: Segment[]
  channels: Channel[]
  events: PlanEvent[]
}

export default function SettingsForm({ settings, segments, channels, events }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [core, setCore] = useState({
    annual_seats_target:        settings?.annual_seats_target?.toString()       ?? '100',
    avg_deal_value:              settings?.avg_deal_value?.toString()            ?? '3000',
    sql_seat_conversion:         settings?.sql_seat_conversion?.toString()       ?? '0.25',
    event_sql_target:            settings?.event_sql_target?.toString()          ?? '150',
    digital_mql_sql_conversion:  settings?.digital_mql_sql_conversion?.toString() ?? '0.30',
    meeting_sql_conversion:      settings?.meeting_sql_conversion?.toString()    ?? '1.0',
  })

  const [segs, setSegs] = useState(segments.map(s => ({ ...s })))
  const [chs, setChs] = useState(channels.map(c => ({ ...c })))
  const [evts, setEvts] = useState(events.map(e => ({ ...e })))

  function n(v: string) { return parseFloat(v) || 0 }

  async function handleSave() {
    setSaving(true)

    const corePayload = {
      annual_seats_target:        n(core.annual_seats_target),
      avg_deal_value:              n(core.avg_deal_value),
      sql_seat_conversion:         n(core.sql_seat_conversion),
      event_sql_target:            n(core.event_sql_target),
      digital_mql_sql_conversion:  n(core.digital_mql_sql_conversion),
      meeting_sql_conversion:      n(core.meeting_sql_conversion),
      updated_at:                  new Date().toISOString(),
    }

    const ops = [
      settings?.id
        ? supabase.from('marketing_settings').update(corePayload).eq('id', settings.id)
        : supabase.from('marketing_settings').insert(corePayload),
      ...segs.map(s => supabase.from('segments').update({
        name:                 s.name,
        annual_seats_target:  n(s.annual_seats_target.toString()),
        avg_deal_value:       n(s.avg_deal_value.toString()),
        primary_channel:      s.primary_channel,
      }).eq('id', s.id)),
      ...chs.map(c => supabase.from('channels').update({
        name:                c.name,
        monthly_mql_target:  n(c.monthly_mql_target.toString()),
        mql_sql_conversion:  n(c.mql_sql_conversion.toString()),
        planning_notes:      c.planning_notes,
        owner_role:          c.owner_role,
      }).eq('id', c.id)),
      ...evts.map(e => supabase.from('plan_events').update({
        name:             e.name,
        quarter:          e.quarter,
        sql_target_min:   n(e.sql_target_min.toString()),
        sql_target_max:   n(e.sql_target_max.toString()),
        meetings_target:  n(e.meetings_target.toString()),
        primary_segment:  e.primary_segment,
        notes:            e.notes,
      }).eq('id', e.id)),
    ]

    await Promise.all(ops)
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 1500)
  }

  const fieldClass = "border-slate-200 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 h-9 text-sm"
  const labelClass = "text-xs font-semibold text-slate-600"

  return (
    <div className="space-y-5">

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-800 font-medium">
          💡 Changes affect all derived targets across every page
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`gap-1.5 font-bold min-w-[140px] rounded-xl border-0 text-white ${
            saved
              ? 'bg-emerald-600 hover:bg-emerald-600'
              : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500'
          }`}
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="h-4 w-4" /> Saved ✓</>
          ) : (
            <><Save className="h-4 w-4" /> Save All Changes</>
          )}
        </Button>
      </div>

      <Tabs defaultValue="core">
        <TabsList className="bg-slate-100 p-0.5 h-auto gap-0.5">
          {[
            { value: 'core',     label: 'Core Targets' },
            { value: 'segments', label: 'Segments'     },
            { value: 'channels', label: 'Channels'     },
            { value: 'events',   label: 'Events'       },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs font-semibold px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm text-slate-500 rounded-md transition-all"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Core Targets ── */}
        <TabsContent value="core" className="mt-4">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-bold text-slate-800">Annual Targets & Assumptions</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">These drive all calculated targets across the app</p>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'annual_seats_target',       label: 'Annual Seats Target',     hint: 'The North Star goal (e.g. 100)' },
                  { key: 'avg_deal_value',              label: 'Average Deal Value ($)',   hint: 'Blended average per seat (e.g. 3000)' },
                  { key: 'sql_seat_conversion',         label: 'SQL → Seat Conversion',   hint: 'e.g. 0.25 = 25% close rate' },
                  { key: 'event_sql_target',            label: 'Event SQL Target',         hint: 'Total SQLs from conferences' },
                  { key: 'digital_mql_sql_conversion',  label: 'Digital MQL→SQL Conv.',   hint: 'e.g. 0.30 = 30% conversion' },
                  { key: 'meeting_sql_conversion',      label: 'Meeting→SQL Conv.',        hint: 'e.g. 1.0 = SDR meetings → SQLs' },
                ].map(({ key, label, hint }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className={labelClass}>{label}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={core[key as keyof typeof core]}
                      onChange={e => setCore(p => ({ ...p, [key]: e.target.value }))}
                      className={fieldClass}
                    />
                    <p className="text-[11px] text-slate-400">{hint}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Segments ── */}
        <TabsContent value="segments" className="mt-4">
          <div className="space-y-3">
            {segs.map((seg, i) => (
              <Card key={seg.id} className="border-0 shadow-sm ring-1 ring-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
                    <p className="text-sm font-bold text-slate-700">{seg.name || `Segment ${i + 1}`}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                      <Label className={labelClass}>Segment Name</Label>
                      <Input
                        value={seg.name}
                        onChange={e => setSegs(p => p.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Annual Seats</Label>
                      <Input
                        type="number"
                        value={seg.annual_seats_target}
                        onChange={e => setSegs(p => p.map((s, j) => j === i ? { ...s, annual_seats_target: parseInt(e.target.value) || 0 } : s))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Avg Deal Value ($)</Label>
                      <Input
                        type="number"
                        value={seg.avg_deal_value}
                        onChange={e => setSegs(p => p.map((s, j) => j === i ? { ...s, avg_deal_value: parseInt(e.target.value) || 0 } : s))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                      <Label className={labelClass}>Primary Channel</Label>
                      <Input
                        value={seg.primary_channel}
                        onChange={e => setSegs(p => p.map((s, j) => j === i ? { ...s, primary_channel: e.target.value } : s))}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Channels ── */}
        <TabsContent value="channels" className="mt-4">
          <div className="space-y-3">
            {chs.map((ch, i) => (
              <Card key={ch.id} className="border-0 shadow-sm ring-1 ring-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <div className="w-1.5 h-5 rounded-full bg-violet-500" />
                    <p className="text-sm font-bold text-slate-700">{ch.name || `Channel ${i + 1}`}</p>
                    {ch.monthly_mql_target > 0 && (
                      <span className="ml-auto text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                        {ch.monthly_mql_target} MQL/mo
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className={labelClass}>Channel Name</Label>
                      <Input
                        value={ch.name}
                        onChange={e => setChs(p => p.map((c, j) => j === i ? { ...c, name: e.target.value } : c))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Monthly MQL Target</Label>
                      <Input
                        type="number"
                        value={ch.monthly_mql_target}
                        onChange={e => setChs(p => p.map((c, j) => j === i ? { ...c, monthly_mql_target: parseInt(e.target.value) || 0 } : c))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>MQL→SQL Conv. (e.g. 0.40)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={ch.mql_sql_conversion}
                        onChange={e => setChs(p => p.map((c, j) => j === i ? { ...c, mql_sql_conversion: parseFloat(e.target.value) || 0 } : c))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Owner Role</Label>
                      <Input
                        value={ch.owner_role}
                        onChange={e => setChs(p => p.map((c, j) => j === i ? { ...c, owner_role: e.target.value } : c))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-3">
                      <Label className={labelClass}>Planning Notes</Label>
                      <Input
                        value={ch.planning_notes}
                        onChange={e => setChs(p => p.map((c, j) => j === i ? { ...c, planning_notes: e.target.value } : c))}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Events ── */}
        <TabsContent value="events" className="mt-4">
          <div className="space-y-3">
            {evts.map((evt, i) => (
              <Card key={evt.id} className="border-0 shadow-sm ring-1 ring-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
                    <p className="text-sm font-bold text-slate-700">{evt.name || `Event ${i + 1}`}</p>
                    <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                      {evt.quarter}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label className={labelClass}>Event Name</Label>
                      <Input
                        value={evt.name}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, name: e.target.value } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Quarter</Label>
                      <Input
                        value={evt.quarter}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, quarter: e.target.value } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>SQL Min</Label>
                      <Input
                        type="number"
                        value={evt.sql_target_min}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, sql_target_min: parseInt(e.target.value) || 0 } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>SQL Max</Label>
                      <Input
                        type="number"
                        value={evt.sql_target_max}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, sql_target_max: parseInt(e.target.value) || 0 } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Meetings Target</Label>
                      <Input
                        type="number"
                        value={evt.meetings_target}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, meetings_target: parseInt(e.target.value) || 0 } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Primary Segment</Label>
                      <Input
                        value={evt.primary_segment}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, primary_segment: e.target.value } : ev))}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className={labelClass}>Notes</Label>
                      <Input
                        value={evt.notes}
                        onChange={e => setEvts(p => p.map((ev, j) => j === i ? { ...ev, notes: e.target.value } : ev))}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
