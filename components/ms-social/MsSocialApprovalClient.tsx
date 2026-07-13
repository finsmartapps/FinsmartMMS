'use client'

import { useState } from 'react'
import {
  Loader2, CheckCircle, XCircle, PenLine,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
} from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  publish_date: string
  platform: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  creator_name: string | null
  created_at: string
  approval_token: string
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

function fmtPublishDate(iso: string) {
  const d  = new Date(iso + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 60)  return `${m}m ago`
  const h  = Math.floor(m  / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

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

function PostImage({ url, linkUrl }: { url: string; linkUrl: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer"
      className="block w-full overflow-hidden bg-slate-100">
      <img src={url} alt="" className="w-full" onError={() => setFailed(true)} />
    </a>
  )
}

type PanelState = 'idle' | 'approve' | 'reject' | 'edit'

export function MsSocialApprovalClient({
  initialPost,
  token,
}: {
  initialPost: SocialPost
  token: string
}) {
  const [post,       setPost]       = useState(initialPost)
  const [panel,      setPanel]      = useState<PanelState>('idle')
  const [notes,      setNotes]      = useState('')
  const [editForm,   setEditForm]   = useState({
    description: initialPost.description,
    image_url: initialPost.image_url ?? '',
    publish_date: initialPost.publish_date,
    platform: initialPost.platform,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState<'approved' | 'rejected' | 'saved' | null>(null)

  const embedUrl = toEmbedUrl(post.image_url)
  const name     = post.creator_name ?? 'Unknown'

  async function callApi(body: Record<string, unknown>) {
    setSubmitting(true); setError('')
    const res = await fetch(`/api/ms-social/approve/${token}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return false }
    setPost(data.post)
    return true
  }

  async function handleApprove() {
    const ok = await callApi({ action: 'approve', reviewer_notes: notes })
    if (ok) setDone('approved')
  }

  async function handleReject() {
    if (!notes.trim()) { setError('Please add notes explaining what needs to change'); return }
    const ok = await callApi({ action: 'reject', reviewer_notes: notes })
    if (ok) setDone('rejected')
  }

  async function handleEdit() {
    if (!editForm.description.trim()) { setError('Description is required'); return }
    if (!editForm.publish_date) { setError('Publish date is required'); return }
    const ok = await callApi({
      action: 'edit',
      description: editForm.description,
      image_url: editForm.image_url,
      publish_date: editForm.publish_date,
      platform: editForm.platform,
    })
    if (ok) { setDone('saved'); setPanel('idle') }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] gradient-brand shadow-sm flex-shrink-0">
            <span className="text-white text-sm font-bold tracking-tight">F</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-slate-900 leading-tight">Finsmart MMS</p>
            <p className="text-[11px] text-slate-400">LinkedIn post approval request</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Success banner ── */}
        {done === 'approved' && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Post approved!</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {name} has been notified. The post is cleared for publishing on {fmtPublishDate(post.publish_date)}.
              </p>
            </div>
          </div>
        )}

        {done === 'rejected' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <AlertCircle size={22} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Post returned for edits</p>
              <p className="text-sm text-red-700 mt-0.5">Your feedback has been sent to {name} to revise and resubmit.</p>
            </div>
          </div>
        )}

        {done === 'saved' && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <CheckCircle2 size={22} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-800">Changes saved</p>
              <p className="text-sm text-blue-700 mt-0.5">The post has been updated. You can still approve or reject it below.</p>
            </div>
          </div>
        )}

        {/* ── Already reviewed notice (when not done in this session) ── */}
        {!done && post.status !== 'pending' && (
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${
            post.status === 'approved'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            {post.status === 'approved'
              ? <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
              : <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
            }
            <p className="text-sm font-medium text-slate-700">
              This post was previously <strong>{post.status}</strong>.
              {post.reviewer_notes && <> Note: "{post.reviewer_notes}"</>}
              {' '}You can still change the decision below.
            </p>
          </div>
        )}

        {/* ── Post card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-start gap-3 px-5 pt-4 pb-3">
            <div className="w-11 h-11 min-w-[44px] rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-[15px]">{initials(name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-[15px]">{name}</span>
                <span className="text-[11px] text-slate-400 border border-slate-300 rounded px-1 leading-4">1st</span>
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">Finsmart Accounting</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-slate-400">{post.platform} · {timeAgo(post.created_at)}</span>
                <span className="inline-flex items-center text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5">
                  Publishing Date: {fmtPublishDate(post.publish_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="px-5 pb-3">
            <PostText text={post.description} />
          </div>

          {/* Image */}
          {embedUrl && panel === 'idle' && (
            <PostImage url={embedUrl} linkUrl={post.image_url!} />
          )}

          {/* ── Action bar ── */}
          {panel === 'idle' && (
            <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100">
              <button onClick={() => { setPanel('approve'); setNotes(''); setError('') }}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => { setPanel('reject'); setNotes(''); setError('') }}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition shadow-sm">
                <XCircle size={15} /> Reject
              </button>
              <button onClick={() => {
                setEditForm({ description: post.description, image_url: post.image_url ?? '', publish_date: post.publish_date, platform: post.platform })
                setPanel('edit'); setError('')
              }}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                <PenLine size={14} /> Edit
              </button>
            </div>
          )}

          {/* ── Approve panel ── */}
          {panel === 'approve' && (
            <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4 space-y-3">
              <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Approval Notes <span className="normal-case font-normal text-emerald-600">(optional)</span>
              </label>
              <textarea className={inputCls} rows={2} placeholder="Any notes for the employee…"
                value={notes} onChange={e => setNotes(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-3">
                <button onClick={handleApprove} disabled={submitting}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition shadow-sm">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Approving…' : 'Confirm Approve'}
                </button>
                <button onClick={() => { setPanel('idle'); setError('') }}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Reject panel ── */}
          {panel === 'reject' && (
            <div className="border-t border-red-100 bg-red-50 px-5 py-4 space-y-3">
              <label className="block text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Rejection Notes <span className="normal-case font-normal text-red-600">* required</span>
              </label>
              <textarea className={inputCls} rows={2} placeholder="Explain what needs to change…"
                value={notes} onChange={e => setNotes(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-3">
                <button onClick={handleReject} disabled={submitting}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition shadow-sm">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button onClick={() => { setPanel('idle'); setError('') }}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Edit panel ── */}
          {panel === 'edit' && (
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-5 space-y-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Edit Post</p>
              <textarea className={`${inputCls} resize-none`} rows={8} value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date *</label>
                  <input type="date" className={inputCls} value={editForm.publish_date}
                    onChange={e => setEditForm(f => ({ ...f, publish_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                  <select className={inputCls} value={editForm.platform}
                    onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}>
                    <option>LinkedIn</option>
                    <option>Twitter</option>
                    <option>Instagram</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Image URL <span className="normal-case font-normal text-slate-400">(Google Drive link or image URL)</span>
                </label>
                <input className={inputCls} placeholder="https://drive.google.com/file/d/…" value={editForm.image_url}
                  onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">{error}</p>}
              <div className="flex items-center gap-3">
                <button onClick={handleEdit} disabled={submitting}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-60 transition shadow-sm">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setPanel('idle'); setError('') }}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 pb-4">
          Finsmart MMS · This link was shared by {name} for approval
        </p>
      </div>
    </div>
  )
}
