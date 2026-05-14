'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, User,
  CheckCircle2, Circle, Check
} from 'lucide-react'

function SteamIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.718L.229 13.26C1.118 19.232 6.019 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' }
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-yellow-500' }
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-blue-400' }
  return { score: 4, label: 'Strong', color: 'bg-[#00ff87]' }
}

function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters.'
  if (username.length > 20) return 'Username must be 20 characters or fewer.'
  if (!/^[a-z0-9_]+$/.test(username)) return 'Username can only contain lowercase letters, numbers, and underscores.'
  if (/\s/.test(username)) return 'Username cannot contain spaces.'
  return null
}

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'discord' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()
  const passwordStrength = getPasswordStrength(password)

  function handleUsernameChange(value: string) {
    const lower = value.toLowerCase()
    setUsername(lower)
    if (lower.length > 0) {
      setUsernameError(validateUsername(lower))
    } else {
      setUsernameError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const usernameValidationError = validateUsername(username)
    if (usernameValidationError) {
      setUsernameError(usernameValidationError)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!acceptTerms) {
      setError('You must accept the terms of service to create an account.')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: username,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
          setError('An account with this email already exists. Try signing in instead.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: 'discord') {
    setError(null)
    setOauthLoading(provider)

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch {
      setError('OAuth sign-in failed. Please try again.')
      setOauthLoading(null)
    }
  }

  // Success state — email verification prompt
  if (success) {
    return (
      <div className="glass-card rounded-xl border border-white/10 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#00ff87]/10 border border-[#00ff87]/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#00ff87]" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">Check your email</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-2">
          We&apos;ve sent a confirmation link to:
        </p>
        <p className="text-white font-semibold mb-6">{email}</p>
        <p className="text-white/40 text-sm leading-relaxed mb-8">
          Click the link in the email to verify your account and get started.
          If you don&apos;t see it, check your spam folder.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[#00ff87] hover:text-[#00ff87]/80 font-medium text-sm transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl border border-white/10 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start analyzing your CS2 demos for free</p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={() => handleOAuth('discord')}
          disabled={loading || oauthLoading !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/10 bg-[#5865f2] hover:bg-[#5865f2]/80 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {oauthLoading === 'discord' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DiscordIcon />
          )}
          Continue with Discord
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#0e1218] px-3 text-white/40">or continue with email</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Username */}
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-medium text-foreground">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              required
              autoComplete="username"
              placeholder="yourname"
              disabled={loading || oauthLoading !== null}
              maxLength={20}
              className={`w-full h-10 pl-10 pr-4 rounded-lg border bg-white/5 text-sm text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                usernameError
                  ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50'
                  : username.length >= 3 && !usernameError
                  ? 'border-[#00ff87]/30 focus:ring-[#00ff87]/30 focus:border-[#00ff87]/50'
                  : 'border-white/10 focus:ring-[#00ff87]/50 focus:border-[#00ff87]/50'
              }`}
            />
            {username.length >= 3 && !usernameError && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00ff87]" />
            )}
          </div>
          {usernameError ? (
            <p className="text-xs text-red-400">{usernameError}</p>
          ) : (
            <p className="text-xs text-white/30">3–20 chars, lowercase letters, numbers, underscores only</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={loading || oauthLoading !== null}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-white/10 bg-white/5 text-sm text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00ff87]/50 focus:border-[#00ff87]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Min 8 characters"
              disabled={loading || oauthLoading !== null}
              className="w-full h-10 pl-10 pr-10 rounded-lg border border-white/10 bg-white/5 text-sm text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00ff87]/50 focus:border-[#00ff87]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength indicator */}
          {password.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      passwordStrength.score >= level
                        ? passwordStrength.color
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  {password.length >= 8 ? (
                    <CheckCircle2 className="w-3 h-3 text-[#00ff87]" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  8+ chars
                </div>
                <span className={`text-xs font-medium ${
                  passwordStrength.score === 4 ? 'text-[#00ff87]' :
                  passwordStrength.score === 3 ? 'text-blue-400' :
                  passwordStrength.score === 2 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {passwordStrength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
              disabled={loading || oauthLoading !== null}
              className={`w-full h-10 pl-10 pr-10 rounded-lg border bg-white/5 text-sm text-foreground placeholder:text-white/30 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmPassword.length > 0 && password !== confirmPassword
                  ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50'
                  : confirmPassword.length > 0 && password === confirmPassword
                  ? 'border-[#00ff87]/30 focus:ring-[#00ff87]/30 focus:border-[#00ff87]/50'
                  : 'border-white/10 focus:ring-[#00ff87]/50 focus:border-[#00ff87]/50'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-red-400">Passwords do not match.</p>
          )}
          {confirmPassword.length > 0 && password === confirmPassword && (
            <p className="text-xs text-[#00ff87]">Passwords match.</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2.5">
          <input
            id="terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={loading || oauthLoading !== null}
            className="w-4 h-4 mt-0.5 rounded border border-white/20 bg-white/5 accent-[#00ff87] cursor-pointer flex-shrink-0"
          />
          <label htmlFor="terms" className="text-sm text-white/50 leading-relaxed cursor-pointer select-none">
            I agree to the{' '}
            <Link href="/terms" className="text-[#00ff87] hover:text-[#00ff87]/80 transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[#00ff87] hover:text-[#00ff87]/80 transition-colors">
              Privacy Policy
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            oauthLoading !== null ||
            !email ||
            !password ||
            !confirmPassword ||
            !username ||
            !!usernameError ||
            !acceptTerms ||
            password !== confirmPassword
          }
          className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-[#00ff87] text-black font-bold text-sm hover:bg-[#00ff87]/90 transition-all neon-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/40">
        Already have an account?{' '}
        <Link href="/login" className="text-[#00ff87] hover:text-[#00ff87]/80 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
