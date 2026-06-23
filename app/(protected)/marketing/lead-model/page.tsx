import { createClient } from '@/lib/supabase/server'
import { deriveTargets, formatCurrency, formatPercent } from '@/lib/calculations'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/marketing/ui/table'
import { Panel, Th, Pill, ConvBadge, QuarterPill, PageHero } from '@/components/marketing/ui/panel'
import { HBarChart } from '@/components/marketing/charts/dashboard-charts'
import type { Settings, Segment, Channel, PlanEvent } from '@/types'
import { TrendingUp, BarChart2, CalendarDays, CheckCircle2, AlertCircle, Layers } from 'lucide-react'

export default async function LeadModelPage() {
  const supabase = await createClient()
  const [
    { data: settingsRows },
    { data: segments },
    { data: channels },
    { data: events },
  ] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('segments').select('*').order('sort_order'),
    supabase.from('channels').select('*').order('sort_order'),
    supabase.from('plan_events').select('*').order('sort_order'),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  if (!settings) return <div className="flex items-center justify-center h-64 text-slate-400">Configure settings first.</div>

  const targets = deriveTargets(settings)
  const segs = (segments ?? []) as Segment[]
  const chs = (channels ?? []) as Channel[]
  const evts = (events ?? []) as PlanEvent[]

  const totalAnnualMQL = chs.reduce((s, c) => s + c.monthly_mql_target * 12, 0)
  const totalAnnualSQL = chs.reduce((s, c) => s + Math.round(c.monthly_mql_target * c.mql_sql_conversion * 12), 0)
  const digitalSQLsMet = totalAnnualSQL >= targets.digital_sqls

  const mqlByChannel = chs
    .filter(c => c.monthly_mql_target > 0)
    .map(c => ({ name: c.name, value: c.monthly_mql_target * 12 }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1400px] mx-auto">

      <PageHero icon={TrendingUp} title="Lead Model" subtitle="Business math from seats → SQLs → meetings → MQLs, split by segment and channel" />

      {/* ── Linked controls ── */}
      <Panel icon={BarChart2} title="Linked Controls" accent="indigo" caption="Derived from your KPI Scorecard assumptions">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Annual seats',         value: settings.annual_seats_target.toString(),            sub: `${(settings.annual_seats_target / 12).toFixed(1)}/mo`,    primary: true },
            { label: 'Required annual SQLs',  value: targets.annual_sqls.toString(),                    sub: `${targets.monthly_sqls.toFixed(1)}/mo`,                   primary: true },
            { label: 'Event SQL target',      value: targets.event_sqls.toString(),                     sub: `${(targets.event_sqls / 12).toFixed(1)}/mo`,              primary: false },
            { label: 'Digital SQL target',    value: targets.digital_sqls.toString(),                   sub: `${targets.monthly_digital_sqls.toFixed(1)}/mo`,           primary: false },
            { label: 'MQL→SQL conv.',         value: formatPercent(settings.digital_mql_sql_conversion), sub: 'blended',                                                primary: false },
            { label: 'Required digital MQLs', value: targets.digital_mqls.toString(),                   sub: `${targets.monthly_mqls.toFixed(1)}/mo`,                  primary: true },
            { label: 'Meeting→SQL conv.',     value: formatPercent(settings.meeting_sql_conversion),    sub: 'SDR-sourced',                                            primary: false },
            { label: 'Required meetings',     value: targets.digital_meetings.toString(),               sub: `${targets.monthly_meetings.toFixed(1)}/mo`,               primary: false },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-3.5 ring-1 ${item.primary ? 'bg-indigo-50/60 ring-indigo-100' : 'bg-slate-50 ring-slate-100'}`}>
              <p className="text-[11px] font-medium text-slate-400 leading-tight">{item.label}</p>
              <p className={`text-2xl font-extrabold leading-none mt-1.5 tabular-nums ${item.primary ? 'text-indigo-700' : 'text-slate-800'}`}>{item.value}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Segment planning ── */}
      <Panel icon={BarChart2} title="Segment Planning Model" accent="violet" noPad>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
              <Th className="pl-5">Segment</Th>
              <Th right>Seats</Th>
              <Th right>Close Rate</Th>
              <Th right>SQLs Needed</Th>
              <Th right>Monthly SQL</Th>
              <Th>Primary Channel</Th>
              <Th right>Deal Value</Th>
              <Th right className="pr-5">ARR</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segs.map(seg => {
              const sqls = seg.annual_seats_target > 0 ? Math.ceil(seg.annual_seats_target / settings.sql_seat_conversion) : 0
              return (
                <TableRow key={seg.id} className="hover:bg-violet-50/30 transition-colors border-b border-slate-50 last:border-0">
                  <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{seg.name}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{seg.annual_seats_target}</TableCell>
                  <TableCell className="text-right"><span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">{formatPercent(settings.sql_seat_conversion)}</span></TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{sqls || '—'}</TableCell>
                  <TableCell className="text-right"><Pill>{sqls ? Math.ceil(sqls / 12) : '—'}</Pill></TableCell>
                  <TableCell className="text-sm text-slate-500">{seg.primary_channel}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{formatCurrency(seg.avg_deal_value)}/mo</TableCell>
                  <TableCell className="text-right font-bold text-slate-800 tabular-nums pr-5">{formatCurrency(seg.annual_seats_target * seg.avg_deal_value * 12)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>

      {/* ── MQL build-up: chart + table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-2" icon={Layers} title="Annual MQL by Channel" accent="amber" caption="Where top-of-funnel volume comes from">
          <div className="pt-2"><HBarChart data={mqlByChannel} /></div>
        </Panel>

        <Panel className="lg:col-span-3" icon={TrendingUp} title="Digital MQL Build-Up" accent="emerald" noPad>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
                <Th className="pl-5">Channel</Th>
                <Th right>Mo MQL</Th>
                <Th right>Conv</Th>
                <Th right>Mo SQL</Th>
                <Th right>Yr MQL</Th>
                <Th right className="pr-5">Yr SQL</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chs.map(ch => {
                const conv = ch.mql_sql_conversion * 100
                return (
                  <TableRow key={ch.id} className="hover:bg-emerald-50/30 transition-colors border-b border-slate-50 last:border-0">
                    <TableCell className="font-semibold text-slate-800 py-3 pl-5">{ch.name}</TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">{ch.monthly_mql_target || '—'}</TableCell>
                    <TableCell className="text-right">{ch.mql_sql_conversion ? <ConvBadge pct={conv} /> : '—'}</TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">{ch.monthly_mql_target ? (ch.monthly_mql_target * ch.mql_sql_conversion).toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">{ch.monthly_mql_target ? ch.monthly_mql_target * 12 : '—'}</TableCell>
                    <TableCell className="text-right font-medium text-slate-800 tabular-nums pr-5">{ch.monthly_mql_target ? Math.round(ch.monthly_mql_target * ch.mql_sql_conversion * 12) : '—'}</TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="bg-gradient-to-r from-emerald-50 to-teal-50 font-bold border-t-2 border-emerald-100">
                <TableCell className="text-slate-900 py-3 pl-5">Total</TableCell>
                <TableCell className="text-right text-slate-700 tabular-nums">{chs.reduce((s, c) => s + c.monthly_mql_target, 0)}</TableCell>
                <TableCell />
                <TableCell className="text-right text-slate-700 tabular-nums">{chs.reduce((s, c) => s + c.monthly_mql_target * c.mql_sql_conversion, 0).toFixed(1)}</TableCell>
                <TableCell className="text-right text-slate-700 tabular-nums">{totalAnnualMQL}</TableCell>
                <TableCell className="text-right text-emerald-700 tabular-nums pr-5">{totalAnnualSQL}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className={`px-5 py-3 flex items-center gap-2.5 ${digitalSQLsMet ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            {digitalSQLsMet ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />}
            <p className={`text-sm font-medium ${digitalSQLsMet ? 'text-emerald-800' : 'text-amber-800'}`}>
              Generates <strong>{totalAnnualSQL}</strong> annual SQLs vs target <strong>{targets.digital_sqls}</strong> — {digitalSQLsMet ? `✓ ${totalAnnualSQL - targets.digital_sqls} above` : `⚠ ${targets.digital_sqls - totalAnnualSQL} below`}
            </p>
          </div>
        </Panel>
      </div>

      {/* ── Event planning ── */}
      <Panel icon={CalendarDays} title="Event SQL Planning" accent="fuchsia" noPad>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
              <Th className="pl-5">Event</Th>
              <Th>Quarter</Th>
              <Th right>SQL Target</Th>
              <Th right>Meetings</Th>
              <Th>Segment</Th>
              <Th className="pr-5">Notes</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evts.map(evt => (
              <TableRow key={evt.id} className="hover:bg-fuchsia-50/20 transition-colors border-b border-slate-50 last:border-0">
                <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{evt.name}</TableCell>
                <TableCell><QuarterPill>{evt.quarter}</QuarterPill></TableCell>
                <TableCell className="text-right font-medium text-slate-700 tabular-nums">{evt.sql_target_min === evt.sql_target_max ? evt.sql_target_min : `${evt.sql_target_min}–${evt.sql_target_max}`}</TableCell>
                <TableCell className="text-right text-slate-600 tabular-nums">{evt.meetings_target}</TableCell>
                <TableCell className="text-slate-600 text-sm">{evt.primary_segment}</TableCell>
                <TableCell className="text-slate-400 text-xs pr-5">{evt.notes}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gradient-to-r from-fuchsia-50 to-pink-50 font-bold border-t-2 border-fuchsia-100">
              <TableCell className="text-slate-900 py-3.5 pl-5">Total</TableCell>
              <TableCell />
              <TableCell className="text-right text-slate-700 tabular-nums">{evts.reduce((s, e) => s + e.sql_target_min, 0)}–{evts.reduce((s, e) => s + e.sql_target_max, 0)}</TableCell>
              <TableCell className="text-right text-slate-700 tabular-nums">{evts.reduce((s, e) => s + e.meetings_target, 0)}</TableCell>
              <TableCell /><TableCell className="pr-5" />
            </TableRow>
          </TableBody>
        </Table>
      </Panel>
    </div>
  )
}
