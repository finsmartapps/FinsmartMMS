'use client'

import { useState } from 'react'
import {
  Loader2, CheckCircle, XCircle, PenLine,
  Calendar, Globe, ImageIcon, User, Clock,
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
  'transition bg-slate-50 placeholder-slate-400'

const STATUS_BADGE: Record<SocialPost['status'], { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-50  text-amber-700  border-amber-200'   },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50    text-red-700    border-red-200'     },
}

type CardAction =
  | { type: 'idle' }
  | { type: 'approve'; notes: string }
  | { type: 'reject';  notes: string }
  | { type: 'edit'; description: string; image_url: string; publish_date: string; platform: string }

// ── Review card ────────────────────────────────────────────────────────────────

function ReviewCard({
  post,
  onUpdate,
}: {
  post: SocialPost
  onUpdate: (updated: SocialPost) => void
}) {
  const [action,     setAction]     = useState<CardAction>({ type: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const badge = STATUS_BADGE[post.status]

  function startApprove() { setAction({ type: 'approve', notes: '' }); setError('') }
  function startReject()  { setAction({ type: 'reject',  notes: '' }); setError('') }
  function startEdit() {
    setAction({
      type:         'edit',
      description:  post.description,
      image_url:    post.image_url ?? '',
      publish_date: post.publish_date,
      platform:     post.platform,
    })
    setError('')
  }

  async function handleReview(reviewAction: 'approve' | 'reject', notes: string) {
    if (reviewAction === 'reject' && !notes.trim()) {
      setError('Reviewer notes are required when rejecting')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/ms-social/posts/${post.id}/review`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: reviewAction, reviewer_notes: notes.trim() || null }),
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
    if (!action.publish_date)        { setError('Publish date is required'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/ms-social/posts/${post.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        description:  action.description,
        image_url:    action.image_url || null,
        publish_date: action.publish_date,
        platform:     action.platform,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    onUpdate({ ...post, ...data.post })
    setAction({ type: 'idle' })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Card body */}
      <div className="px-5 pt-4 pb-3">
        {/* Creator + status + meta row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
            <User size={10} className="text-pink-400" />
            {post.creator_name ?? 'Unknown'}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Globe size={10} /> {post.platform}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto flex-shrink-0">
            <Clock size={10} />{' '}
            {new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-700 leading-relaxed">{post.description}</p>

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

        {/* Scheduled date */}
        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Calendar size={10} /> Scheduled:{' '}
          {new Date(post.publish_date + 'T00:00:00').toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </p>
      </div>

      {/* Reviewer notes for reviewed posts */}
      {post.status !== 'pending' && post.reviewer_notes && (
        <div
          className={`mx-5 mb-3 rounded-lg px-3 py-2.5 ${
            post.status === 'approved'
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`text-[11px] font-semibold mb-1 ${
              post.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {post.status === 'approved' ? 'Approval Notes:' : 'Rejection Notes:'}
          </p>
          <p
            className={`text-xs leading-relaxed ${
              post.status === 'approved' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {post.reviewer_notes}
          </p>
        </div>
      )}

      {/* ── Inline action panels ── */}

      {/* Approve panel */}
      {action.type === 'approve' && (
        <div className="mx-5 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <label className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Approval Notes (optional)
          </label>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Any notes for the employee…"
            value={action.notes}
            onChange={e => setAction(a => a.type === 'approve' ? { ...a, notes: e.target.value } : a)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReview('approve', action.notes)}
              disabled={submitting}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {submitting ? 'Approving…' : 'Confirm Approve'}
            </button>
            <button
              onClick={() => setAction({ type: 'idle' })}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {action.type === 'reject' && (
        <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <label className="block text-[11px] font-semibold text-red-700 uppercase tracking-wider">
            Rejection Notes (required) *
          </label>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Explain why this post is being rejected…"
            value={action.notes}
            onChange={e => setAction(a => a.type === 'reject' ? { ...a, notes: e.target.value } : a)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReview('reject', action.notes)}
              disabled={submitting}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {submitting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => setAction({ type: 'idle' })}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit panel */}
      {action.type === 'edit' && (
        <div className="mx-5 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Edit Post</p>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Description *
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={action.description}
              onChange={e => setAction(a => a.type === 'edit' ? { ...a, description: e.target.value } : a)}
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
                value={action.publish_date}
                onChange={e => setAction(a => a.type === 'edit' ? { ...a, publish_date: e.target.value } : a)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Platform
              </label>
              <select
                className={inputCls}
                value={action.platform}
                onChange={e => setAction(a => a.type === 'edit' ? { ...a, platform: e.target.value } : a)}
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
              value={action.image_url}
              onChange={e => setAction(a => a.type === 'edit' ? { ...a, image_url: e.target.value } : a)}
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={submitting}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => setAction({ type: 'idle' })}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons — pending only, idle state */}
      {post.status === 'pending' && action.type === 'idle' && (
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={startApprove}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
          >
            <CheckCircle size={12} /> Approve
          </button>
          <button
            onClick={startReject}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition"
          >
            <XCircle size={12} /> Reject
          </button>
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition ml-auto"
          >
            <PenLine size={12} /> Edit
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

// ── Main review view ───────────────────────────────────────────────────────────

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
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold text-slate-900 tracking-tight">Review Posts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Review and approve employee LinkedIn post submissions
          </p>
        </div>
        {/* Stat chips */}
        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-[10px] text-slate-400">Pending</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
            <p className="text-[10px] text-slate-400">Approved</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-red-600">{rejectedCount}</p>
            <p className="text-[10px] text-slate-400">Rejected</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {([
          { key: 'pending', label: `Pending (${pendingCount})` },
          { key: 'all',     label: `All (${posts.length})`     },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold transition ${
              tab === key
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Post grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
          <p className="font-semibold text-slate-500">
            {tab === 'pending' ? 'No pending posts' : 'No posts yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {tab === 'pending'
              ? 'All posts have been reviewed — great work!'
              : 'Employee submissions will appear here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(post => (
            <ReviewCard key={post.id} post={post} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
