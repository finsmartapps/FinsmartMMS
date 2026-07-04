import type { ElementType } from 'react'
import { createClient } from '@/lib/supabase/server'
import { deriveTargets, formatCurrency, formatNumber, getStatus } from '@/lib/calculations'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/marketing/ui/table'
import type { Settings, Segment, Channel, PlanEvent } from '@/types'
import type { Lead } from '@/types'
import { ConversionFunnel, DonutChart, HBarChart, RadialGauge } from '@/components/marketing/charts/dashboard-charts'
import { Panel, Th, ConvBadge, QuarterPill } from '@/components/marketing/ui/panel'
import { hoursToSeats, formatSeats } from '@/lib/leads'
import {
  TrendingUp, Users, Zap, Trophy, Activity,
  ArrowUpRight, Layers, Radio,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: settingsRows },
    { data: segments },
    { data: channels },
    { data: events },
    { data: leadRows },
  ] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('segments').select('*').order('sort_order'),
    supabase.from('channels').select('*').order('sort_order'),
    supabase.from('plan_events').select('*').order('sort_order'),
    supabase.from('leads').select('*'),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  if (!settings) {
    return <div className="flex items-center justify-center h-64 text-slate-400">No settings found. Configure in Settings.</div>
  }

  const targets = deriveTargets(settings)
  const segs    = (segments ?? []) as Segment[]
  const chs     = (channels  ?? []) as Channel[]
  const evts    = (events    ?? []) as PlanEvent[]
  const leads   = (leadRows  ?? []) as Lead[]

  // ── Actuals from leads ───────────────────────────────────────────────────
  const YEAR     = new Date().getFullYear().toString()
  const ytdLeads = leads.filter(l => (l.lead_date ?? '').startsWith(YEAR))

  const isClosedBiz = (l: Lead) =>
    l.lead_stage === 'Closed Won' ||
    (l.lead_status === 'SQL' && ((l.mrr_value ?? 0) > 0 || (l.one_time_revenue ?? 0) > 0))

  const actualMqls      = ytdLeads.filter(l => l.lead_status === 'MQL').length
  const actualSqls      = ytdLeads.filter(l => l.lead_status === 'SQL').length
  const closedLeads     = leads.filter(isClosedBiz)
  const actualSeats     = closedLeads.reduce((s, l) => s + hoursToSeats(l.closed_hours ?? 0), 0)
  const actualMrr       = closedLeads.reduce((s, l) => s + (l.mrr_value ?? 0), 0)
  const actualCustomers = closedLeads.length

  const seatsStatus = getStatus(actualSeats, targets.monthly_seats * 3)
  const mqlStatus   = getStatus(actualMqls,  Math.round(targets.monthly_mqls  * (new Date().getMonth() + 1)))
  const sqlStatus   = getStatus(actualSqls,  Math.round(targets.monthly_sqls  * (new Date().getMonth() + 1)))

  // ── Chart data ──────────────────────────────────────────────────────────
  const funnelStages = [
    {
      label: 'Digital MQLs',
      value: targets.digital_mqls,
      gradient: 'from-indigo-500 to-indigo-600',
      sub: `${actualMqls} actual YTD · target ${targets.monthly_mqls.toFixed(0)}/mo`,
    },
    {
      label: 'Total SQLs',
      value: targets.annual_sqls,
      gradient: 'from-violet-500 to-purple-600',
      sub: `${actualSqls} actual YTD · target ${targets.monthly_sqls.toFixed(0)}/mo`,
    },
    {
      label: 'Meetings',
      value: targets.digital_meetings,
      gradient: 'from-fuchsia-500 to-pink-600',
      sub: `${targets.monthly_meetings.toFixed(0)}/mo target`,
    },
    {
      label: 'Seats Closed',
      value: settings.annual_seats_target,
      gradient: 'from-emerald-500 to-teal-600',
      sub: `${formatSeats(actualSeats)} actual · target ${targets.monthly_seats.toFixed(1)}/mo`,
    },
  ]

  const channelMix = chs
    .filter(c => c.monthly_mql_target > 0)
    .map(c => ({ name: c.name, value: c.monthly_mql_target }))

  const segmentArr = segs.map(s => ({ name: s.name, value: s.annual_seats_target * s.avg_deal_value * 12 }))

  const channelSql = chs
    .filter(c => c.monthly_mql_target > 0)
    .map(c => ({ name: c.name, value: Math.round(c.monthly_mql_target * c.mql_sql_conversion * 12) }))
    .sort((a, b) => b.value - a.value)

  const totalArr = segmentArr.reduce((s, d) => s + d.value, 0)
  const totalMql = channelMix.reduce((s, d) => s + d.value, 0)

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1400px] mx-auto">

      {/* ══ Hero banner ══════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 md:p-8 animate-rise">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-white/20 rounded-full blur-3xl animate-mesh" />
          <div className="absolute -bottom-24 left-1/3 w-72 h-72 bg-fuchsia-300/30 rounded-full blur-3xl animate-mesh" style={{ animationDelay: '3s' }} />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/80 bg-white/15 backdrop-blur rounded-full px-3 py-1 ring-1 ring-white/20 mb-3">
              <Radio className="h-3 w-3 animate-soft-pulse" /> Q2 2026 · Live
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Marketing Command Center</h1>
            <p className="text-sm text-white/70 mt-1.5 max-w-xl">
              Founder view of the {settings.annual_seats_target}-seat North Star — funnel health, channel mix, and segment performance at a glance.
            </p>
          </div>
          {/* Gauge: actual seats vs annual target */}
          <div className="flex flex-col items-center gap-1">
            <RadialGauge value={actualSeats} max={settings.annual_seats_target} label="Annual" color="#ffffff" />
            <p className="text-[11px] text-white/60 font-semibold">{formatSeats(actualSeats)} of {settings.annual_seats_target} seats</p>
          </div>
        </div>
      </div>

      {/* ══ KPI cards — actuals vs targets ═══════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Trophy}
          label="Seats Closed"
          value={formatSeats(actualSeats)}
          foot={`${actualCustomers} deals · of ${settings.annual_seats_target} annual target`}
          badge={seatsStatus}
          gradient="from-indigo-500 via-indigo-600 to-violet-700"
          glow="glow-indigo"
        />
        <KpiCard
          icon={TrendingUp}
          label="MRR Closed"
          value={formatCurrency(actualMrr)}
          foot={`monthly recurring · ${actualCustomers} customers`}
          gradient="from-violet-500 via-purple-600 to-fuchsia-700"
          glow="glow-violet"
        />
        <KpiCard
          icon={Zap}
          label="SQLs — YTD"
          value={formatNumber(actualSqls, 0)}
          foot={`target ${Math.round(targets.monthly_sqls * (new Date().getMonth() + 1))} YTD · ${targets.monthly_sqls.toFixed(0)}/mo`}
          badge={sqlStatus}
          gradient="from-emerald-500 via-teal-600 to-cyan-700"
          glow="glow-emerald"
        />
        <KpiCard
          icon={Users}
          label="MQLs — YTD"
          value={formatNumber(actualMqls, 0)}
          foot={`target ${Math.round(targets.monthly_mqls * (new Date().getMonth() + 1))} YTD · ${targets.monthly_mqls.toFixed(0)}/mo`}
          badge={mqlStatus}
          gradient="from-amber-500 via-orange-500 to-rose-600"
          glow="glow-amber"
        />
      </div>

      {/* ══ Actual snapshot strip ════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Leads',   value: leads.length,     sub: 'all-time in system' },
          { label: 'Customers',     value: actualCustomers,  sub: 'closed with revenue' },
          { label: 'Annual ARR',    value: formatCurrency(targets.annual_arr),  sub: 'target' },
          { label: 'ACV Pipeline',  value: formatCurrency(actualMrr * 12),  sub: 'MRR × 12 (closed)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white ring-1 ring-slate-100 px-5 py-4">
            <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{s.value}</p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">{s.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ══ Charts: Funnel + Channel mix ═════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3" icon={Activity} title="Annual Lead Funnel" accent="indigo"
          caption="Target volume cascade — actual YTD shown in sub-labels">
          <div className="pt-2 pr-16">
            <ConversionFunnel stages={funnelStages} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2" icon={Layers} title="Channel MQL Mix" accent="violet"
          caption={`${totalMql} MQLs / month across channels`}>
          <div className="pt-3">
            <DonutChart data={channelMix} centerValue={totalMql.toString()} centerLabel="MQL / mo" />
          </div>
        </Panel>
      </div>

      {/* ══ Charts: Segment ARR + Channel SQL ════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel icon={Trophy} title="ARR by Segment" accent="emerald"
          caption={`${formatCurrency(totalArr)} total pipeline value`}>
          <div className="pt-3">
            <DonutChart
              data={segmentArr}
              centerValue={formatCurrency(totalArr).replace('$', '$').replace(',000', 'K')}
              centerLabel="Total ARR"
            />
          </div>
        </Panel>

        <Panel icon={Zap} title="Annual SQL Output by Channel" accent="amber"
          caption="Projected SQLs each channel generates per year">
          <div className="pt-3">
            <HBarChart data={channelSql} />
          </div>
        </Panel>
      </div>

      {/* ══ Channel performance ══════════════════════════════════════════ */}
      <Panel icon={Layers} title="Channel Performance — Targets" accent="emerald" noPad>
        <DataTable>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-slate-100">
              <Th className="pl-5">Channel</Th>
              <Th right>Monthly MQL</Th>
              <Th right>MQL→SQL</Th>
              <Th right>Monthly SQL</Th>
              <Th right>Annual SQL</Th>
              <Th className="pr-5">Owner</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chs.map(ch => {
              const conv = ch.mql_sql_conversion * 100
              return (
                <TableRow key={ch.id} className="hover:bg-emerald-50/30 transition-colors border-b border-slate-50 last:border-0">
                  <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{ch.name}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{ch.monthly_mql_target || '—'}</TableCell>
                  <TableCell className="text-right">{ch.mql_sql_conversion ? <ConvBadge pct={conv} /> : '—'}</TableCell>
                  <TableCell className="text-right text-slate-600 tabular-nums">{ch.monthly_mql_target ? (ch.monthly_mql_target * ch.mql_sql_conversion).toFixed(1) : '—'}</TableCell>
                  <TableCell className="text-right font-medium text-slate-800 tabular-nums">{ch.monthly_mql_target ? Math.round(ch.monthly_mql_target * ch.mql_sql_conversion * 12) : '—'}</TableCell>
                  <TableCell className="text-slate-400 text-xs pr-5">{ch.owner_role}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="bg-gradient-to-r from-emerald-50 to-teal-50 font-bold border-t-2 border-emerald-100">
              <TableCell className="text-slate-900 py-3.5 pl-5">Total</TableCell>
              <TableCell className="text-right text-slate-700 tabular-nums">{chs.reduce((s, c) => s + c.monthly_mql_target, 0)}</TableCell>
              <TableCell />
              <TableCell className="text-right text-slate-700 tabular-nums">{chs.reduce((s, c) => s + c.monthly_mql_target * c.mql_sql_conversion, 0).toFixed(1)}</TableCell>
              <TableCell className="text-right text-emerald-700 tabular-nums">{chs.reduce((s, c) => s + Math.round(c.monthly_mql_target * c.mql_sql_conversion * 12), 0)}</TableCell>
              <TableCell className="pr-5" />
            </TableRow>
          </TableBody>
        </DataTable>
      </Panel>

      {/* ══ Event ROI ════════════════════════════════════════════════════ */}
      <Panel icon={Trophy} title="Event ROI Tracker" accent="amber" noPad>
        <DataTable>
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
              <TableRow key={evt.id} className="hover:bg-amber-50/30 transition-colors border-b border-slate-50 last:border-0">
                <TableCell className="font-semibold text-slate-800 py-3.5 pl-5">{evt.name}</TableCell>
                <TableCell><QuarterPill>{evt.quarter}</QuarterPill></TableCell>
                <TableCell className="text-right font-medium text-slate-700 tabular-nums">{evt.sql_target_min === evt.sql_target_max ? evt.sql_target_min : `${evt.sql_target_min}–${evt.sql_target_max}`}</TableCell>
                <TableCell className="text-right text-slate-600 tabular-nums">{evt.meetings_target}</TableCell>
                <TableCell className="text-slate-600 text-sm">{evt.primary_segment}</TableCell>
                <TableCell className="text-slate-400 text-xs pr-5">{evt.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </Panel>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Local presentational components
   ══════════════════════════════════════════════════════════════════════════ */

function KpiCard({
  icon: Icon, label, value, foot, badge, gradient, glow,
}: {
  icon: ElementType; label: string; value: string; foot: string
  badge?: 'On Track' | 'Watch'; gradient: string; glow: string
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 hover-lift ${glow} animate-rise`}>
      <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
            <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {badge && (
            <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 backdrop-blur ring-1 ${
              badge === 'On Track' ? 'bg-emerald-400/25 text-white ring-white/30' : 'bg-amber-300/25 text-white ring-white/30'
            }`}>
              {badge === 'On Track' ? '✓ On Track' : '⚡ Watch'}
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-extrabold text-white leading-tight mt-1 tabular-nums">{value}</p>
        <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3" /> {foot}
        </p>
      </div>
    </div>
  )
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <Table>{children}</Table>
}
