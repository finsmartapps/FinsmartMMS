'use client'

import { useState } from 'react'
import {
  Plus, Loader2, X, Calendar, Globe, PenLine,
  Trash2, RotateCcw, ImageIcon,
} from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  publish_date: string
  platform: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  created_by: string
  reviewed_by: string | null
  created_at: string
  reviewed_at: string | null
}

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/10 ' +
  'transition bg-slate-50 placeholder-slate-400'

const STATUS_BADGE: Record<SocialPost['status'], { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-50  text-amber-700  border-amber-200'   },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50    text-red-700    border-red-200'     },
}

const BLANK_FORM = { description: '', image_url: '', publish_date: '', platform: 'LinkedIn' }

// ── Post card ──────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onDelete,
  onUpdate,
}: {
  post: SocialPost
  onDelete: (id: string) => void
  onUpdate: (updated: SocialPost) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    description:  post.description,
    image_url:    post.image_url ?? '',
    publish_date: post.publish_date,
    platform:     post.platform,
  })
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState('')

  const badge = STATUS_BADGE[post.status]

  function startEdit() {
    setEditForm({
      description:  post.description,
      image_url:    post.image_url ?? '',
      publish_date: post.publish_date,
      platform:     post.platform,
    })
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    setError('')
    if (!editForm.description.trim()) { setError('Description is required'); return }
    if (!editForm.publish_date)       { setError('Publish date is required'); return }
    setSaving(true)
    const res = await fetch(`/api/ms-social/posts/${post.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        description:  editForm.description,
        image_url:    editForm.image_url || null,
        publish_date: editForm.publish_date,
        platform:     editForm.platform,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    onUpdate(data.post)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    const res = await fetch(`/api/ms-social/posts/${post.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onDelete(post.id)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Card body */}
      <div className="px-5 pt-4 pb-3 flex-1">
        {/* Status + meta row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Globe size={10} /> {post.platform}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Calendar size={10} />{' '}
            {new Date(post.publish_date + 'T00:00:00').toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">{post.description}</p>

        {/* Image link */}
        {post.image_url && (
          <a
            href={post.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-700 font-medium"
          >
            <ImageIcon size={11} /> View Image
          </a>
        )}
      </div>

      {/* Rejection notes banner */}
      {post.status === 'rejected' && post.reviewer_notes && !editing && (
        <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <p className="text-[11px] font-semibold text-red-600 mb-1">Reviewer Notes:</p>
          <p className="text-xs text-red-700 leading-relaxed">{post.reviewer_notes}</p>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="mx-5 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Description *
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Publish Date *
              </label>
              <input
                type="date"
                className={inputCls}
                value={editForm.publish_date}
                onChange={e => setEditForm(f => ({ ...f, publish_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Platform
              </label>
              <select
                className={inputCls}
                value={editForm.platform}
                onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}
              >
                <option>LinkedIn</option>
                <option>Twitter</option>
                <option>Instagram</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Image URL (optional)
            </label>
            <input
              className={inputCls}
              placeholder="https://…"
              value={editForm.image_url}
              onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))}
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Saving…' : post.status === 'rejected' ? 'Resubmit' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action row — only for editable statuses */}
      {!editing && (post.status === 'pending' || post.status === 'rejected') && (
        <div className="px-5 pb-3 flex items-center gap-2">
          {post.status === 'rejected' ? (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 hover:bg-pink-100 transition"
            >
              <RotateCcw size={12} /> Edit &amp; Resubmit
            </button>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <PenLine size={12} /> Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 transition ml-auto"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {/* Submitted date */}
      <div className="px-5 pb-3">
        <p className="text-[10px] text-slate-400">
          Submitted{' '}
          {new Date(post.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      </div>
    </div>
  )
}

// ── Main feed ──────────────────────────────────────────────────────────────────

export function MsSocialFeedClient({
  initialPosts,
  userId,
  userName,
}: {
  initialPosts: SocialPost[]
  userId: string
  userName: string
}) {
  const [posts,     setPosts]     = useState(initialPosts)
  const [showNew,   setShowNew]   = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [creating,  setCreating]  = useState(false)
  const [formError, setFormError] = useState('')

  // Suppress unused warning — userId available for future use
  void userId

  async function handleCreate() {
    setFormError('')
    if (!form.description.trim()) { setFormError('Description is required'); return }
    if (!form.publish_date)       { setFormError('Publish date is required'); return }
    setCreating(true)
    const res = await fetch('/api/ms-social/posts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        description:  form.description,
        image_url:    form.image_url || null,
        publish_date: form.publish_date,
        platform:     form.platform,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create post'); return }
    setPosts(prev => [data.post, ...prev])
    setShowNew(false)
    setForm(BLANK_FORM)
  }

  function handleDelete(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  function handleUpdate(updated: SocialPost) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const counts = {
    pending:  posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  }

  return (
    <>
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 tracking-tight">MS Social</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Hi {userName} — submit LinkedIn posts for manager approval
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Stat chips */}
            <div className="flex items-center gap-2">
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-sm">
                <p className="text-lg font-bold text-amber-600">{counts.pending}</p>
                <p className="text-[10px] text-slate-400">Pending</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-sm">
                <p className="text-lg font-bold text-emerald-600">{counts.approved}</p>
                <p className="text-[10px] text-slate-400">Approved</p>
              </div>
              {counts.rejected > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-center shadow-sm">
                  <p className="text-lg font-bold text-red-600">{counts.rejected}</p>
                  <p className="text-[10px] text-slate-400">Rejected</p>
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowNew(true); setFormError(''); setForm(BLANK_FORM) }}
              className="flex items-center gap-1.5 bg-pink-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-pink-700 transition shadow-sm"
            >
              <Plus size={15} /> New Post
            </button>
          </div>
        </div>

        {/* Posts grid */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
            <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <PenLine size={20} className="text-pink-400" />
            </div>
            <p className="font-semibold text-slate-600">No posts yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Click &ldquo;New Post&rdquo; to submit your first LinkedIn post for review
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Post modal */}
      {showNew && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setShowNew(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">New Post</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Submit a post for manager approval</p>
                </div>
                <button
                  onClick={() => setShowNew(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Description *
                  </label>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={5}
                    placeholder="Write your LinkedIn post content here…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Publish Date *
                    </label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.publish_date}
                      onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Platform
                    </label>
                    <select
                      className={inputCls}
                      value={form.platform}
                      onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                    >
                      <option>LinkedIn</option>
                      <option>Twitter</option>
                      <option>Instagram</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Image URL (optional)
                  </label>
                  <input
                    className={inputCls}
                    placeholder="https://…"
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  />
                </div>
                {formError && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button
                  onClick={() => setShowNew(false)}
                  className="text-[13px] font-medium px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-1.5 text-[13px] font-semibold px-5 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Submitting…' : 'Submit Post'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
