'use client'
import { Loader2 } from 'lucide-react'
import { useWarehouseStore } from '@/components/warehouse/useWarehouseStore'
import Inventory from '@/components/warehouse/Inventory'

export default function WarehouseInventoryPage() {
  const { data, loading, error, addItem, updateItem, deleteItem } = useWarehouseStore()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={20} className="animate-spin text-slate-400" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-sm text-rose-500">Failed to load inventory: {error}</div>
  )

  return (
    <div className="p-6">
      <Inventory data={data} addItem={addItem} updateItem={updateItem} deleteItem={deleteItem} />
    </div>
  )
}
