'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'

/* Vibrant shared palette */
export const PALETTE = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#0ea5e9']

/* ──────────────────────────────────────────────────────────────────────────
   Conversion Funnel — custom, bold, gradient bars with stage conversions
   ────────────────────────────────────────────────────────────────────────── */
export function ConversionFunnel({
  stages,
}: {
  stages: { label: string; value: number; gradient: string; sub?: string }[]
}) {
  const max = Math.max(...stages.map(s => s.value), 1)
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = Math.max((stage.value / max) * 100, 8)
        const prev = i > 0 ? stages[i - 1].value : null
        const conv = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null
        return (
          <div key={stage.label}>
            {conv !== null && (
              <div className="flex items-center justify-center -mt-1 mb-1">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  ↓ {conv}% convert
                </span>
              </div>
            )}
            <div className="relative">
              <div
                className={`h-14 rounded-xl bg-gradient-to-r ${stage.gradient} flex items-center justify-between px-4 shadow-sm transition-all duration-700`}
                style={{ width: `${pct}%`, minWidth: '160px' }}
              >
                <span className="text-xs font-bold text-white/90 uppercase tracking-wide drop-shadow-sm">
                  {stage.label}
                </span>
                <span className="text-xl font-extrabold text-white drop-shadow-sm tabular-nums">
                  {stage.value.toLocaleString()}
                </span>
              </div>
              {stage.sub && (
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 whitespace-nowrap font-medium">
                  {stage.sub}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Donut chart with center label
   ────────────────────────────────────────────────────────────────────────── */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  unit = '',
}: {
  data: { name: string; value: number }[]
  centerValue: string
  centerLabel: string
  unit?: string
}) {
  const filtered = data.filter(d => d.value > 0)
  const total = filtered.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-[160px] h-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              stroke="none"
            >
              {filtered.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                fontSize: 12,
                padding: '8px 12px',
              }}
              formatter={(value) => [`${Number(value).toLocaleString()}${unit}`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-slate-800 leading-none tabular-nums">{centerValue}</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{centerLabel}</span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {filtered.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={d.name} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="text-xs font-medium text-slate-600 flex-1 truncate">{d.name}</span>
              <span className="text-xs font-bold text-slate-800 tabular-nums">{d.value.toLocaleString()}{unit}</span>
              <span className="text-[10px] font-semibold text-slate-400 tabular-nums w-9 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Horizontal bar chart
   ────────────────────────────────────────────────────────────────────────── */
export function HBarChart({
  data,
  unit = '',
}: {
  data: { name: string; value: number }[]
  unit?: string
}) {
  return (
    <div className="w-full" style={{ height: Math.max(data.length * 46, 120) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }} barCategoryGap={10}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke="#eef0f5" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{
              borderRadius: 12, border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, padding: '8px 12px',
            }}
            formatter={(value) => [`${Number(value).toLocaleString()}${unit}`, '']}
          />
          <Bar dataKey="value" fill="url(#barGrad)" radius={[0, 8, 8, 0]} label={{ position: 'right', fontSize: 11, fontWeight: 700, fill: '#475569' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Vertical bar chart (e.g. seats closed per month) with optional target line
   ────────────────────────────────────────────────────────────────────────── */
export function VBarChart({
  data,
  unit = '',
  target,
  targetLabel,
}: {
  data: { name: string; value: number }[]
  unit?: string
  target?: number
  targetLabel?: string
}) {
  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 16, left: -12, bottom: 4 }} barCategoryGap={8}>
          <defs>
            <linearGradient id="vbarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eef0f5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals width={40} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, padding: '8px 12px' }}
            formatter={(value) => [`${Number(value).toLocaleString()}${unit}`, '']}
          />
          {typeof target === 'number' && target > 0 && (
            <ReferenceLine
              y={target}
              stroke="#f43f5e"
              strokeDasharray="5 4"
              label={{ value: targetLabel ?? `target ${target}`, position: 'insideTopRight', fontSize: 10, fill: '#f43f5e', fontWeight: 700 }}
            />
          )}
          <Bar dataKey="value" fill="url(#vbarGrad)" radius={[8, 8, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Grouped vertical bar chart (two series per week)
   ────────────────────────────────────────────────────────────────────────── */
export function GroupedVBarChart({
  data,
  series,
}: {
  data: Record<string, string | number>[]
  series: { key: string; label: string; color: string }[]
}) {
  return (
    <div className="w-full" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }} barCategoryGap="28%" barGap={2}>
          <CartesianGrid vertical={false} stroke="#eef0f5" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 12, padding: '8px 12px' }}
            formatter={(value, key) => {
              const s = series.find(s => s.key === key)
              return [value, s?.label ?? String(key)]
            }}
          />
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
   Radial progress gauge
   ────────────────────────────────────────────────────────────────────────── */
export function RadialGauge({
  value,
  max,
  label,
  color = '#6366f1',
}: {
  value: number
  max: number
  label: string
  color?: string
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const data = [{ name: label, value: pct, fill: color }]
  return (
    <div className="relative w-[150px] h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={20} background={{ fill: '#eef0f5' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-extrabold text-slate-800 leading-none tabular-nums">{pct}%</span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{label}</span>
      </div>
    </div>
  )
}
