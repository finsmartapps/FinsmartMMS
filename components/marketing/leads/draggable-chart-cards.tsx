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
import { GripVertical, Inbox, Zap, Trophy } from 'lucide-react'
import { DonutChart } from '@/components/marketing/charts/dashboard-charts'

const STORAGE_KEY = 'leads-chart-cards-order-v1'
const DEFAULT_ORDER = ['total-source', 'sql-source', 'closed-source']

type ChartPoint = { name: string; value: number }

interface Props {
  totalBySource: ChartPoint[]
  totalCount: number
  sqlBySource: ChartPoint[]
  sqlCount: number
  closedWonBySource: ChartPoint[]
  closedWonCount: number
}

const CARD_META: Record<string, {
  title: string
  centerLabel: string
  iconBg: string
  iconColor: string
  Icon: React.ElementType
}> = {
  'total-source': {
    title: 'Total Leads by Source',
    centerLabel: 'Leads',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
    Icon: Inbox,
  },
  'sql-source': {
    title: 'SQL by Source',
    centerLabel: 'SQLs',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    Icon: Zap,
  },
  'closed-source': {
    title: 'Closed Won by Source',
    centerLabel: 'Won',
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-600',
    Icon: Trophy,
  },
}

function ChartCardInner({
  id, data, centerValue, meta,
}: {
  id: string
  data: ChartPoint[]
  centerValue: string
  meta: (typeof CARD_META)[string]
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
          <meta.Icon strokeWidth={2.5} style={{ width: 17, height: 17 }} className={meta.iconColor} />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 truncate flex-1">{meta.title}</h3>
      </div>
      <div className="px-4 py-4">
        {data.length === 0 ? (
          <p className="text-[13px] text-slate-400 text-center py-6">No data</p>
        ) : (
          <DonutChart data={data} centerValue={centerValue} centerLabel={meta.centerLabel} />
        )}
      </div>
    </div>
  )
}

function SortableChartCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 z-10 w-6 h-6 rounded-md bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-slate-400" />
      </div>
      {children}
    </div>
  )
}

export default function DraggableChartCards({
  totalBySource, totalCount, sqlBySource, sqlCount, closedWonBySource, closedWonCount,
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
        if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) setOrder(parsed)
      }
    } catch {}
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), [])
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

  const dataMap: Record<string, { data: ChartPoint[]; centerValue: string }> = {
    'total-source': { data: totalBySource, centerValue: String(totalCount) },
    'sql-source':   { data: sqlBySource,   centerValue: String(sqlCount) },
    'closed-source': { data: closedWonBySource, centerValue: String(closedWonCount) },
  }

  const displayOrder = mounted ? order : DEFAULT_ORDER
  const activeMeta = activeId ? CARD_META[activeId] : null
  const activeData = activeId ? dataMap[activeId] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {displayOrder.map(id => (
            <SortableChartCard key={id} id={id}>
              <ChartCardInner id={id} meta={CARD_META[id]} {...dataMap[id]} />
            </SortableChartCard>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeMeta && activeData && (
          <div className="opacity-90 rotate-1 scale-105 shadow-2xl rounded-2xl">
            <ChartCardInner id={activeId!} meta={activeMeta} {...activeData} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
