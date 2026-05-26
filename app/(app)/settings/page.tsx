'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Bell, Shield, Brain, Palette, AlertTriangle,
  User, Check, Loader2, Eye, EyeOff, Save,
  ToggleLeft, ToggleRight, Trash2, Lock, Mail
} from 'lucide-react'
import type { UserSettings } from '@/types/database'

type AIModel = 'gpt-4o' | 'grok-2' | 'claude-3-5-sonnet'
type ResponseStyle = 'detailed' | 'concise' | 'coaching'

interface Toggle {
  label: string
  description: string
  key: keyof Pick<UserSettings, 'email_notifications' | 'ai_coach_ready' | 'public_profile'>
  value: boolean
}

const AI_MODELS: { id: AIModel; label: string; desc: string; badge?: string }[] = [
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'OpenAI flagship — best reasoning & analysis', badge: 'Recommended' },
  { id: 'grok-2', label: 'Grok-2', desc: 'xAI model — fast and conversational' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', desc: 'Anthropic model — excellent at strategy' },
]

const RESPONSE_STYLES: { id: ResponseStyle; label: string; desc: string }[] = [
  { id: 'detailed', label: 'Detailed', desc: 'In-depth analysis with thorough explanations' },
  { id: 'concise', label: 'Concise', desc: 'Short, punchy insights with bullet points' },
  { id: 'coaching', label: 'Coaching Style', desc: 'Motivational and constructive feedback' },
]

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none',
        checked ? 'bg-neon-green border-neon-green' : 'bg-muted border-border'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full transition-transform bg-white shadow-sm',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

function ConfirmDeleteDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const [confirm, setConfirm] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-400/20 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Delete Account</h2>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          This will permanently delete your account, all teams you own, all uploaded demos, and all AI Coach sessions.
          Type <strong className="text-foreground">DELETE</strong> to confirm.
        </p>

        <Input
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="mb-4 border-red-400/30 focus:border-red-400/60"
        />

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            disabled={confirm !== 'DELETE' || loading}
            onClick={onConfirm}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    email_notifications: true,
    ai_coach_ready: true,
    public_profile: false,
    ai_model_preference: 'gpt-4o',
    ai_response_style: 'detailed',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (data) setSettings(data as UserSettings)
      setLoading(false)
    }
    fetchSettings()
  }, [])

  const saveSettings = async (updates: Partial<UserSettings>) => {
    const merged = { ...settings, ...updates }
    setSettings(merged)
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_settings').upsert({
      user_id: user.id,
      ...merged,
      updated_at: new Date().toISOString(),
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const handleToggle = (key: keyof UserSettings, val: boolean) => {
    saveSettings({ [key]: val })
  }

  const handlePasswordChange = async () => {
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setPasswordSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    }
    setPasswordSaving(false)
  }

  const handleEmailChange = async () => {
    if (!newEmail.includes('@')) return
    setEmailSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (!error) {
      setEmailSaved(true)
      setNewEmail('')
      setTimeout(() => setEmailSaved(false), 3000)
    }
    setEmailSaving(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json()
        console.error('Failed to delete account:', error)
        setDeleting(false)
        return
      }
      // Account deleted — sign out client session and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-neon-green" size={32} />
      </div>
    )
  }

  const NOTIFICATION_TOGGLES: Toggle[] = [
    {
      label: 'Email Notifications',
      description: 'Receive email updates about your account',
      key: 'email_notifications',
      value: !!settings.email_notifications,
    },
    {
      label: 'AI Coach Ready',
      description: 'Notify when AI analysis is complete',
      key: 'ai_coach_ready',
      value: !!settings.ai_coach_ready,
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 md:space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and configuration</p>
      </div>

      {/* Save indicator */}
      {(saving || saved) && (
        <div className={cn(
          'flex items-center gap-2 text-sm px-3 py-2 rounded-md border w-fit transition-all',
          saved ? 'text-neon-green bg-neon-green/10 border-neon-green/30' : 'text-muted-foreground bg-muted/30 border-border'
        )}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving...' : 'Saved!'}
        </div>
      )}

      {/* Account */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User size={16} className="text-neon-green" />
            Account
          </CardTitle>
          <CardDescription>Manage your email and password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Change Email */}
          <div className="p-4 rounded-lg bg-muted/10 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Change Email</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="New email address"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleEmailChange}
                disabled={!newEmail || emailSaving}
                className="gap-2 shrink-0 h-11 sm:h-10"
              >
                {emailSaving ? <Loader2 size={13} className="animate-spin" /> : emailSaved ? <Check size={13} className="text-neon-green" /> : <Mail size={13} />}
                {emailSaved ? 'Sent!' : 'Update'}
              </Button>
            </div>
            {emailSaved && (
              <p className="text-xs text-neon-green">Confirmation email sent. Check your inbox.</p>
            )}
          </div>

          {/* Change Password */}
          <div className="p-4 rounded-lg bg-muted/10 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Change Password</p>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-400">{passwordError}</p>
            )}
            {passwordSaved && (
              <p className="text-xs text-neon-green">Password updated successfully!</p>
            )}

            <Button
              variant="outline"
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || passwordSaving}
              className="gap-2"
            >
              {passwordSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell size={16} className="text-neon-green" />
            Notifications
          </CardTitle>
          <CardDescription>Control what notifications you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIFICATION_TOGGLES.map(toggle => (
            <div key={toggle.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
              <div>
                <p className="text-sm font-medium text-foreground">{toggle.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{toggle.description}</p>
              </div>
              <ToggleSwitch
                checked={toggle.value}
                onChange={val => handleToggle(toggle.key, val)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield size={16} className="text-neon-green" />
            Privacy
          </CardTitle>
          <CardDescription>Control your profile visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
            <div>
              <p className="text-sm font-medium text-foreground">Public Profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow others to view your profile and stats</p>
            </div>
            <ToggleSwitch
              checked={!!settings.public_profile}
              onChange={val => handleToggle('public_profile', val)}
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10 opacity-60">
            <div>
              <p className="text-sm font-medium text-foreground">Demo Sharing</p>
              <p className="text-xs text-muted-foreground mt-0.5">Allow sharing demo analysis links publicly</p>
            </div>
            <ToggleSwitch checked={false} onChange={() => {}} />
          </div>
        </CardContent>
      </Card>

      {/* AI Coach Preferences */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain size={16} className="text-neon-green" />
            AI Coach Preferences
          </CardTitle>
          <CardDescription>Customize your AI coaching experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model selector */}
          <div>
            <Label className="text-sm font-medium mb-3 block">AI Model</Label>
            <div className="space-y-2">
              {AI_MODELS.map(model => {
                const active = settings.ai_model_preference === model.id
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => saveSettings({ ai_model_preference: model.id })}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all duration-150',
                      active
                        ? 'border-neon-green/40 bg-neon-green/5'
                        : 'border-border bg-muted/10 hover:border-neon-green/20 hover:bg-muted/20'
                    )}
                  >
                    {/* Radio */}
                    <div className={cn(
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      active ? 'border-neon-green' : 'border-border'
                    )}>
                      {active && <div className="w-2 h-2 rounded-full bg-neon-green" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{model.label}</p>
                        {model.badge && (
                          <Badge variant="neon" className="text-xs">{model.badge}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{model.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Response style */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Response Style</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {RESPONSE_STYLES.map(style => {
                const active = settings.ai_response_style === style.id
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => saveSettings({ ai_response_style: style.id })}
                    className={cn(
                      'flex flex-col items-start gap-1 p-4 rounded-lg border text-left transition-all duration-150',
                      active
                        ? 'border-neon-green/40 bg-neon-green/5'
                        : 'border-border bg-muted/10 hover:border-neon-green/20 hover:bg-muted/20'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={cn(
                        'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                        active ? 'border-neon-green' : 'border-border'
                      )}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-neon-green" />}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{style.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{style.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette size={16} className="text-neon-green" />
            Appearance
          </CardTitle>
          <CardDescription>Visual preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/10">
            <div>
              <p className="text-sm font-medium text-foreground">Dark Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">Rivalize is optimized for dark mode</p>
            </div>
            <ToggleSwitch checked={true} onChange={() => {}} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">Light mode coming soon.</p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-400/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-red-400/20 bg-red-400/5">
            <div>
              <p className="text-sm font-medium text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all data. Cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2 shrink-0 h-11 sm:h-9 w-full sm:w-auto"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 size={13} />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      {showDeleteDialog && (
        <ConfirmDeleteDialog
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteDialog(false)}
          loading={deleting}
        />
      )}
    </div>
  )
}
