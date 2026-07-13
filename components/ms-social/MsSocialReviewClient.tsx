'use client'

import { useState } from 'react'
import {
  Loader2, CheckCircle, XCircle, PenLine,
  ChevronDown, ChevronUp, MoreHorizontal,
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
  creator_name: string | null
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
  pending:  { label: 'Pending',  badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400'   },
  approved: { label: 'Approved', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', badgeCls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400'     },
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const abbr = initials(name).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
      <span className="text-white font-bold" style={{ fontSize: size * 0.38 }}>{abbr}</span>
    </div>
  )
}

// ── Post text with See more/less ──────────────────────────────────────────────

const CHAR_LIMIT = 300

function PostText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long  = text.length > CHAR_LIMIT
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

// ── Review card ───────────────────────────────────────────────────────────────

type CardAction =
  | { type: 'idle' }
  | { type: 'approve'; notes: string }
  | { type: 'reject';  notes: string }
  | { type: 'edit'; description: string; image_url: string; publish_date: string; platform: string }

function ReviewCard({ post, onUpdate }: { post: SocialPost; onUpdate: (updated: SocialPost) => void }) {
  const [action,     setAction]     = useState<CardAction>({ type: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [menuOpen,   setMenuOpen]   = useState(false)

  const cfg      = STATUS_CONFIG[post.status]
  const embedUrl = toEmbedUrl(post.image_url)
  const name     = post.creator_name ?? 'Unknown'

  async function handleReview(reviewAction: 'approve' | 'reject', notes: string) {
    if (reviewAction === 'reject' && !notes.trim()) { setError('Notes are required when rejecting'); return }
    setSubmitting(true); setError('')
    const res = await fetch(`/api/ms-social/posts/${post.id}/review`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: reviewAction, reviewer_notes: notes.trim() || null }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    onUpdate({ ...post, ...data.post })
    setAction({ type: 'idle' })
  }

  async function handleSaveEdit() {
    if (action.type !== 'edit') return
    if (!action.description.trim()) { setError('Description is required'); return }
    if (!action.publish_date)       { setError('Publish date is required'); return }
    setSubmitting(true); setError('')
    const res = await fetch(`/api/ms-social/posts/${post.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: action.description, image_url: action.image_url || null, publish_date: action.publish_date, platform: action.platform }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    onUpdate({ ...post, ...data.post })
    setAction({ type: 'idle' })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-[15px] leading-tight">{name}</span>
            <span className="text-[11px] text-slate-400 border border-slate-300 rounded px-1 leading-4">1st</span>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">Finsmart Accounting</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {post.platform} · {timeAgo(post.created_at)} · Scheduled {fmtDate(post.publish_date)}
          </p>
        </div>

        {/* Status badge + menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[130px]">
                  <button onClick={() => { setMenuOpen(false); setAction({ type: 'edit', description: post.description, image_url: post.image_url ?? '', publish_date: post.publish_date, platform: post.platform }); setError('') }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition">
                    <PenLine size={13} /> Edit Post
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: text ── */}
      <div className="px-5 pb-3">
        <PostText text={post.description} />
      </div>

      {/* ── Reviewer notes (already reviewed) ── */}
      {post.status !== 'pending' && post.reviewer_notes && action.type === 'idle' && (
        <div className={`mx-5 mb-3 rounded-xl px-4 py-3 text-sm ${
          post.status === 'approved'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="text-[11px] font-bold mb-1 opacity-60 uppercase tracking-wider">
            {post.status === 'approved' ? 'Approval Notes' : 'Rejection Notes'}
          </p>
          {post.reviewer_notes}
        </div>
      )}

      {/* ── Image (full width) ── */}
      {embedUrl && action.type === 'idle' && (
        <PostImage url={embedUrl} linkUrl={post.image_url!} />
      )}

      {/* ── Action bar: pending ── */}
      {post.status === 'pending' && action.type === 'idle' && (
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100">
          <button onClick={() => { setAction({ type: 'approve', notes: '' }); setError('') }}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm">
            <CheckCircle size={15} /> Approve
          </button>
          <button onClick={() => { setAction({ type: 'reject', notes: '' }); setError('') }}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition shadow-sm">
            <XCircle size={15} /> Reject
          </button>
        </div>
      )}

      {/* ── Re-review bar: already reviewed ── */}
      {post.status !== 'pending' && action.type === 'idle' && (
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100">
          <button onClick={() => { setAction({ type: 'approve', notes: '' }); setError('') }}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition">
            <CheckCircle size={13} /> Approve
          </button>
          <button onClick={() => { setAction({ type: 'reject', notes: '' }); setError('') }}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition">
            <XCircle size={13} /> Reject
          </button>
        </div>
      )}

      {/* ── Approve panel ── */}
      {action.type === 'approve' && (
        <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4 space-y-3">
          <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Approval Notes <span className="normal-case font-normal text-emerald-600">(optional)</span>
          </label>
          <textarea className={inputCls} rows={2} placeholder="Any notes for the employee…"
            value={action.notes}
            onChange={e => setAction(a => a.type === 'approve' ? { ...a, notes: e.target.value } : a)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={() => handleReview('approve', action.notes)} disabled={submitting}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition shadow-sm">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Approving…' : 'Confirm Approve'}
            </button>
            <button onClick={() => setAction({ type: 'idle' })}
              className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Reject panel ── */}
      {action.type === 'reject' && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-4 space-y-3">
          <label className="block text-[11px] font-bold text-red-700 uppercase tracking-wider">
            Rejection Notes <span className="normal-case font-normal text-red-600">* required</span>
          </label>
          <textarea className={inputCls} rows={2} placeholder="Explain what needs to change…"
            value={action.notes}
            onChange={e => setAction(a => a.type === 'reject' ? { ...a, notes: e.target.value } : a)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={() => handleReview('reject', action.notes)} disabled={submitting}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition shadow-sm">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => setAction({ type: 'idle' })}
              className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Edit panel ── */}
      {action.type === 'edit' && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Edit Post</p>
          <textarea className={`${inputCls} resize-none`} rows={7} value={action.description}
            onChange={e => setAction(a => a.type === 'edit' ? { ...a, description: e.target.value } : a)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
              <input type="date" className={inputCls} value={action.publish_date}
                onChange={e => setAction(a => a.type === 'edit' ? { ...a, publish_date: e.target.value } : a)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
              <select className={inputCls} value={action.platform}
                onChange={e => setAction(a => a.type === 'edit' ? { ...a, platform: e.target.value } : a)}>
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
            <input className={inputCls} placeholder="https://drive.google.com/file/d/…" value={action.image_url}
              onChange={e => setAction(a => a.type === 'edit' ? { ...a, image_url: e.target.value } : a)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={handleSaveEdit} disabled={submitting}
              className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition shadow-sm">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setAction({ type: 'idle' })}
              className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main review view ──────────────────────────────────────────────────────────

export function MsSocialReviewClient({ initialPosts }: { initialPosts: SocialPost[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [tab,   setTab]   = useState<'pending' | 'all'>('pending')

  function handleUpdate(updated: SocialPost) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const pendingCount  = posts.filter(p => p.status === 'pending').length
  const approvedCount = posts.filter(p => p.status === 'approved').length
  const rejectedCount = posts.filter(p => p.status === 'rejected').length
  const filtered      = tab === 'pending' ? posts.filter(p => p.status === 'pending') : posts

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review Posts</h1>
          <p className="text-slate-500 text-sm mt-0.5">Approve or reject employee LinkedIn post submissions</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-sm">
          <span className="font-bold text-amber-600">{pendingCount}</span>
          <span className="text-slate-400 text-[11px]">Pending</span>
          <span className="w-px h-3 bg-slate-200 mx-1" />
          <span className="font-bold text-emerald-600">{approvedCount}</span>
          <span className="text-slate-400 text-[11px]">Approved</span>
          <span className="w-px h-3 bg-slate-200 mx-1" />
          <span className="font-bold text-red-600">{rejectedCount}</span>
          <span className="text-slate-400 text-[11px]">Rejected</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: 'pending', label: `Pending (${pendingCount})` },
          { key: 'all',     label: `All (${posts.length})`     },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <p className="font-semibold text-slate-500 text-lg">
            {tab === 'pending' ? 'No pending posts' : 'No posts yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {tab === 'pending' ? 'All posts have been reviewed — great work!' : 'Employee submissions will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <ReviewCard key={post.id} post={post} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
