'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'

interface MeetingPoint { label: string; booked: number; completed: number }

function shortDate(val: unknown): string {
  const str = String(val)
  // YYYY-MM-DD → "14 May" | YYYY-MM → "May 24"
  if (str.length === 7) {
    const [y, m] = str.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

// One color per telecaller slot — extend if you ever have more than 5
const USER_COLORS = ['#FF9500', '#DC2626', '#3B82F6', '#34C759', '#8B5CF6']

interface TrendPoint { label: string; calls: number }
interface DailyPoint { date: string; calls: number; target: number; submitted: boolean }

export function TeamTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-[#AEAEB2] text-sm">No data for this period</div>
  )
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
        <XAxis
          dataKey="label"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: '#AEAEB2' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#AEAEB2' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          labelFormatter={(v) => shortDate(v)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: unknown) => [Number(v), 'Total Calls']) as any}
          cursor={{ fill: '#F5F5F7' }}
        />
        <Bar dataKey="calls" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface MultiUserChartProps {
  trendByUser: Record<string, TrendPoint[]>
  telecallers: { id: string; name: string }[]
}

export function MultiUserTrendChart({ trendByUser, telecallers }: MultiUserChartProps) {
  // Merge all users' data into shared label buckets
  const allLabels = Array.from(
    new Set(telecallers.flatMap(tc => (trendByUser[tc.id] ?? []).map(p => p.label)))
  ).sort()

  if (!allLabels.length) return (
    <div className="flex items-center justify-center h-40 text-[#AEAEB2] text-sm">No data for this period</div>
  )

  const merged = allLabels.map(label => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const point: Record<string, any> = { label }
    for (const tc of telecallers) {
      const match = (trendByUser[tc.id] ?? []).find(p => p.label === label)
      // Use null (not 0) for days with no submission so the line has gaps
      point[tc.name] = match ? match.calls : null
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={merged} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
        <XAxis
          dataKey="label"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: '#AEAEB2' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#AEAEB2' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          labelFormatter={(v) => shortDate(v)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: unknown, name: unknown) => [v !== null ? Number(v) : '—', name]) as any}
          cursor={{ stroke: '#E5E5EA', strokeWidth: 1 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        {telecallers.map((tc, i) => (
          <Line
            key={tc.id}
            type="monotone"
            dataKey={tc.name}
            stroke={USER_COLORS[i % USER_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: USER_COLORS[i % USER_COLORS.length], strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function MeetingsTrendChart({ data }: { data: MeetingPoint[] }) {
  const hasData = data.some(d => d.booked > 0 || d.completed > 0)
  if (!hasData) return (
    <div className="flex items-center justify-center h-40 text-[#AEAEB2] text-sm">No meetings for this period</div>
  )
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%" barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
        <XAxis
          dataKey="label"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: '#AEAEB2' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#AEAEB2' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          labelFormatter={(v) => shortDate(v)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: unknown, name: unknown) => [Number(v), name]) as any}
          cursor={{ fill: '#F5F5F7' }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="booked" name="Booked" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="completed" name="Completed" fill="#34C759" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function IndividualChart({ data, target }: { data: DailyPoint[]; target: number }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-40 text-[#AEAEB2] text-sm">No data for this period</div>
  )
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F7" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fontSize: 11, fill: '#AEAEB2' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#AEAEB2' }} axisLine={false} tickLine={false} />
        {target > 0 && (
          <ReferenceLine
            y={target}
            stroke="#FF9500"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: `Target ${target}`, position: 'insideTopRight', fontSize: 10, fill: '#FF9500' }}
          />
        )}
        <Tooltip
          contentStyle={{ borderRadius: 10, border: '1px solid #E5E5EA', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          labelFormatter={(v) => shortDate(v)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: unknown, _: unknown, props: any) => {
            const submitted = props?.payload?.submitted
            return [submitted ? Number(v) : '—', 'Calls']
          }) as any}
          cursor={{ fill: '#F5F5F7' }}
        />
        <Bar dataKey="calls" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                !entry.submitted
                  ? '#E5E5EA'
                  : target > 0 && entry.calls >= target
                  ? '#34C759'
                  : target > 0 && entry.calls >= target * 0.8
                  ? '#FF9500'
                  : '#DC2626'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
