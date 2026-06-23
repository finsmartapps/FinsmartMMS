'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, has_sales, has_marketing, has_expenses, is_active')
      .eq('id', data.user.id)
      .single()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      setError('Your account is inactive. Contact your administrator.')
      setLoading(false)
      return
    }

    if (profile.has_sales) {
      router.push(profile.role === 'manager' ? '/sales/manager' : '/sales/telecaller')
    } else if (profile.has_marketing) {
      router.push('/marketing')
    } else if (profile.has_expenses) {
      router.push('/expenses')
    } else {
      setError('No modules assigned to your account. Contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] px-4">

      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[14px] gradient-brand mb-4 shadow-md">
          <span className="text-white text-xl font-bold tracking-tight">F</span>
        </div>
        <h1 className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">Finsmart MMS</h1>
        <p className="text-[#6E6E73] mt-1 text-sm">Management & Marketing Suite</p>
      </div>

      <div className="w-full max-w-[360px] bg-white rounded-2xl border border-[#E5E5EA] shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="w-full border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-sm placeholder-[#AEAEB2] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-sm placeholder-[#AEAEB2] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] hover:text-[#6E6E73] transition"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#DC2626] hover:bg-[#C91C1C] active:bg-[#B91C1C] text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm mt-1"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="text-[#AEAEB2] text-xs mt-6">
        © {new Date().getFullYear()} Finsmart Accounting
      </p>
    </div>
  )
}
