'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Pencil, Trash2, Loader2, List, Check } from 'lucide-react'

interface LinkedInList {
  id: string
  name: string
  description: string | null
  contact_count: number
}

interface Props {
  onClose: () => void
  onListsChanged: () => void
}

const inputCls = 'w-full border border-[#E5E5EA] rounded-xl px-3 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] placeholder-[#AEAEB2]'

export function ListsModal({ onClose, onListsChanged }: Props) {
  const [lists, setLists] = useState<LinkedInList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchLists() {
    const res = await fetch('/api/linkedin/lists')
    const d = await res.json()
    setLists(d.lists ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchLists() }, [])

  async function handleCreate() {
    if (!newName.trim()) { setError('List name is required.'); return }
    setCreating(true); setError('')
    const res = await fetch('/api/linkedin/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Failed to create list.'); setCreating(false); return }
    setLists(prev => [{ ...d.list }, ...prev])
    setNewName(''); setNewDesc(''); setShowCreate(false); setCreating(false)
    onListsChanged()
  }

  function startEdit(l: LinkedInList) {
    setEditingId(l.id)
    setEditName(l.name)
    setEditDesc(l.description ?? '')
    setError('')
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setError('List name is required.'); return }
    setSaving(true); setError('')
    const res = await fetch(`/api/linkedin/lists/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Failed to save.'); setSaving(false); return }
    setLists(prev => prev.map(l => l.id === editingId ? { ...l, name: d.list.name, description: d.list.description } : l))
    setEditingId(null); setSaving(false)
    onListsChanged()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete list "${name}"? Contacts will not be deleted, just removed from the list.`)) return
    setDeletingId(id)
    const res = await fetch(`/api/linkedin/lists/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Delete failed.'); setDeletingId(null); return }
    setLists(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
    onListsChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2F2F7] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <List size={15} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1D1D1F]">Manage Lists</h2>
              <p className="text-[11px] text-[#AEAEB2]">Organise contacts into lists for easy filtering</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] rounded-lg hover:bg-[#F5F5F7] transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {error && <p className="text-red-600 text-[13px] bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

          {/* Create new list */}
          {showCreate ? (
            <div className="border border-[#E5E5EA] rounded-xl p-4 space-y-3 bg-[#FAFAFA]">
              <p className="text-[13px] font-semibold text-[#1D1D1F]">New List</p>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="List name *"
                className={inputCls}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating || !newName.trim()}
                  className="flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#C91C1C] disabled:opacity-40 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition">
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}
                  className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition px-3 py-2">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowCreate(true); setError('') }}
              className="w-full flex items-center gap-2 border-2 border-dashed border-[#E5E5EA] hover:border-[#DC2626]/40 rounded-xl px-4 py-3 text-[13px] font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition">
              <Plus size={15} className="text-[#DC2626]" /> Create new list
            </button>
          )}

          {/* List items */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-[#AEAEB2]" /></div>
          ) : lists.length === 0 ? (
            <p className="text-center text-[13px] text-[#AEAEB2] py-6 italic">No lists yet — create one above to get started.</p>
          ) : (
            <div className="space-y-2">
              {lists.map(l => (
                <div key={l.id} className="border border-[#E5E5EA] rounded-xl overflow-hidden">
                  {editingId === l.id ? (
                    <div className="p-3 space-y-2 bg-[#FAFAFA]">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className={inputCls}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={saving || !editName.trim()}
                          className="flex items-center gap-1.5 bg-[#1D1D1F] hover:bg-[#3A3A3C] disabled:opacity-40 text-white text-[13px] font-semibold px-3 py-1.5 rounded-lg transition">
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-[13px] text-[#AEAEB2] hover:text-[#6E6E73] transition px-2 py-1.5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#1D1D1F] truncate">{l.name}</p>
                        <p className="text-[11px] text-[#AEAEB2] mt-0.5">
                          {l.contact_count} contact{l.contact_count !== 1 ? 's' : ''}
                          {l.description && <span className="ml-1.5">· {l.description}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(l)}
                          className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(l.id, l.name)} disabled={deletingId === l.id}
                          className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-[#FF3B30] hover:bg-red-50 transition disabled:opacity-40">
                          {deletingId === l.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F2F2F7] flex-shrink-0">
          <button onClick={onClose}
            className="w-full border border-[#E5E5EA] text-[#6E6E73] rounded-xl py-2.5 text-sm font-medium hover:bg-[#F5F5F7] transition">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
