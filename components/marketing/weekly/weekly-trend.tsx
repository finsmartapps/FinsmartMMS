import { Panel } from '@/components/marketing/ui/panel'
import { VBarChart } from '@/components/marketing/charts/dashboard-charts'
import { TrendingUp, Users, Zap } from 'lucide-react'

export interface WeekPoint {
  start: string
  end: string
  label: string   // short Monday label e.g. "Jun 1"
  range: string    // "Jun 1–7"
  mql: number      // achieved Digital MQLs that week
  sql: number      // achieved SQLs that week
}

interface Props {
  series: WeekPoint[]   // oldest → newest
  reqMql: number        // weekly required MQLs
  reqSql: number        // weekly required SQLs
}

function Delta({ achieved, required }: { achieved: number; required: number }) {
  const d = achieved - required
  const ok = d >= 0
  return (
    <span className={`inline-flex items-center justify-center min-w-10 text-xs font-bold tabular-nums rounded-md px-2 py-0.5 ${
      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
    }`}>
      {ok ? `+${d}` : d}
    </span>
  )
}

export default function WeeklyTrend({ series, reqMql, reqSql }: Props) {
  const mqlChart = series.map(s => ({ name: s.label, value: s.mql }))
  const sqlChart = series.map(s => ({ name: s.label, value: s.sql }))

  // totals across the window
  const totMql = series.reduce((s, w) => s + w.mql, 0)
  const totSql = series.reduce((s, w) => s + w.sql, 0)
  const weeks = series.length
  const hitMql = series.filter(w => w.mql >= reqMql).length
  const hitSql = series.filter(w => w.sql >= reqSql).length

  return (
    <div className="space-y-4">
      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel icon={Users} title="Weekly MQLs — achieved vs required" accent="indigo"
          caption={`MQL status leads by week · dashed line = required (${reqMql}/wk) · on track ${hitMql}/${weeks} wks`}>
          <div className="pt-1">
            <VBarChart data={mqlChart} unit=" MQL" target={reqMql} targetLabel={`req ${reqMql}`} />
          </div>
        </Panel>
        <Panel icon={Zap} title="Weekly SQLs — achieved vs required" accent="emerald"
          caption={`New SQLs by week · dashed line = required (${reqSql}/wk) · on track ${hitSql}/${weeks} wks`}>
          <div className="pt-1">
            <VBarChart data={sqlChart} unit=" SQL" target={reqSql} targetLabel={`req ${reqSql}`} />
          </div>
        </Panel>
      </div>

      {/* table */}
      <Panel icon={TrendingUp} title="Required vs Achieved — per week" accent="violet" noPad
        caption={`Achieved auto-counted from Leads · MQL = lead_status MQL by lead date · SQL = lead_status SQL by lead date`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 pl-5 text-left whitespace-nowrap">Week</th>
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 text-center">MQL req</th>
                <th className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider py-3 px-3 text-center">MQL got</th>
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 text-center">Δ</th>
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 text-center">SQL req</th>
                <th className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider py-3 px-3 text-center">SQL got</th>
                <th className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-3 px-3 pr-5 text-center">Δ</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map(w => (
                <tr key={w.start} className="hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-0">
                  <td className="py-2.5 px-3 pl-5 text-sm font-semibold text-slate-700 whitespace-nowrap">{w.range}</td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-400 tabular-nums">{reqMql}</td>
                  <td className="py-2.5 px-3 text-center text-sm font-bold text-slate-800 tabular-nums">{w.mql}</td>
                  <td className="py-2.5 px-3 text-center"><Delta achieved={w.mql} required={reqMql} /></td>
                  <td className="py-2.5 px-3 text-center text-sm text-slate-400 tabular-nums">{reqSql}</td>
                  <td className="py-2.5 px-3 text-center text-sm font-bold text-slate-800 tabular-nums">{w.sql}</td>
                  <td className="py-2.5 px-3 pr-5 text-center"><Delta achieved={w.sql} required={reqSql} /></td>
                </tr>
              ))}
              {/* totals */}
              <tr className="bg-slate-50/60 border-t border-slate-200">
                <td className="py-2.5 px-3 pl-5 text-sm font-bold text-slate-600 whitespace-nowrap">{weeks}-week total</td>
                <td className="py-2.5 px-3 text-center text-sm text-slate-400 tabular-nums">{reqMql * weeks}</td>
                <td className="py-2.5 px-3 text-center text-sm font-extrabold text-indigo-700 tabular-nums">{totMql}</td>
                <td className="py-2.5 px-3 text-center"><Delta achieved={totMql} required={reqMql * weeks} /></td>
                <td className="py-2.5 px-3 text-center text-sm text-slate-400 tabular-nums">{reqSql * weeks}</td>
                <td className="py-2.5 px-3 text-center text-sm font-extrabold text-emerald-700 tabular-nums">{totSql}</td>
                <td className="py-2.5 px-3 pr-5 text-center"><Delta achieved={totSql} required={reqSql * weeks} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
