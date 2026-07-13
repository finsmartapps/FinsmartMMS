import { createAuthAdminClient } from '@/lib/supabase/server'
import { MsSocialApprovalClient } from '@/components/ms-social/MsSocialApprovalClient'

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAuthAdminClient()

  const { data, error } = await supabase
    .from('ms_social_posts')
    .select('*, creator:profiles!created_by(name)')
    .eq('approval_token', token)
    .single()

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-4">
        <div className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[14px] gradient-brand mb-6 shadow-md">
          <span className="text-white text-xl font-bold tracking-tight">F</span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Link not found</h1>
        <p className="text-slate-500 text-sm text-center">This approval link is invalid or the post has been removed.</p>
      </div>
    )
  }

  const post = { ...data, creator_name: data.creator?.name ?? null, creator: undefined }

  return <MsSocialApprovalClient initialPost={post} token={token} />
}
