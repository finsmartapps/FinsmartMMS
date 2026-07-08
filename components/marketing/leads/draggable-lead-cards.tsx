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
import { GripVertical, Inbox, Users, ArrowUpRight, CalendarCheck } from 'lucide-react'
import SqlCard from './sql-card'
import CustomerCard from './customer-card'
import type { Lead } from '@/types'

const STORAGE_KEY = 'leads-card-order'
const DEFAULT_ORDER = ['total', 'mql', 'sql', 'meetings', 'customers']

interface Props {
  leads: Lead[]
  mqlCount: number
  sqlLeads: Lead[]
  customers: Lead[]
  opportunityCount: number
  successfulMeetingsCount: number
  mqlTargetLabel: string
  sqlTargetLabel?: string
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
}: Props) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

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
      <RollupCardInner
        icon={CalendarCheck} label="Successful Meetings" value={successfulMeetingsCount}
        foot="marked Yes on import"
        gradient="from-amber-500 via-orange-500 to-rose-500"
      />
    ),
    customers: <CustomerCard customers={customers} opportunityCount={opportunityCount} />,
  }

  const activeCard = activeId ? cardMap[activeId] : null

  // Avoid hydration mismatch — render static order on server, real order after mount
  const displayOrder = mounted ? order : DEFAULT_ORDER

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
  )
}
