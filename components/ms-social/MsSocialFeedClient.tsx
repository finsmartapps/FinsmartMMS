'use client'

import { useState } from 'react'
import {
  Plus, Loader2, X, PenLine, Trash2, RotateCcw,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  MoreHorizontal,
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
  'transition bg-white placeholder-slate-400'

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/?]+)/)
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`
  const idMatch = url.match(/[?&]id=([^&]+)/)
  if (idMatch && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`
  return url
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 60)  return `${m}m`
  const h  = Math.floor(m  / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400'  },
  approved: { label: 'Approved',       badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected: { label: 'Changes Needed', badgeCls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400'    },
}

const BLANK_FORM = { description: '', image_url: '', publish_date: '', platform: 'LinkedIn' }

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const abbr = initials(name).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center shadow-sm">
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>{abbr}</span>
    </div>
  )
}

// ── Post text with See more/less ──────────────────────────────────────────────

const CHAR_LIMIT = 300

function PostText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > CHAR_LIMIT
  const shown = long && !expanded ? text.slice(0, CHAR_LIMIT) + '…' : text
  return (
    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
      {shown}
      {long && (
        <button onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-0.5 ml-1 text-slate-500 font-semibold hover:text-pink-600 transition text-[13px]">
          {expanded ? <><ChevronUp size={13} /> see less</> : <><ChevronDown size={13} /> see more</>}
        </button>
      )}
    </div>
  )
}

// ── Image block ───────────────────────────────────────────────────────────────

function PostImage({ url, linkUrl }: { url: string; linkUrl: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer"
      className="block w-full overflow-hidden bg-slate-100">
      <img src={url} alt=""
        className="w-full max-h-[480px] object-cover"
        onError={() => setFailed(true)} />
    </a>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ postId, initial, isResubmit, onSave, onCancel }: {
  postId: string
  initial: { description: string; image_url: string; publish_date: string; platform: string }
  isResubmit: boolean
  onSave: (updated: SocialPost) => void
  onCancel: () => void
}) {
  const [form,   setForm]   = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setError('')
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!form.publish_date)       { setError('Publish date is required'); return }
    setSaving(true)
    const res = await fetch(`/api/ms-social/posts/${postId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.description, image_url: form.image_url || null, publish_date: form.publish_date, platform: form.platform }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    onSave(data.post)
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-4 rounded-b-2xl">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
        {isResubmit ? 'Edit & Resubmit' : 'Edit Post'}
      </p>
      <textarea className={`${inputCls} resize-none`} rows={7}
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
          <input type="date" className={inputCls} value={form.publish_date}
            onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
          <select className={inputCls} value={form.platform}
            onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
            <option>LinkedIn</option>
            <option>Twitter</option>
            <option>Instagram</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Image URL <span className="normal-case font-normal text-slate-400">(Google Drive link or direct image URL)</span>
        </label>
        <input className={inputCls} placeholder="https://drive.google.com/file/d/…"
          value={form.image_url}
          onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition shadow-sm">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Submitting…' : isResubmit ? 'Resubmit for Approval' : 'Save Changes'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-white transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Post card (LinkedIn style) ─────────────────────────────────────────────────

function PostCard({ post, userName, onDelete, onUpdate }: {
  post: SocialPost
  userName: string
  onDelete: (id: string) => void
  onUpdate: (updated: SocialPost) => void
}) {
  const [editing,   setEditing]   = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  const cfg      = STATUS_CONFIG[post.status]
  const embedUrl = toEmbedUrl(post.image_url)
  const canEdit  = post.status === 'pending' || post.status === 'rejected'

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    const res = await fetch(`/api/ms-social/posts/${post.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) onDelete(post.id)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <Avatar name={userName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-[15px] leading-tight">{userName}</span>
            <span className="text-[11px] text-slate-400 border border-slate-300 rounded px-1 leading-4">1st</span>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">Finsmart Accounting</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {post.platform} · {timeAgo(post.created_at)} · Scheduled {fmtDate(post.publish_date)}
          </p>
        </div>

        {/* Status + menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[130px]">
                    <button onClick={() => { setMenuOpen(false); setEditing(true) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                      <PenLine size={13} />
                      {post.status === 'rejected' ? 'Edit & Resubmit' : 'Edit'}
                    </button>
                    <button onClick={() => { setMenuOpen(false); handleDelete() }} disabled={deleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Body: text ── */}
      <div className="px-5 pb-3">
        <PostText text={post.description} />
      </div>

      {/* ── Reviewer feedback ── */}
      {post.status === 'rejected' && post.reviewer_notes && !editing && (
        <div className="mx-5 mb-3 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-red-600 mb-0.5">Reviewer Feedback</p>
            <p className="text-sm text-red-700 leading-relaxed">{post.reviewer_notes}</p>
          </div>
        </div>
      )}
      {post.status === 'approved' && post.reviewer_notes && (
        <div className="mx-5 mb-3 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">Reviewer Note</p>
            <p className="text-sm text-emerald-800 leading-relaxed">{post.reviewer_notes}</p>
          </div>
        </div>
      )}

      {/* ── Image (full width, at bottom) ── */}
      {embedUrl && !editing && <PostImage url={embedUrl} linkUrl={post.image_url!} />}

      {/* ── Rejected quick-action bar ── */}
      {post.status === 'rejected' && !editing && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 transition shadow-sm">
            <RotateCcw size={13} /> Edit &amp; Resubmit
          </button>
        </div>
      )}

      {/* ── Edit form ── */}
      {editing && (
        <EditForm
          postId={post.id}
          initial={{ description: post.description, image_url: post.image_url ?? '', publish_date: post.publish_date, platform: post.platform }}
          isResubmit={post.status === 'rejected'}
          onSave={updated => { onUpdate(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────

export function MsSocialFeedClient({
  initialPosts,
  userId,
  userName,
}: {
  initialPosts: SocialPost[]
  userId: string
  userName: string
}) {
  void userId
  const [posts,     setPosts]     = useState(initialPosts)
  const [showNew,   setShowNew]   = useState(false)
  const [form,      setForm]      = useState(BLANK_FORM)
  const [creating,  setCreating]  = useState(false)
  const [formError, setFormError] = useState('')

  async function handleCreate() {
    setFormError('')
    if (!form.description.trim()) { setFormError('Description is required'); return }
    if (!form.publish_date)       { setFormError('Publish date is required'); return }
    setCreating(true)
    const res = await fetch('/api/ms-social/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: form.description, image_url: form.image_url || null, publish_date: form.publish_date, platform: form.platform }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Failed to create post'); return }
    setPosts(prev => [data.post, ...prev])
    setShowNew(false)
    setForm(BLANK_FORM)
  }

  const counts = {
    pending:  posts.filter(p => p.status === 'pending').length,
    approved: posts.filter(p => p.status === 'approved').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MS Social</h1>
            <p className="text-slate-500 text-sm mt-0.5">Hi {userName} — submit LinkedIn posts for manager approval</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-sm">
              <span className="font-bold text-amber-600">{counts.pending}</span>
              <span className="text-slate-400 text-[11px]">Pending</span>
              <span className="w-px h-3 bg-slate-200 mx-1" />
              <span className="font-bold text-emerald-600">{counts.approved}</span>
              <span className="text-slate-400 text-[11px]">Approved</span>
              {counts.rejected > 0 && (
                <>
                  <span className="w-px h-3 bg-slate-200 mx-1" />
                  <span className="font-bold text-red-600">{counts.rejected}</span>
                  <span className="text-slate-400 text-[11px]">Rejected</span>
                </>
              )}
            </div>
            <button
              onClick={() => { setShowNew(true); setFormError(''); setForm(BLANK_FORM) }}
              className="flex items-center gap-1.5 bg-pink-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-pink-700 transition shadow-sm">
              <Plus size={15} /> New Post
            </button>
          </div>
        </div>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
            <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PenLine size={24} className="text-pink-400" />
            </div>
            <p className="font-semibold text-slate-600 text-lg">No posts yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Submit your first LinkedIn post for review</p>
            <button onClick={() => { setShowNew(true); setFormError(''); setForm(BLANK_FORM) }}
              className="inline-flex items-center gap-1.5 bg-pink-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-pink-700 transition">
              <Plus size={15} /> New Post
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} userName={userName}
                onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
                onUpdate={updated => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── New Post modal ── */}
      {showNew && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Avatar name={userName} size={40} />
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{userName}</p>
                    <p className="text-[12px] text-slate-400">Submit a LinkedIn post for approval</p>
                  </div>
                </div>
                <button onClick={() => setShowNew(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Post Content *</label>
                  <textarea className={`${inputCls} resize-none`} rows={7}
                    placeholder="Write your LinkedIn post content here…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
                    <input type="date" className={inputCls} value={form.publish_date}
                      onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                    <select className={inputCls} value={form.platform}
                      onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                      <option>LinkedIn</option>
                      <option>Twitter</option>
                      <option>Instagram</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Image URL <span className="normal-case font-normal text-slate-400">(Google Drive link or any image URL)</span>
                  </label>
                  <input className={inputCls} placeholder="https://drive.google.com/file/d/…"
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                </div>
                {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button onClick={() => setShowNew(false)}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-1.5 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition">
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
