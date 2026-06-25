'use client'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useWarehouseStore } from '@/components/warehouse/useWarehouseStore'
import Shipments from '@/components/warehouse/Shipments'

function ShipmentsContent() {
  const searchParams = useSearchParams()
  const defaultEventId = searchParams.get('event') || undefined
  const { data, loading, error, addShipment, updateShipment, deleteShipment, updateItem } = useWarehouseStore()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-sm text-rose-500">Failed to load shipments: {error}</div>
  )

  return (
    <div className="p-6">
      <Shipments
        data={data}
        addShipment={addShipment}
        updateShipment={updateShipment}
        deleteShipment={deleteShipment}
        updateItem={updateItem}
        defaultEventId={defaultEventId}
      />
    </div>
  )
}

export default function WarehouseShipmentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-slate-400" /></div>}>
      <ShipmentsContent />
    </Suspense>
  )
}
