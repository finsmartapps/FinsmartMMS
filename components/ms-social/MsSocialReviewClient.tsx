'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Loader2, CheckCircle, XCircle, PenLine,
  ChevronDown, ChevronUp, X, Maximize2, Check,
} from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  image_options: string[]
  selected_images: string[]
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

function toLightboxUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/?]+)/)
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`
  const idMatch = url.match(/[?&]id=([^&]+)/)
  if (idMatch && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`
  return url
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtPublishDate(iso: string) {
  const d  = new Date(iso + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
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

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/85 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/15 hover:bg-white/25 rounded-full text-white transition">
          <X size={20} />
        </button>
        <img src={toLightboxUrl(url)} alt=""
          className="max-h-[88vh] max-w-[92vw] object-contain rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()} />
      </div>
    </>
  )
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

// ── Image options grid with checkboxes ───────────────────────────────────────

function ImageOptionsGrid({
  options,
  checked,
  onToggle,
  onLightbox,
  readOnly,
}: {
  options: string[]
  checked: Set<string>
  onToggle: (url: string) => void
  onLightbox: (url: string) => void
  readOnly?: boolean
}) {
  const valid = options.filter(Boolean)
  if (valid.length === 0) return null

  return (
    <div className="px-5 pb-4">
      {!readOnly && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Image Options · tap to select for posting
        </p>
      )}
      {readOnly && checked.size > 0 && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Selected images · {checked.size} of {valid.length}
        </p>
      )}
      <div className={`grid gap-2 ${valid.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {valid.map((url, i) => {
          const embed   = toEmbedUrl(url)
          const isChecked = checked.has(url)
          return (
            <div key={i} className="relative">
              {/* thumbnail */}
              <button
                type="button"
                onClick={() => !readOnly && onToggle(url)}
                className={`w-full rounded-xl overflow-hidden border-2 transition block ${
                  isChecked
                    ? 'border-indigo-500 ring-2 ring-indigo-300/50'
                    : readOnly
                      ? 'border-slate-200'
                      : 'border-slate-200 hover:border-indigo-300'
                }`}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
              >
                <div className="aspect-video bg-slate-100 relative">
                  {embed ? (
                    <img src={embed} alt={`Option ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 text-[10px] text-slate-400 text-center break-all">
                      {url}
                    </div>
                  )}
                </div>
              </button>

              {/* checkbox (top-left) */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onToggle(url)}
                  className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition shadow-sm ${
                    isChecked
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'bg-white/90 border-slate-400 hover:border-indigo-400'
                  }`}
                >
                  {isChecked && <Check size={13} className="text-white" strokeWidth={3} />}
                </button>
              )}
              {readOnly && isChecked && (
                <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-indigo-500 border-2 border-indigo-500 flex items-center justify-center shadow-sm">
                  <Check size={13} className="text-white" strokeWidth={3} />
                </div>
              )}

              {/* expand button (top-right) */}
              <button
                type="button"
                onClick={() => onLightbox(url)}
                className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white transition"
                title="View full size"
              >
                <Maximize2 size={13} />
              </button>

              {valid.length > 1 && (
                <p className="text-[10px] text-center text-slate-400 mt-1">
                  {isChecked ? '✓ Selected' : `Option ${i + 1}`}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────

type CardAction =
  | { type: 'idle' }
  | { type: 'approve'; notes: string }
  | { type: 'reject';  notes: string }
  | { type: 'edit'; description: string; image_options: string[]; publish_date: string; platform: string }

function ReviewCard({ post, onUpdate, highlighted, cardRef }: {
  post: SocialPost
  onUpdate: (updated: SocialPost) => void
  highlighted?: boolean
  cardRef?: React.RefObject<HTMLDivElement | null>
}) {
  const [action,     setAction]     = useState<CardAction>({ type: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [lightbox,   setLightbox]   = useState<string | null>(null)

  // image selection state for approval
  const imageOptions = post.image_options?.filter(Boolean) ?? []
  const hasOptions   = imageOptions.length > 0

  const [selectedImages, setSelectedImages] = useState<Set<string>>(
    () => new Set(post.selected_images?.filter(Boolean) ?? [])
  )

  function toggleImage(url: string) {
    setSelectedImages(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const cfg  = STATUS_CONFIG[post.status]
  const name = post.creator_name ?? 'Unknown'

  // For legacy single-image posts (no image_options)
  const legacyEmbedUrl = !hasOptions ? toEmbedUrl(post.image_url) : null

  async function handleReview(reviewAction: 'approve' | 'reject', notes: string) {
    if (reviewAction === 'reject' && !notes.trim()) { setError('Notes are required when rejecting'); return }
    setSubmitting(true); setError('')
    const body: Record<string, unknown> = {
      action: reviewAction,
      reviewer_notes: notes.trim() || null,
    }
    if (reviewAction === 'approve') {
      body.selected_images = Array.from(selectedImages)
    }
    const res = await fetch(`/api/ms-social/posts/${post.id}/review`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      body: JSON.stringify({
        description:   action.description,
        image_options: action.image_options.filter(u => u.trim()),
        publish_date:  action.publish_date,
        platform:      action.platform,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Failed'); return }
    onUpdate({ ...post, ...data.post })
    setAction({ type: 'idle' })
  }

  return (
    <>
      <div ref={cardRef} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
        highlighted ? 'border-indigo-400 ring-2 ring-indigo-300/50' : 'border-slate-200'
      }`}>

        {/* ── Header ── */}
        <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3">
          <Avatar name={name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-[15px] leading-tight">{name}</span>
              <span className="text-[11px] text-slate-400 border border-slate-300 rounded px-1 leading-4">1st</span>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5">Finsmart Accounting</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-slate-400">{post.platform} · {timeAgo(post.created_at)}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5">
                Publish: {fmtPublishDate(post.publish_date)}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-4 sm:px-5 pb-3">
          <PostText text={post.description} />
        </div>

        {/* ── Reviewer notes (already reviewed) ── */}
        {post.status !== 'pending' && post.reviewer_notes && action.type === 'idle' && (
          <div className={`mx-4 sm:mx-5 mb-3 rounded-xl px-4 py-3 text-sm ${
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

        {/* ── Image options (multi-image) ── */}
        {hasOptions && action.type === 'idle' && (
          <ImageOptionsGrid
            options={imageOptions}
            checked={selectedImages}
            onToggle={toggleImage}
            onLightbox={setLightbox}
            readOnly={post.status !== 'pending'}
          />
        )}

        {/* ── Legacy single image ── */}
        {!hasOptions && legacyEmbedUrl && action.type === 'idle' && (
          <div className="relative group mx-4 sm:mx-5 mb-4 rounded-xl overflow-hidden border border-slate-200">
            <img src={legacyEmbedUrl} alt="" className="w-full" />
            <button
              onClick={() => setLightbox(post.image_url!)}
              className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white transition">
              <Maximize2 size={13} />
            </button>
          </div>
        )}

        {/* ── Action bar: pending ── */}
        {post.status === 'pending' && action.type === 'idle' && (
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-slate-100">
            <button onClick={() => { setAction({ type: 'approve', notes: '' }); setError('') }}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm">
              <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => { setAction({ type: 'reject', notes: '' }); setError('') }}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition shadow-sm">
              <XCircle size={15} /> Reject
            </button>
            <button onClick={() => {
              setAction({
                type: 'edit',
                description:   post.description,
                image_options: post.image_options?.length > 0 ? post.image_options : [''],
                publish_date:  post.publish_date,
                platform:      post.platform,
              })
              setError('')
            }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              <PenLine size={14} /> Edit
            </button>
          </div>
        )}

        {/* ── Re-review bar ── */}
        {post.status !== 'pending' && action.type === 'idle' && (
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-slate-100">
            <button onClick={() => { setAction({ type: 'approve', notes: '' }); setError('') }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition">
              <CheckCircle size={13} /> Approve
            </button>
            <button onClick={() => { setAction({ type: 'reject', notes: '' }); setError('') }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition">
              <XCircle size={13} /> Reject
            </button>
            <button onClick={() => {
              setAction({
                type: 'edit',
                description:   post.description,
                image_options: post.image_options?.length > 0 ? post.image_options : [''],
                publish_date:  post.publish_date,
                platform:      post.platform,
              })
              setError('')
            }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              <PenLine size={13} /> Edit
            </button>
          </div>
        )}

        {/* ── Approve panel ── */}
        {action.type === 'approve' && (
          <div className="border-t border-emerald-100 bg-emerald-50 px-4 sm:px-5 py-4 space-y-3">
            {hasOptions && (
              <div>
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
                  Selected images ({selectedImages.size})
                  <span className="normal-case font-normal text-emerald-600 ml-1">— tick the images above to include</span>
                </p>
                {selectedImages.size === 0 && (
                  <p className="text-[12px] text-emerald-600 italic">No images selected — post will be approved without images</p>
                )}
              </div>
            )}
            <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Approval Notes <span className="normal-case font-normal text-emerald-600">(optional)</span>
            </label>
            <textarea className={inputCls} rows={2} placeholder="Any notes for the employee…"
              value={action.notes}
              onChange={e => setAction(a => a.type === 'approve' ? { ...a, notes: e.target.value } : a)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
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
          <div className="border-t border-red-100 bg-red-50 px-4 sm:px-5 py-4 space-y-3">
            <label className="block text-[11px] font-bold text-red-700 uppercase tracking-wider">
              Rejection Notes <span className="normal-case font-normal text-red-600">* required</span>
            </label>
            <textarea className={inputCls} rows={2} placeholder="Explain what needs to change…"
              value={action.notes}
              onChange={e => setAction(a => a.type === 'reject' ? { ...a, notes: e.target.value } : a)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
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
          <div className="border-t border-slate-100 bg-slate-50 px-4 sm:px-5 py-5 space-y-4">
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
            {/* Image options edit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Image Options
                </label>
                {action.image_options.length < 5 && (
                  <button type="button"
                    onClick={() => setAction(a => a.type === 'edit' ? { ...a, image_options: [...a.image_options, ''] } : a)}
                    className="text-[11px] font-semibold text-pink-600 hover:text-pink-700 transition">
                    + Add
                  </button>
                )}
              </div>
              {action.image_options.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={inputCls}
                    placeholder={`Image ${i + 1} URL`}
                    value={url}
                    onChange={e => {
                      const v = e.target.value
                      setAction(a => a.type === 'edit' ? { ...a, image_options: a.image_options.map((u, j) => j === i ? v : u) } : a)
                    }} />
                  {action.image_options.length > 1 && (
                    <button type="button"
                      onClick={() => setAction(a => a.type === 'edit' ? { ...a, image_options: a.image_options.filter((_, j) => j !== i) } : a)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{error}</p>}
            <div className="flex flex-wrap items-center gap-3">
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

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}

// ── Main review view ──────────────────────────────────────────────────────────

function ReviewClientInner({ initialPosts }: { initialPosts: SocialPost[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const searchParams      = useSearchParams()
  const highlightId       = searchParams.get('post')

  const highlightPost = highlightId ? posts.find(p => p.id === highlightId) : null
  const defaultTab    = highlightPost && highlightPost.status !== 'pending' ? 'all' : 'pending'
  const [tab, setTab] = useState<'pending' | 'all'>(defaultTab)

  const highlightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [])

  function handleUpdate(updated: SocialPost) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const pendingCount  = posts.filter(p => p.status === 'pending').length
  const approvedCount = posts.filter(p => p.status === 'approved').length
  const rejectedCount = posts.filter(p => p.status === 'rejected').length
  const filtered      = tab === 'pending' ? posts.filter(p => p.status === 'pending') : posts

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
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
            <ReviewCard
              key={post.id}
              post={post}
              onUpdate={handleUpdate}
              highlighted={post.id === highlightId}
              cardRef={post.id === highlightId ? highlightRef : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MsSocialReviewClient({ initialPosts }: { initialPosts: SocialPost[] }) {
  return (
    <Suspense fallback={null}>
      <ReviewClientInner initialPosts={initialPosts} />
    </Suspense>
  )
}
