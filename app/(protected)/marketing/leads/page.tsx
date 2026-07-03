import { createClient } from '@/lib/supabase/server'
import { deriveTargets } from '@/lib/calculations'
import { Panel, PageHero } from '@/components/marketing/ui/panel'
import { DonutChart, HBarChart, VBarChart, RadialGauge } from '@/components/marketing/charts/dashboard-charts'
import AddLeadForm from '@/components/marketing/leads/add-lead-form'
import ImportLeads from '@/components/marketing/leads/import-leads'
import LeadsTable from '@/components/marketing/leads/leads-table'
import {
  classifyLeadSource, CATEGORY_STYLES,
  DIGITAL_MQL_SOURCES, EVENT_SQL_SOURCES, DIRECT_SQL_SOURCES, LEAD_STAGES,
  ASSIGNEE_SUGGESTIONS, CLOSED_WON_STAGE, hoursToSeats, formatSeats,
  annualContractValue, formatUSD,
  fiscalYearStart, fiscalYearLabel, FISCAL_MONTHS, FISCAL_QUARTERS,
} from '@/lib/leads'
import type { Settings, Lead } from '@/types'
import {
  Users, Zap, Trophy, Layers, BookOpen, Inbox, ArrowUpRight,
  Target, DollarSign, Repeat, Sparkles, Armchair, Database,
} from 'lucide-react'

export default async function LeadsPage() {
  const supabase = await createClient()
  const [{ data: settingsRows }, { data: leadRows }] = await Promise.all([
    supabase.from('marketing_settings').select('*').limit(1),
    supabase.from('leads').select('*').order('sr_no', { ascending: false }),
  ])

  const settings = settingsRows?.[0] as Settings | undefined
  const targets = settings ? deriveTargets(settings) : null
  const leads = (leadRows ?? []) as Lead[]

  // ── classification rollup ──
  const withCat = leads.map(l => ({ ...l, cat: classifyLeadSource(l.lead_source) }))
  const digitalMql = withCat.filter(l => l.cat === 'Digital MQL').length
  const directSql  = withCat.filter(l => l.cat === 'Direct SQL').length
  const eventSql   = withCat.filter(l => l.cat === 'Event SQL').length
  const totalSql   = directSql + eventSql

  // ── chart data ──
  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.lead_source || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byStage = LEAD_STAGES
    .map(stage => ({ name: stage.replace(' = Converted to Deal', ''), value: leads.filter(l => l.lead_stage === stage).length }))
    .filter(d => d.value > 0)

  // leads grouped by Data Source (free-text) — top 10 + "Other" tail
  const byDataSourceAll = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      const k = l.data_source?.trim() || 'Unspecified'
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const DS_TOP = 10
  const byDataSource = byDataSourceAll.length > DS_TOP
    ? [...byDataSourceAll.slice(0, DS_TOP), { name: `Other (${byDataSourceAll.length - DS_TOP})`, value: byDataSourceAll.slice(DS_TOP).reduce((s, d) => s + d.value, 0) }]
    : byDataSourceAll

  // ── Seats Closed statistics (Closed Won only) — Indian fiscal year (Apr→Mar) ──
  const seatsTarget = settings?.annual_seats_target ?? 100   // annual seats goal (editable in Settings)
  const monthlyTarget = seatsTarget / 12                      // ≈ 8.3
  const quarterlyTarget = seatsTarget / 4                     // 25
  const fyStartYear = fiscalYearStart(new Date())
  const fyLabel = fiscalYearLabel(fyStartYear)                // e.g. "FY 2026-27"
  const fyStart = `${fyStartYear}-04-01`
  const fyEnd   = `${fyStartYear + 1}-03-31`

  const won = leads.filter(l => l.lead_stage === CLOSED_WON_STAGE)
  // closed within this fiscal year (ISO date strings sort lexicographically)
  const wonFY = won.filter(l => { const d = l.closed_date ?? ''; return d >= fyStart && d <= fyEnd })

  const sum = (arr: Lead[], k: 'closed_hours' | 'mrr_value' | 'one_time_revenue') =>
    arr.reduce((s, l) => s + (Number(l[k]) || 0), 0)

  const seatsFY   = hoursToSeats(sum(wonFY, 'closed_hours'))
  const mrrFY     = sum(wonFY, 'mrr_value')
  const oneTimeFY = sum(wonFY, 'one_time_revenue')
  const acvFY     = annualContractValue(mrrFY, oneTimeFY)
  const wonCount  = wonFY.length
  const avgSeats  = wonCount ? seatsFY / wonCount : 0

  // seats per month in fiscal order (Apr → Mar)
  const seatsByMonth = FISCAL_MONTHS.map(({ name, mm }) => {
    const hours = wonFY.filter(l => (l.closed_date ?? '').slice(5, 7) === mm).reduce((s, l) => s + (Number(l.closed_hours) || 0), 0)
    return { name, value: Number(hoursToSeats(hours).toFixed(2)) }
  })

  // seats per fiscal quarter (Q1 = Apr-Jun … Q4 = Jan-Mar)
  const seatsByQuarter = FISCAL_QUARTERS.map(q => {
    const hours = wonFY.filter(l => q.months.includes((l.closed_date ?? '').slice(5, 7))).reduce((s, l) => s + (Number(l.closed_hours) || 0), 0)
    return { label: q.label, seats: hoursToSeats(hours) }
  })

  // seats by funnel category
  const seatsByCategory = (['Digital MQL', 'Direct SQL', 'Event SQL'] as const)
    .map(cat => ({
      name: cat,
      value: Number(hoursToSeats(wonFY.filter(l => classifyLeadSource(l.lead_source) === cat).reduce((s, l) => s + (Number(l.closed_hours) || 0), 0)).toFixed(2)),
    }))
    .filter(d => d.value > 0)

  // seats by owner / SDR
  const seatsByOwner = Object.entries(
    wonFY.reduce<Record<string, number>>((acc, l) => {
      const who = l.assigned_to?.trim() || 'Unassigned'
      acc[who] = (acc[who] ?? 0) + (Number(l.closed_hours) || 0)
      return acc
    }, {})
  ).map(([name, hours]) => ({ name, value: Number(hoursToSeats(hours).toFixed(2)) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // ── autocomplete suggestions ──
  const distinct = (key: keyof Lead) => Array.from(new Set(leads.map(l => (l[key] as string)).filter(Boolean))).sort()
  const existingEmails = leads.map(l => (l.email || '').trim().toLowerCase()).filter(Boolean)
  const dataSourceSuggestions = distinct('data_source')
  const industrySuggestions = distinct('industry')
  const serviceSuggestions = distinct('service_required')
  const assigneeSuggestions = Array.from(new Set([...ASSIGNEE_SUGGESTIONS, ...distinct('assigned_to')]))

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-[1400px] mx-auto">

      <PageHero
        icon={Inbox}
        title="Leads"
        subtitle="Add leads here — each one auto-associates to the funnel based on its Lead Source"
        action={
          <div className="flex items-center gap-2">
            <ImportLeads existingEmails={existingEmails} />
            <AddLeadForm
              dataSourceSuggestions={dataSourceSuggestions}
              industrySuggestions={industrySuggestions}
              serviceSuggestions={serviceSuggestions}
              assigneeSuggestions={assigneeSuggestions}
            />
          </div>
        }
      />

      {/* ── Rollup cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RollupCard icon={Inbox}  label="Total Leads"  value={leads.length}  foot="all-time"
          gradient="from-slate-600 to-slate-800" glow="" />
        <RollupCard icon={Users}  label="Digital MQLs" value={digitalMql}
          foot={targets ? `target ${targets.monthly_mqls.toFixed(0)}/mo` : 'Email · Social · Paid · Chatbot · Webinar'}
          gradient="from-indigo-500 via-indigo-600 to-violet-700" glow="glow-indigo" />
        <RollupCard icon={Zap}    label="Direct SQLs"  value={directSql}
          foot="Direct · Organic · Referral · Calling · Partner · Self-Gen"
          gradient="from-emerald-500 via-teal-600 to-cyan-700" glow="glow-emerald" />
        <RollupCard icon={Trophy} label="Event SQLs"   value={eventSql}
          foot={targets ? `target ${(targets.event_sqls / 12).toFixed(0)}/mo` : 'Event'}
          gradient="from-fuchsia-500 via-purple-600 to-pink-700" glow="glow-violet" />
      </div>

      {/* ── Seats Closed performance (Closed Won only) ── */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Armchair className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <h2 className="text-base font-extrabold text-slate-800">Seats Closed — {fyLabel}</h2>
        <span className="text-xs text-slate-400 font-medium">Closed Won deals only · Apr–Mar · 160 hrs = 1 seat</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RollupCard icon={Armchair} label="Seats Closed" value={formatSeats(seatsFY)}
          foot={`${wonCount} deal${wonCount === 1 ? '' : 's'} · avg ${formatSeats(avgSeats)}/deal`}
          gradient="from-emerald-500 via-teal-600 to-cyan-700" glow="glow-emerald" />
        <RollupCard icon={Repeat} label="MRR Closed" value={formatUSD(mrrFY)}
          foot="monthly recurring"
          gradient="from-indigo-500 via-indigo-600 to-violet-700" glow="glow-indigo" />
        <RollupCard icon={DollarSign} label="One-time Closed" value={formatUSD(oneTimeFY)}
          foot="one-time revenue"
          gradient="from-violet-500 via-purple-600 to-fuchsia-700" glow="glow-violet" />
        <RollupCard icon={Sparkles} label="ACV Closed" value={formatUSD(acvFY)}
          foot="MRR × 12 + one-time"
          gradient="from-amber-500 via-orange-600 to-rose-600" glow="glow-amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* gauge + quarterly */}
        <Panel icon={Target} title="Seats vs Annual Target" accent="emerald"
          caption={`Goal ${seatsTarget} seats/yr · ${quarterlyTarget}/qtr · ${monthlyTarget.toFixed(1)}/mo`}>
          <div className="flex flex-col items-center pt-1">
            <RadialGauge value={seatsFY} max={seatsTarget} label="of target" color="#10b981" />
            <p className="text-center text-2xl font-extrabold text-slate-800 tabular-nums mt-2">
              {formatSeats(seatsFY)}<span className="text-base text-slate-400 font-bold"> / {seatsTarget}</span>
            </p>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">seats closed</p>
            <div className="grid grid-cols-4 gap-1.5 w-full mt-4">
              {seatsByQuarter.map(q => (
                <div key={q.label} className="rounded-lg bg-slate-50 ring-1 ring-slate-100 px-1 py-2 text-center">
                  <p className="text-[10px] font-bold text-slate-400">{q.label}</p>
                  <p className="text-sm font-extrabold text-slate-700 tabular-nums">{formatSeats(q.seats)}</p>
                  <p className="text-[9px] text-slate-400">/ {quarterlyTarget}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* monthly trend */}
        <Panel icon={Armchair} title="Seats Closed per Month" accent="indigo"
          caption={`${fyLabel} · Apr→Mar · dashed line = monthly pace (${monthlyTarget.toFixed(1)})`} className="lg:col-span-2">
          <div className="pt-1">
            <VBarChart data={seatsByMonth} unit=" seats" target={Number(monthlyTarget.toFixed(2))} targetLabel={`pace ${monthlyTarget.toFixed(1)}`} />
          </div>
        </Panel>
      </div>

      {(seatsByCategory.length > 0 || seatsByOwner.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel icon={Layers} title="Seats by Funnel Category" accent="violet">
            <div className="pt-2">
              {seatsByCategory.length > 0
                ? <HBarChart data={seatsByCategory} unit=" seats" />
                : <EmptyHint text="No closed-won seats yet" />}
            </div>
          </Panel>
          <Panel icon={Users} title="Seats by Owner" accent="emerald">
            <div className="pt-2">
              {seatsByOwner.length > 0
                ? <HBarChart data={seatsByOwner} unit=" seats" />
                : <EmptyHint text="No closed-won seats yet" />}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Classification legend ── */}
      <Panel icon={BookOpen} title="How leads map to the funnel" accent="amber"
        caption="Reference — every Lead Source is auto-classified by these rules">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <LegendBlock title="Digital MQL" cat="Digital MQL" sources={DIGITAL_MQL_SOURCES}
            note="Top-of-funnel — must convert to an SQL" />
          <LegendBlock title="Direct SQL" cat="Direct SQL" sources={DIRECT_SQL_SOURCES}
            note="Sales-qualified on arrival — skips the MQL stage" />
          <LegendBlock title="Event SQL" cat="Event SQL" sources={EVENT_SQL_SOURCES}
            note="Conference / exhibition sourced — tracked separately" />
        </div>
      </Panel>

      {/* ── Charts ── */}
      {leads.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel icon={Layers} title="Leads by Source" accent="violet">
            <div className="pt-2">
              <DonutChart data={bySource} centerValue={leads.length.toString()} centerLabel="Leads" />
            </div>
          </Panel>
          <Panel icon={Zap} title="Leads by Stage" accent="indigo">
            <div className="pt-2"><HBarChart data={byStage} /></div>
          </Panel>
          <Panel icon={Database} title="Leads by Data Source" accent="emerald" className="lg:col-span-2"
            caption={byDataSourceAll.length > DS_TOP ? `Top ${DS_TOP} of ${byDataSourceAll.length} sources` : undefined}>
            <div className="pt-2"><HBarChart data={byDataSource} /></div>
          </Panel>
        </div>
      ) : null}

      {/* ── Leads table (interactive: column toggles, inline source, edit) ── */}
      <LeadsTable
        leads={leads}
        dataSourceSuggestions={dataSourceSuggestions}
        industrySuggestions={industrySuggestions}
        serviceSuggestions={serviceSuggestions}
        assigneeSuggestions={assigneeSuggestions}
      />
    </div>
  )
}

/* ── local components ── */

function RollupCard({ icon: Icon, label, value, foot, gradient, glow }: {
  icon: React.ElementType; label: string; value: number | string; foot: string; gradient: string; glow: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 hover-lift ${glow}`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" aria-hidden />
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/25 mb-3">
          <Icon className="text-white" style={{ width: 18, height: 18 }} strokeWidth={2.5} />
        </div>
        <p className="text-3xl font-extrabold text-white leading-none tabular-nums">{value}</p>
        <p className="text-[11px] font-bold text-white/75 uppercase tracking-widest mt-2">{label}</p>
        <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1 leading-tight">
          <ArrowUpRight className="h-3 w-3 shrink-0" /> {foot}
        </p>
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 py-8 text-center">{text}</p>
}

function LegendBlock({ title, cat, sources, note }: {
  title: string; cat: 'Digital MQL' | 'Direct SQL' | 'Event SQL'; sources: string[]; note: string
}) {
  return (
    <div className="rounded-xl ring-1 ring-slate-100 p-4 bg-slate-50/50">
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 ring-1 ${CATEGORY_STYLES[cat].badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STYLES[cat].dot}`} />
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {sources.map(s => (
          <span key={s} className="text-[11px] font-medium text-slate-600 bg-white ring-1 ring-slate-200 rounded-md px-2 py-0.5">{s}</span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{note}</p>
    </div>
  )
}
