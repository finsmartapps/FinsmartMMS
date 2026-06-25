'use client'
import { Loader2 } from 'lucide-react'
import { useWarehouseStore } from '@/components/warehouse/useWarehouseStore'
import Events from '@/components/warehouse/Events'

export default function WarehouseEventsPage() {
  const { data, loading, error, addEvent, updateEvent, deleteEvent } = useWarehouseStore()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-sm text-rose-500">Failed to load events: {error}</div>
  )

  return (
    <div className="p-6">
      <Events data={data} addEvent={addEvent} updateEvent={updateEvent} deleteEvent={deleteEvent} />
    </div>
  )
}
