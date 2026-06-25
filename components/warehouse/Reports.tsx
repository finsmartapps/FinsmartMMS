'use client'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Package, Truck, CalendarDays, Download, TrendingUp } from 'lucide-react'
import type { WmsData } from './useWarehouseStore'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        {payload.map((p: { color: string; name: string; value: number }, i: number) => (
          <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }
  return null
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub?: string; icon: React.ElementType; color: 'blue' | 'emerald' | 'amber'
}) {
  const c = {
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-600',    val: 'text-blue-600'    },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-600', val: 'text-emerald-600' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-600',   val: 'text-amber-600'   },
  }
  const cfg = c[color]
  return (
    <div className={`rounded-xl border ${cfg.border} bg-white p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}><Icon size={16} className={cfg.icon} /></div>
      </div>
      <p className={`text-3xl font-bold ${cfg.val}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Reports({ data }: { data: WmsData }) {
  const { items, events, shipments } = data

  const stats = useMemo(() => ({
    totalUnits:      items.reduce((a, b) => a + b.quantity, 0),
    totalShipments:  shipments.length,
    completedEvents: events.filter(e => e.status === 'completed').length,
    itemsMoved:      shipments.flatMap(s => s.items).reduce((a, b) => a + b.quantity, 0),
  }), [items, events, shipments])

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    items.forEach(i => { cats[i.category] = (cats[i.category] || 0) + i.quantity })
    return Object.entries(cats).map(([name, value]) => ({ name, value }))
  }, [items])

  const eventActivityData = useMemo(() =>
    events.slice(0, 6).map(ev => {
      const evShipments = shipments.filter(s => s.eventId === ev.id)
      const outQty = evShipments.filter(s => s.type === 'outbound').flatMap(s => s.items).reduce((a, b) => a + b.quantity, 0)
      const inQty  = evShipments.filter(s => s.type === 'inbound').flatMap(s => s.items).reduce((a, b) => a + b.quantity, 0)
      return { name: ev.name.split(' ').slice(0, 2).join(' '), Outbound: outQty, Returned: inQty }
    }), [events, shipments]
  )

  const topItems = useMemo(() => {
    const usage: Record<string, number> = {}
    shipments.forEach(s => s.items.forEach(line => { usage[line.itemId] = (usage[line.itemId] || 0) + line.quantity }))
    return Object.entries(usage)
      .map(([id, count]) => ({ item: items.find(i => i.id === id), count }))
      .filter(r => r.item)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6) as { item: WmsData['items'][0]; count: number }[]
  }, [shipments, items])

  const handleExportCSV = () => {
    const rows = [
      ['Label', 'Name', 'Category', 'Quantity', 'Unit', 'Min Stock', 'Status'],
      ...items.map(i => [i.label, i.name, i.category, i.quantity, i.unit, i.minStock, i.quantity <= i.minStock ? 'Low Stock' : 'In Stock'])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finsmart-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports & Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">Warehouse performance overview</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-lg shadow-emerald-900/30">
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Units"     value={stats.totalUnits}      sub="Across all SKUs"      icon={Package}      color="blue"    />
        <StatCard label="Total Shipments" value={stats.totalShipments}  sub="All time"             icon={Truck}        color="emerald" />
        <StatCard label="Events Served"   value={stats.completedEvents} sub="Completed events"     icon={CalendarDays} color="amber"   />
        <StatCard label="Units Moved"     value={stats.itemsMoved}      sub="All shipments"        icon={TrendingUp}   color="blue"    />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Units per Event</h3>
          {eventActivityData.length === 0
            ? <p className="text-xs text-slate-400 py-8 text-center">No event data yet</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={eventActivityData} barSize={20} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Outbound" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Returned" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Stock by Category</h3>
          {categoryData.length === 0
            ? <p className="text-xs text-slate-400 py-8 text-center">No items yet</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-slate-500">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {topItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Most Shipped Items</h3>
          <div className="space-y-3">
            {topItems.map(({ item, count }, i) => {
              const max = topItems[0].count
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <span className="text-xs font-mono font-bold text-blue-600 w-16 flex-shrink-0">{item.label}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{item.name}</span>
                      <span className="text-xs font-bold text-slate-700">{count} units</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Inventory Snapshot</h3>
          <span className="text-[10px] text-slate-400">Current stock levels</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                {['Label', 'Name', 'Category', 'Qty', 'Min', 'Status'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-xs font-mono font-bold text-blue-600">{item.label}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{item.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{item.category}</td>
                  <td className="px-3 py-2 text-xs font-bold text-slate-900">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{item.minStock}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.quantity <= item.minStock ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'}`}>
                      {item.quantity <= item.minStock ? 'Low' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
