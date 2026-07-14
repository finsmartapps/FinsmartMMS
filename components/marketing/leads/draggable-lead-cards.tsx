'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Inbox, Users, ArrowUpRight, CalendarCheck, Armchair, DollarSign, X } from 'lucide-react'
import SqlCard from './sql-card'
import CustomerCard from './customer-card'
import type { Lead } from '@/types'

const STORAGE_KEY = 'leads-card-order-v2'
const DEFAULT_ORDER = ['total', 'mql', 'sql', 'meetings', 'customers', 'avg-seats', 'avg-revenue']

interface Props {
  leads: Lead[]
  mqlCount: number
  sqlLeads: Lead[]
  customers: Lead[]
  opportunityCount: number
  successfulMeetingsCount: number
  mqlTargetLabel: string
  sqlTargetLabel?: string
  avgSeatsPerCustomer: number
  avgRevenuePerSeat: number
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function MeetingsModal({ leads, onClose }: { leads: Lead[]; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? leads.filter(l =>
        l.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.company_name?.toLowerCase().includes(search.toLowerCase())
      )
    : leads

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="font-semibold text-slate-900 text-lg">Successful Meetings</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{leads.length} leads with a successful meeting</p>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X size={18} />
            </button>
          </div>
          {/* Search */}
          <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
            <input
              type="text"
              placeholder="Search by name or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition"
            />
          </div>
          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  {['#', 'Date', 'Name', 'Company', 'Source', 'Stage', 'Status', 'Owner'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No results</td></tr>
                ) : filtered.map((l, i) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 text-slate-400 text-[12px]">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-600 text-[12px] whitespace-nowrap">{fmtDate(l.lead_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 text-[13px]">{l.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-[12px]">{l.company_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-[12px]">{l.lead_source || '—'}</td>
                    <td className="px-4 py-3 text-[12px]">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {l.lead_stage || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        l.lead_status === 'Customer'    ? 'bg-emerald-100 text-emerald-700' :
                        l.lead_status === 'SQL'         ? 'bg-blue-100 text-blue-700' :
                        l.lead_status === 'MQL'         ? 'bg-violet-100 text-violet-700' :
                        l.lead_status === 'Opportunity' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {l.lead_status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-[12px]">{l.assigned_to || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Footer count */}
          {search && (
            <div className="px-6 py-3 border-t border-slate-100 text-[12px] text-slate-400 flex-shrink-0">
              Showing {filtered.length} of {leads.length}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function RollupCardInner({
  icon: Icon, label, value, foot, gradient,
}: {
  icon: React.ElementType; label: string; value: number | string; foot: string; gradient: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 hover-lift h-full`}>
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

function SortableCard({
  id, children, isDragging,
}: {
  id: string; children: React.ReactNode; isDragging: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSelf } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelf ? 0 : 1,
    zIndex: isSelf ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* drag handle — appears on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-md bg-white/20 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-white/80" />
      </div>
      {children}
    </div>
  )
}

export default function DraggableLeadCards({
  leads, mqlCount, sqlLeads, customers, opportunityCount, successfulMeetingsCount, mqlTargetLabel, sqlTargetLabel,
  avgSeatsPerCustomer, avgRevenuePerSeat,
}: Props) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [meetingsOpen, setMeetingsOpen] = useState(false)

  const meetingLeads = leads.filter(l => l.successful_meetings)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) {
          setOrder(parsed)
        }
      }
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }, [])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (over && active.id !== over.id) {
      setOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    }
  }, [])

  const cardMap: Record<string, React.ReactNode> = {
    total: (
      <RollupCardInner
        icon={Inbox} label="Total Leads" value={leads.length} foot="all-time"
        gradient="from-slate-600 to-slate-800"
      />
    ),
    mql: (
      <RollupCardInner
        icon={Users} label="MQLs" value={mqlCount} foot={mqlTargetLabel}
        gradient="from-indigo-500 via-indigo-600 to-violet-700"
      />
    ),
    sql: <SqlCard sqls={sqlLeads} targetLabel={sqlTargetLabel} />,
    meetings: (
      <button
        onClick={() => setMeetingsOpen(true)}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-white/50 rounded-2xl"
        title="Click to view all successful meetings"
      >
        <RollupCardInner
          icon={CalendarCheck} label="Successful Meetings" value={successfulMeetingsCount}
          foot="click to view details"
          gradient="from-amber-500 via-orange-500 to-rose-500"
        />
      </button>
    ),
    customers: <CustomerCard customers={customers} opportunityCount={opportunityCount} />,
    'avg-seats': (
      <RollupCardInner
        icon={Armchair} label="Avg. Seats / Customer"
        value={avgSeatsPerCustomer > 0 ? Number(avgSeatsPerCustomer.toFixed(2)).toString() : '—'}
        foot={`across ${customers.length} customer${customers.length === 1 ? '' : 's'}`}
        gradient="from-teal-500 via-cyan-500 to-sky-600"
      />
    ),
    'avg-revenue': (
      <RollupCardInner
        icon={DollarSign} label="Avg. Revenue / Seat"
        value={avgRevenuePerSeat > 0 ? `$${Math.round(avgRevenuePerSeat).toLocaleString()}` : '—'}
        foot="MRR ÷ seats closed"
        gradient="from-emerald-500 via-green-500 to-teal-600"
      />
    ),
  }

  const activeCard = activeId ? cardMap[activeId] : null

  // Avoid hydration mismatch — render static order on server, real order after mount
  const displayOrder = mounted ? order : DEFAULT_ORDER

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {displayOrder.map(id => (
            <SortableCard key={id} id={id} isDragging={activeId === id}>
              {cardMap[id]}
            </SortableCard>
          ))}
        </div>
      </SortableContext>

      {/* Ghost card while dragging */}
      <DragOverlay>
        {activeCard && (
          <div className="opacity-90 rotate-1 scale-105 shadow-2xl rounded-2xl">
            {activeCard}
          </div>
        )}
      </DragOverlay>
    </DndContext>

    {meetingsOpen && (
      <MeetingsModal leads={meetingLeads} onClose={() => setMeetingsOpen(false)} />
    )}
  </>
  )
}
