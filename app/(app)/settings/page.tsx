'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'
import {
  Bell, Shield, Brain, Palette, AlertTriangle,
  User, Check, Loader2, Eye, EyeOff,
  Trash2, Lock, Mail
} from 'lucide-react'
import type { UserSettings } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'

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

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'ai', label: 'AI Coach', icon: Brain },
  { id: 'appearance', label: 'Appearance', icon: Palette },
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
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('account')
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
    <div className="p-4 md:p-6 max-w-3xl space-y-5 md:space-y-6">
      {/* Page header */}
      <PageHeader
        label="Account"
        title="Settings"
        description="Manage your account preferences and configuration"
      />

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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 3, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500,
              background: activeTab === tab.id ? 'var(--accent-soft)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--muted)',
              transition: 'all 0.14s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account tab */}
      {activeTab === 'account' && (
        <div className="rv-panel p-5 space-y-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <User size={15} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Account</p>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: -12, marginBottom: 8 }}>Manage your email and password</p>

          {/* Change Email */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Mail size={14} style={{ color: 'var(--muted)' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Change Email</p>
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
              <p className="text-xs text-neon-green mt-2">Confirmation email sent. Check your inbox.</p>
            )}
          </div>

          {/* Change Password */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Lock size={14} style={{ color: 'var(--muted)' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Change Password</p>
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
              <p className="text-xs text-red-400 mt-2">{passwordError}</p>
            )}
            {passwordSaved && (
              <p className="text-xs text-neon-green mt-2">Password updated successfully!</p>
            )}

            <Button
              variant="outline"
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || passwordSaving}
              className="gap-2 mt-3"
            >
              {passwordSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              Update Password
            </Button>
          </div>

          {/* Danger Zone */}
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.04)', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={14} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>Danger Zone</p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Irreversible account actions</p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <div className="rv-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Bell size={15} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Notifications</p>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>Control what notifications you receive</p>

          <div>
            {NOTIFICATION_TOGGLES.map((toggle, i) => (
              <div
                key={toggle.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{toggle.label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{toggle.description}</p>
                </div>
                <ToggleSwitch
                  checked={toggle.value}
                  onChange={val => handleToggle(toggle.key, val)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy tab */}
      {activeTab === 'privacy' && (
        <div className="rv-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Shield size={15} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Privacy</p>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>Control your profile visibility</p>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Public Profile</p>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Allow others to view your profile and stats</p>
              </div>
              <ToggleSwitch
                checked={!!settings.public_profile}
                onChange={val => handleToggle('public_profile', val)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)', opacity: 0.5 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Demo Sharing</p>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Allow sharing demo analysis links publicly</p>
              </div>
              <ToggleSwitch checked={false} onChange={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* AI Coach tab */}
      {activeTab === 'ai' && (
        <div className="rv-panel p-5 space-y-6">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Brain size={15} style={{ color: 'var(--accent)' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>AI Coach Preferences</p>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Customize your AI coaching experience</p>
          </div>

          {/* Model selector */}
          <div>
            <Label className="text-sm font-medium mb-3 block">AI Model</Label>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }} className="space-y-2">
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
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
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
          </div>
        </div>
      )}

      {/* Appearance tab */}
      {activeTab === 'appearance' && (
        <div className="rv-panel p-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Palette size={15} style={{ color: 'var(--accent)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Appearance</p>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16 }}>Visual preferences</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Dark Mode</p>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Toggle between dark and light interface</p>
            </div>
            <ToggleSwitch checked={theme === 'dark'} onChange={val => setTheme(val ? 'dark' : 'light')} />
          </div>
        </div>
      )}

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
