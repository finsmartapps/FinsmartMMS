'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'

export interface PageSection {
  id: string
  label: string
  content: React.ReactNode
}

function SortableSection({ id, label, content }: PageSection) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative group transition-shadow ${isDragging ? 'z-50 opacity-60 shadow-2xl scale-[1.01]' : ''}`}
    >
      {/* Drag handle — visible on hover */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-lg cursor-grab active:cursor-grabbing select-none
                   opacity-0 group-hover:opacity-100 transition-opacity w-fit hover:bg-slate-100"
        title="Drag to reorder section"
      >
        <GripHorizontal className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>

      {content}
    </div>
  )
}

interface Props {
  sections: PageSection[]
  storageKey: string
}

export default function PageSortableLayout({ sections, storageKey }: Props) {
  const defaultOrder = sections.map(s => s.id)
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        const valid   = parsed.filter(id => defaultOrder.includes(id))
        const missing = defaultOrder.filter(id => !valid.includes(id))
        setOrder([...valid, ...missing])
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setOrder(prev => {
        const next = arrayMove(
          prev,
          prev.indexOf(active.id as string),
          prev.indexOf(over.id as string),
        )
        try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
        return next
      })
    }
  }, [storageKey])

  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]))
  const displayOrder = mounted ? order : defaultOrder
  const orderedSections = displayOrder.map(id => sectionMap[id]).filter(Boolean)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={displayOrder} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {orderedSections.map(s => (
            <SortableSection key={s.id} {...s} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
