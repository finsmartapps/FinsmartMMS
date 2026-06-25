'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [isRecovery, setIsRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token') || !hash.includes('type=recovery')) return
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return
    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => {
        setIsRecovery(true)
        window.history.replaceState({}, '', window.location.pathname)
      })
  }, [])

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

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError('')
    setResetLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setResetLoading(false)
      return
    }
    setResetDone(true)
    setResetLoading(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, has_sales, has_marketing, has_expenses')
        .eq('id', user.id)
        .single()
      if (profile) {
        setTimeout(() => {
          if (profile.has_sales) router.push(profile.role === 'manager' ? '/sales/manager' : '/sales/telecaller')
          else if (profile.has_marketing) router.push('/marketing')
          else if (profile.has_expenses) router.push('/expenses')
        }, 1500)
      }
    }
  }

  if (isRecovery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] px-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[14px] gradient-brand mb-4 shadow-md">
            <span className="text-white text-xl font-bold tracking-tight">F</span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">Set New Password</h1>
          <p className="text-[#6E6E73] mt-1 text-sm">Choose a new password for your account</p>
        </div>
        <div className="w-full max-w-[360px] bg-white rounded-2xl border border-[#E5E5EA] shadow-sm p-8">
          {resetDone ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="text-green-500" size={40} />
              <p className="text-[#1D1D1F] font-medium">Password updated!</p>
              <p className="text-[#6E6E73] text-sm">Redirecting you now…</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Min. 8 characters"
                    className="w-full border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-sm placeholder-[#AEAEB2] focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition bg-[#FAFAFA] pr-12"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] hover:text-[#6E6E73] transition">
                    {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-xl px-4 py-3">{error}</div>
              )}
              <button type="submit" disabled={resetLoading} className="w-full bg-[#DC2626] hover:bg-[#C91C1C] active:bg-[#B91C1C] text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm mt-1">
                {resetLoading && <Loader2 size={16} className="animate-spin" />}
                {resetLoading ? 'Updating…' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
        <p className="text-[#AEAEB2] text-xs mt-6">© {new Date().getFullYear()} Finsmart Accounting</p>
      </div>
    )
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
