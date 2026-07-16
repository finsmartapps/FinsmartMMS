'use client'

import { useState, useMemo } from 'react'
import { BarChart2, X, ExternalLink, Users } from 'lucide-react'

type SocialPost = {
  id: string
  description: string
  image_url: string | null
  publish_date: string
  platform: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer_notes: string | null
  created_at: string
  creator_name: string | null
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400'   },
  approved: { label: 'Approved',       badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected: { label: 'Changes Needed', badgeCls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400'     },
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtPublishDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function PostsModal({ title, posts, onClose }: { title: string; posts: SocialPost[]; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {posts.map(post => {
              const cfg = STATUS_CONFIG[post.status]
              return (
                <div key={post.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Submitted: {fmtDate(post.created_at.split('T')[0])}</span>
                      <span className="text-blue-600 font-semibold">Publish: {fmtPublishDate(post.publish_date)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{post.description}</p>
                  {post.image_url && (
                    <a href={post.image_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-pink-600 transition">
                      <ExternalLink size={11} /> View image
                    </a>
                  )}
                  {post.reviewer_notes && (
                    <div className={`text-[12px] rounded-lg px-3 py-2 ${
                      post.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <span className="font-semibold">Note: </span>{post.reviewer_notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

export function MsSocialAnalyticsClient({ posts }: { posts: SocialPost[] }) {
  const [modal, setModal] = useState<{ title: string; posts: SocialPost[] } | null>(null)

  const userRows = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const p of posts) {
      const user = p.creator_name ?? 'Unknown'
      if (!map.has(user)) map.set(user, [])
      map.get(user)!.push(p)
    }
    return Array.from(map.entries())
      .map(([user, userPosts]) => ({
        user,
        total:    userPosts.length,
        approved: userPosts.filter(p => p.status === 'approved'),
        pending:  userPosts.filter(p => p.status === 'pending'),
        rejected: userPosts.filter(p => p.status === 'rejected'),
        lastSubmitted: userPosts.map(p => p.created_at).sort().at(-1) ?? '',
      }))
      .sort((a, b) => b.total - a.total)
  }, [posts])

  const totals = {
    total:    posts.length,
    approved: posts.filter(p => p.status === 'approved').length,
    pending:  posts.filter(p => p.status === 'pending').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  }

  function open(title: string, filtered: SocialPost[]) {
    if (filtered.length > 0) setModal({ title, posts: filtered })
  }

  const Num = ({ count, color, title, filtered }: {
    count: number; color: string; title: string; filtered: SocialPost[]
  }) => (
    <td className="px-4 py-3.5 text-center tabular-nums">
      {count > 0 ? (
        <button onClick={() => open(title, filtered)}
          className={`font-bold text-[15px] hover:underline transition ${color}`}>
          {count}
        </button>
      ) : (
        <span className="text-slate-200 text-sm select-none">—</span>
      )}
    </td>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Post submission activity across all team members</p>
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <Users size={13} className="text-slate-400" />
          <span className="font-bold text-slate-700">{userRows.length}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Contributors</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="font-bold text-slate-700">{totals.total}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Total Posts</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-emerald-600">{totals.approved}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Approved</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-bold text-amber-600">{totals.pending}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Pending</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-sm">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-bold text-red-600">{totals.rejected}</span>
          <span className="text-slate-400 text-[12px] ml-0.5">Rejected</span>
        </div>
      </div>

      {/* Table */}
      {userRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-20 text-center">
          <BarChart2 size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">No posts yet</p>
          <p className="text-sm text-slate-400 mt-1">Posts from team members will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 w-8">Sr.</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Team Member</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-emerald-600">Approved</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-red-600">Rejected</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userRows.map((r, i) => (
                  <tr key={r.user} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3.5 text-slate-400 text-[13px]">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center shrink-0 text-white text-[11px] font-bold">
                          {r.user.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{r.user}</span>
                      </div>
                    </td>
                    <Num count={r.total}             color="text-slate-700"   title={`${r.user} — All Posts`}    filtered={[...r.approved, ...r.pending, ...r.rejected]} />
                    <Num count={r.approved.length}   color="text-emerald-600" title={`${r.user} — Approved`}     filtered={r.approved} />
                    <Num count={r.pending.length}    color="text-amber-600"   title={`${r.user} — Pending`}      filtered={r.pending} />
                    <Num count={r.rejected.length}   color="text-red-600"     title={`${r.user} — Rejected`}     filtered={r.rejected} />
                    <td className="px-4 py-3.5 text-slate-500 text-[13px] whitespace-nowrap">
                      {r.lastSubmitted ? fmtDate(r.lastSubmitted.split('T')[0]) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-[12px] font-bold text-slate-600">
                    Total · {userRows.length} member{userRows.length !== 1 ? 's' : ''}
                  </td>
                  <Num count={totals.total}    color="text-slate-700"   title="All Posts"    filtered={posts} />
                  <Num count={totals.approved} color="text-emerald-700" title="All Approved" filtered={posts.filter(p => p.status === 'approved')} />
                  <Num count={totals.pending}  color="text-amber-700"   title="All Pending"  filtered={posts.filter(p => p.status === 'pending')} />
                  <Num count={totals.rejected} color="text-red-700"     title="All Rejected" filtered={posts.filter(p => p.status === 'rejected')} />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {modal && <PostsModal title={modal.title} posts={modal.posts} onClose={() => setModal(null)} />}
    </div>
  )
}
