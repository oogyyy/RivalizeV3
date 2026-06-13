'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, ChevronUp, ChevronDown, Check, Sliders, Send, Download, Upload, Plus, Trash2,
  TrendingUp, Brain, AlertCircle, Zap, BarChart3, Target, BookOpen, Layers, Film, ChevronRight,
  Loader2, X, UserPlus, MessageSquare, Copy, CheckCheck, ExternalLink,
} from 'lucide-react'
import type { DemoRowData } from './DemoListMultiSelect'
import MapFolderList, { type MapGroup } from './MapFolderList'
import DemoUploadButton from './DemoUploadButton'
import FaceitImportButton from './FaceitImportButton'
import EseaTeamLink from './EseaTeamLink'
import EseaMatchList from './EseaMatchList'

interface TeamOption {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

/** Per-map T/CT win split, computed in-DB (see team_self_map_side_splits). */
export type MapSideWins = Record<string, { tWins: number; ctWins: number; tTotal: number; ctTotal: number }>

interface MyTeamDashboardProps {
  selectedTeamId: string
  allTeams: TeamOption[]
  demos: DemoRowData[]
  /** Per-map T/CT split aggregated server-side (rounds[] never leaves the DB). */
  mapSideWins: MapSideWins
  teamName: string
  canEdit: boolean
  canInvite: boolean
  canDelete: boolean
  myFaceitId: string | null
  /** Linked FACEIT/ESEA team for this team, if any. */
  faceitTeamId: string | null
  faceitTeamName: string | null
  /** faceit_match_id values already uploaded for this team (for the "Analyzed" badge). */
  uploadedFaceitMatchIds: string[]
}

const ACTIVE_DUTY_MAPS = [
  'de_ancient', 'de_anubis', 'de_dust2', 'de_inferno',
  'de_mirage', 'de_nuke', 'de_overpass',
]

function buildMapGroups(demos: DemoRowData[]): MapGroup[] {
  const mapGroupMap = new Map<string, { demos: DemoRowData[]; wins: number; losses: number; draws: number; lastActivity: string }>()
  for (const map of ACTIVE_DUTY_MAPS) {
    mapGroupMap.set(map, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: '' })
  }
  for (const demo of demos) {
    const rawMap = (demo.parsed_data?.header?.map ?? demo.map ?? 'unknown').toLowerCase()
    const mapKey = (rawMap === 'processing' || rawMap === '') ? 'unknown' : rawMap
    if (!mapGroupMap.has(mapKey)) {
      mapGroupMap.set(mapKey, { demos: [], wins: 0, losses: 0, draws: 0, lastActivity: demo.created_at })
    }
    const g = mapGroupMap.get(mapKey)!
    g.demos.push(demo)
    if (demo.created_at > g.lastActivity) g.lastActivity = demo.created_at
    if (demo.status === 'completed') {
      const h = demo.parsed_data?.header
      const os = demo.parsed_data?.opponentSide ?? 'team2'
      if (h) {
        const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
        const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
        if (ours > theirs) g.wins++
        else if (ours === theirs) g.draws++
        else g.losses++
      }
    }
  }
  return [...mapGroupMap.entries()]
    .map(([map, data]) => ({ map, ...data }))
    .sort((a, b) => {
      const aHas = a.demos.length > 0, bHas = b.demos.length > 0
      if (aHas !== bHas) return aHas ? -1 : 1
      if (aHas) return b.lastActivity.localeCompare(a.lastActivity)
      const aIdx = ACTIVE_DUTY_MAPS.indexOf(a.map), bIdx = ACTIVE_DUTY_MAPS.indexOf(b.map)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return 0
    })
}

function computeStats(demos: DemoRowData[], mapSideWins: MapSideWins) {
  const completedDemos = demos.filter(d => d.status === 'completed')
  let totalMatches = 0, totalWins = 0, totalDraws = 0
  let totalKills = 0, totalDeaths = 0, totalAdr = 0, playerCount = 0
  const mapCounts: Record<string, number> = {}
  // Per-map T/CT split is computed server-side (rounds[] no longer egressed) and
  // passed in; see team_self_map_side_splits and the My Team page.
  type PlayerAccum = { kills: number; deaths: number; assists: number; adr: number; rating: number; games: number; entryKills: number; clutchWins: number; clutchAttempts: number }
  const myPlayerStats: Record<string, PlayerAccum> = {}

  for (const demo of completedDemos) {
    const pd = demo.parsed_data
    const h = pd?.header
    const opponentSide = pd?.opponentSide ?? 'team2'
    totalMatches++

    if (h) {
      const ourScore = opponentSide === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
      const theirScore = opponentSide === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
      if (ourScore > theirScore) totalWins++
      else if (ourScore === theirScore) totalDraws++
      if (h.map && h.map !== 'unknown') mapCounts[h.map] = (mapCounts[h.map] ?? 0) + 1
    }

    if (pd?.players) {
      const opponentLabel = opponentSide === 'team1' ? (h?.team1 ?? 'T-Side') : (h?.team2 ?? 'CT-Side')
      for (const p of pd.players) {
        if (p.team === opponentLabel) continue
        totalKills += p.kills
        totalDeaths += p.deaths
        totalAdr += p.adr
        playerCount++
        if (!myPlayerStats[p.name]) myPlayerStats[p.name] = { kills: 0, deaths: 0, assists: 0, adr: 0, rating: 0, games: 0, entryKills: 0, clutchWins: 0, clutchAttempts: 0 }
        myPlayerStats[p.name].kills += p.kills
        myPlayerStats[p.name].deaths += p.deaths
        myPlayerStats[p.name].assists += p.assists
        myPlayerStats[p.name].adr += p.adr
        myPlayerStats[p.name].rating += p.rating
        myPlayerStats[p.name].games += 1
        myPlayerStats[p.name].entryKills    += p.entry_kills    ?? 0
        myPlayerStats[p.name].clutchWins    += p.clutch_wins    ?? 0
        myPlayerStats[p.name].clutchAttempts += p.clutch_attempts ?? 0
      }
    }
  }

  const totalLosses = totalMatches - totalWins - totalDraws
  const winRate = totalMatches > 0 ? totalWins / totalMatches : 0
  const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '—'
  const avgAdr = playerCount > 0 ? (totalAdr / playerCount).toFixed(1) : '—'

  const topMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const topPlayers = Object.entries(myPlayerStats)
    .map(([name, s]) => ({
      name,
      kills: s.kills,
      deaths: s.deaths,
      avgAdr: s.games > 0 ? s.adr / s.games : 0,
      avgRating: s.games > 0 ? s.rating / s.games : 0,
      games: s.games,
      entryKills: s.entryKills,
      clutchRate: s.clutchAttempts > 0 ? s.clutchWins / s.clutchAttempts : null,
      clutchWins: s.clutchWins,
      clutchAttempts: s.clutchAttempts,
    }))
    .sort((a, b) => b.avgRating - a.avgRating)

  return { totalMatches, totalWins, totalLosses, totalDraws, winRate, avgKD, avgAdr, topMaps, topPlayers, mapSideWins }
}

const AI_COACH_ITEMS = [
  { title: 'Weak Spots',      desc: 'Identify recurring mistakes and areas to improve', icon: AlertCircle, color: 'var(--loss)',   focus: 'weakness' },
  { title: 'Executes',        desc: 'Review execute quality, utility usage, and timings', icon: Zap,       color: 'var(--accent)', focus: 'executes' },
  { title: 'Round Review',    desc: 'Analyze clutches, eco plays, and late rounds',       icon: BarChart3,  color: 'var(--ct)',     focus: 'rounds'   },
  { title: 'Practice Drills', desc: 'Personalized drill recommendations',                 icon: Target,     color: 'var(--signal)', focus: 'drills'   },
  { title: 'Strategy Coach',  desc: 'Build a playbook tailored to your roster',           icon: BookOpen,   color: 'var(--win)',    focus: 'strategy' },
]

export default function MyTeamDashboard({
  selectedTeamId,
  allTeams,
  demos,
  mapSideWins,
  teamName,
  canEdit,
  canInvite,
  canDelete,
  myFaceitId,
  faceitTeamId,
  faceitTeamName,
  uploadedFaceitMatchIds,
}: MyTeamDashboardProps) {
  const router = useRouter()
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'roster' | 'maps' | 'demos'>('overview')
  const [sideOverrides, setSideOverrides] = useState<Record<string, 'team1' | 'team2'>>({})

  // Modal state
  const [modal, setModal] = useState<'edit' | 'invite' | 'delete' | 'discord' | null>(null)
  // Edit name
  const [editName, setEditName] = useState(teamName)
  const [editNameSaving, setEditNameSaving] = useState(false)
  const [editNameError, setEditNameError] = useState<string | null>(null)
  // Delete
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Invite friends
  type FriendEntry = { id: string; profile: { id: string; username: string; display_name: string | null } }
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})

  // Discord integration
  type DiscordIntegration = { id: string; guild_id: string; guild_name: string | null; channel_id: string | null; created_at: string }
  const [discordLinkCode, setDiscordLinkCode] = useState<string | null>(null)
  const [discordIntegration, setDiscordIntegration] = useState<DiscordIntegration | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordWebhookInput, setDiscordWebhookInput] = useState('')
  const [discordConnecting, setDiscordConnecting] = useState(false)
  const [discordError, setDiscordError] = useState<string | null>(null)
  const [discordCodeCopied, setDiscordCodeCopied] = useState(false)
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false)

  function openDiscordModal() {
    setModal('discord' as typeof modal)
    setDiscordError(null)
    setDiscordWebhookInput('')
    setDiscordLoading(true)
    fetch(`/api/discord/setup?teamId=${selectedTeamId}`)
      .then(r => r.ok ? r.json() : Promise.resolve({}))
      .then(data => {
        setDiscordLinkCode(data.linkCode ?? null)
        setDiscordIntegration(data.integration ?? null)
      })
      .catch(() => {})
      .finally(() => setDiscordLoading(false))
  }

  async function handleDiscordConnect() {
    if (!discordWebhookInput.trim()) return
    setDiscordConnecting(true); setDiscordError(null)
    try {
      const res = await fetch('/api/discord/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId, webhookUrl: discordWebhookInput.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
      // Reload integration status
      const fresh = await fetch(`/api/discord/setup?teamId=${selectedTeamId}`)
      const freshData = fresh.ok ? await fresh.json() : {}
      setDiscordIntegration(freshData.integration ?? null)
      setDiscordWebhookInput('')
    } catch (err) {
      setDiscordError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setDiscordConnecting(false)
    }
  }

  async function handleDiscordDisconnect() {
    setDiscordDisconnecting(true); setDiscordError(null)
    try {
      await fetch('/api/discord/setup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId }),
      })
      setDiscordIntegration(null)
    } catch {
      setDiscordError('Failed to disconnect')
    } finally {
      setDiscordDisconnecting(false)
    }
  }

  function openInviteModal() {
    setModal('invite')
    setFriendsLoading(true)
    fetch('/api/friends')
      .then(r => r.ok ? r.json() : Promise.resolve({ friends: [] }))
      .then(data => setFriends(data.friends ?? []))
      .catch(() => {})
      .finally(() => setFriendsLoading(false))
  }

  async function handleSaveName() {
    if (!editName.trim()) return
    setEditNameSaving(true); setEditNameError(null)
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
      }
      setModal(null)
      router.refresh()
    } catch (err) {
      setEditNameError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditNameSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteSaving(true); setDeleteError(null)
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
      }
      setModal(null)
      router.push('/my-team')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleteSaving(false)
    }
  }

  async function handleInvite(friendUserId: string) {
    setInviteErrors(prev => { const n = { ...prev }; delete n[friendUserId]; return n })
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitee_id: friendUserId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
      }
      setInvitedIds(prev => new Set([...prev, friendUserId]))
    } catch (err) {
      setInviteErrors(prev => ({ ...prev, [friendUserId]: err instanceof Error ? err.message : 'Failed' }))
    }
  }

  // Reset edit name when modal opens
  useEffect(() => {
    if (modal === 'edit') setEditName(teamName)
  }, [modal, teamName])

  const effectiveDemos = useMemo(() => {
    if (Object.keys(sideOverrides).length === 0) return demos
    return demos.map(d => {
      const override = sideOverrides[d.id]
      return override
        ? { ...d, parsed_data: d.parsed_data ? { ...d.parsed_data, opponentSide: override } : { opponentSide: override } }
        : d
    })
  }, [demos, sideOverrides])

  const handleSideChange = (demoId: string, opponentSide: 'team1' | 'team2') => {
    setSideOverrides(prev => ({ ...prev, [demoId]: opponentSide }))
  }

  const stats = useMemo(() => computeStats(effectiveDemos, mapSideWins), [effectiveDemos, mapSideWins])
  const mapGroups = useMemo(() => buildMapGroups(effectiveDemos), [effectiveDemos])

  const hasNoDemos = effectiveDemos.length === 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          {/* Team Selector */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <button
              onClick={() => setShowTeamDropdown(!showTeamDropdown)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '2px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.14s ease',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={16} style={{ color: 'var(--accent)' }} />
                {teamName}
              </div>
              {showTeamDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTeamDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'var(--elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                zIndex: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}>
                {allTeams.map((team, i) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setShowTeamDropdown(false)
                      window.location.href = `/my-team?team=${team.id}`
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      background: selectedTeamId === team.id ? 'var(--accent-soft)' : 'transparent',
                      color: 'var(--text)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.14s ease',
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: selectedTeamId === team.id ? 600 : 500,
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{team.name}</p>
                    </div>
                    {selectedTeamId === team.id && <Check size={16} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: 4 }}>{teamName}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your team's performance overview</p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canEdit && (
            <button onClick={() => setModal('edit')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Sliders size={14} /> Edit Name
            </button>
          )}
          {canInvite && (
            <button onClick={openInviteModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Send size={14} /> Invite Friends
            </button>
          )}
          {(canEdit || canInvite) && (
            <button onClick={openDiscordModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: discordIntegration ? 'rgba(88,101,242,0.12)' : 'transparent', color: discordIntegration ? '#5865F2' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <MessageSquare size={14} /> Discord
              {discordIntegration && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#57F287', flexShrink: 0 }} />}
            </button>
          )}
          {myFaceitId && (
            <FaceitImportButton teamId={selectedTeamId} faceitNickname={myFaceitId} />
          )}
          <DemoUploadButton teamId={selectedTeamId} demoType="self" label="Upload Demo" />
          <Link href="/teams">
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none' }}>
              <Plus size={14} /> Create Team
            </button>
          </Link>
          {canDelete && (
            <button onClick={() => setModal('delete')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--loss)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none' }}>
              <Trash2 size={14} /> Delete Team
            </button>
          )}
        </div>
      </div>

      {/* ESEA / FACEIT team link + match history (own team) */}
      {(faceitTeamId || canEdit) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <EseaTeamLink
            endpoint={`/api/teams/${selectedTeamId}/faceit-team`}
            initialTeamId={faceitTeamId}
            initialTeamName={faceitTeamName}
            isOwnerOrAdmin={canEdit}
            emptyHint="Link your team's ESEA/FACEIT page to pull your match history"
          />
          {faceitTeamId && (
            <EseaMatchList
              matchesUrl={`/api/teams/${selectedTeamId}/faceit-matches`}
              uploadTeamId={selectedTeamId}
              demoType="self"
              isOwnerOrAdmin={canEdit}
              uploadedMatchIds={uploadedFaceitMatchIds}
            />
          )}
        </div>
      )}

      {/* Zero-demos onboarding */}
      {hasNoDemos && (
        <div style={{ borderRadius: 14, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Film size={24} style={{ color: '#818cf8' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Upload your first demo</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Once you upload a self demo, Rivalize will analyse every round — win rates, ratings, map splits, T/CT performance, and player deep-dives.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <DemoUploadButton teamId={selectedTeamId} demoType="self" label="Upload Demo" />
            {myFaceitId && (
              <FaceitImportButton teamId={selectedTeamId} faceitNickname={myFaceitId} />
            )}
            {canInvite && (
              <button onClick={openInviteModal} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Send size={14} /> Invite Teammates
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            {[
              { icon: BarChart3, label: 'Win rates & K/D', desc: 'Per map and per player' },
              { icon: Target, label: 'T/CT splits', desc: 'Which side you struggle on' },
              { icon: Brain, label: 'AI coaching', desc: 'Personalised drills and tips' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <Icon size={18} style={{ color: 'var(--muted)', margin: '0 auto 4px' }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      {!hasNoDemos && (
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
          {([
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'roster',   label: 'Roster',   icon: Shield },
            { id: 'maps',     label: 'Maps',     icon: Layers },
            { id: 'demos',    label: 'Demos',    icon: Film },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === id ? 'var(--accent)' : 'transparent',
                color: activeTab === id ? '#fff' : 'var(--muted)',
                fontSize: 12, fontWeight: 600, transition: 'all 0.13s',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Overview Tab ── */}
      {!hasNoDemos && activeTab === 'overview' && (<>
        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'MATCHES',  stat: stats.totalMatches || '—', sub: `${stats.totalWins}W ${stats.totalLosses}L ${stats.totalDraws}D`, strip: 'var(--tside)',  num: 'var(--text)' },
            { label: 'WIN RATE', stat: stats.totalMatches > 0 ? `${Math.round(stats.winRate * 100)}%` : '—', sub: `${stats.totalWins} wins from ${stats.totalMatches}`, strip: 'var(--signal)', num: 'var(--signal)' },
            { label: 'TEAM K/D', stat: stats.avgKD, sub: 'Combined team ratio', strip: 'var(--accent)', num: 'var(--accent)' },
            { label: 'AVG ADR',  stat: stats.avgAdr, sub: 'Avg damage per round', strip: 'var(--ct)',     num: 'var(--ct)' },
          ].map((s, i) => (
            <div key={i} style={{ padding: 16, position: 'relative', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.strip }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.num, lineHeight: 1.1, marginBottom: 4 }}>{s.stat}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Performance Trends + AI Analyst */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(() => {
              const completed = [...effectiveDemos.filter(d => d.status === 'completed')]
                .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
              if (completed.length < 2) return null
              const matches = completed.map(d => {
                const h = d.parsed_data?.header
                if (!h) return null
                const os = d.parsed_data?.opponentSide ?? 'team2'
                const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
                const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
                const result: 'w' | 'l' | 'd' = ours > theirs ? 'w' : ours < theirs ? 'l' : 'd'
                const mapName = (h.map ?? '').replace(/^(de_|cs_|ar_)/, '').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown map'
                return { result, ours, theirs, mapName }
              }).filter(Boolean) as { result: 'w' | 'l' | 'd'; ours: number; theirs: number; mapName: string }[]
              if (matches.length < 2) return null

              // Rolling win rate over the last WINDOW matches at each point
              const WINDOW = 5
              const rolling = matches.map((_, idx) => {
                const slice = matches.slice(Math.max(0, idx - WINDOW + 1), idx + 1)
                return Math.round(slice.filter(m => m.result === 'w').length / slice.length * 100)
              })
              const current = rolling[rolling.length - 1]
              const RESULT_LABEL = { w: 'Won', l: 'Lost', d: 'Draw' } as const
              const RESULT_COLOR = { w: 'var(--win)', l: 'var(--loss)', d: 'var(--muted)' } as const
              const CHART_H = 120

              return (
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Performance Trends
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: current >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                      Last {Math.min(WINDOW, matches.length)}: {current}%
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 12px' }}>
                    Each bar is your win rate over the {WINDOW} matches up to that point — dots show each match result. Hover a bar for details.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Y axis */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: CHART_H, flexShrink: 0 }}>
                      {['100%', '50%', '0%'].map(l => (
                        <span key={l} style={{ fontSize: 9, color: 'var(--faint)', lineHeight: 1 }}>{l}</span>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Bars + gridlines */}
                      <div style={{ position: 'relative', height: CHART_H }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed var(--border)' }} />
                        <div style={{ position: 'absolute', top: CHART_H / 2, left: 0, right: 0, borderTop: '1px dashed var(--border)' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid var(--border)' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                          {matches.map((m, i) => (
                            <div
                              key={i}
                              title={`${m.mapName} — ${RESULT_LABEL[m.result]} ${m.ours}-${m.theirs}\nWin rate over last ${Math.min(i + 1, WINDOW)} matches: ${rolling[i]}%`}
                              style={{ flex: 1, height: `${Math.max((rolling[i] / 100) * CHART_H, 3)}px`, background: 'linear-gradient(180deg,var(--signal),var(--accent))', borderRadius: '2px 2px 0 0', opacity: 0.85, cursor: 'default' }}
                            />
                          ))}
                        </div>
                      </div>
                      {/* Result dots aligned under their bars */}
                      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                        {matches.map((m, i) => (
                          <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }} title={`${m.mapName} — ${RESULT_LABEL[m.result]} ${m.ours}-${m.theirs}`}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: RESULT_COLOR[m.result], flexShrink: 0 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {([['w', 'Win'], ['l', 'Loss'], ['d', 'Draw']] as const).map(([r, label]) => (
                        <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: RESULT_COLOR[r] }} /> {label}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--faint)' }}>oldest → newest</span>
                  </div>
                </div>
              )
            })()}

            {mapGroups.filter(g => g.demos.length > 0).length > 0 && (
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Win rate by map</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mapGroups.filter(g => g.demos.length > 0).map((g) => {
                    const total = g.wins + g.losses + g.draws
                    const wr = total > 0 ? Math.round(g.wins / total * 100) : 0
                    const name = g.map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    return (
                      <div key={g.map} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)', width: 80, fontWeight: 500 }}>{name}</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${wr}%`, height: '100%', background: 'linear-gradient(90deg,var(--signal),var(--accent))' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text)', width: 30, textAlign: 'right', fontWeight: 600 }}>{wr}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--win)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={16} style={{ color: 'var(--signal)' }} /> AI Analyst
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AI_COACH_ITEMS.map((item, i) => (
                <Link key={i} href={`/ai-coach?mode=myteam&focus=${item.focus}`} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <item.icon size={16} style={{ color: item.color, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{item.desc}</p>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </>)}

      {/* ── Roster Tab ── */}
      {!hasNoDemos && activeTab === 'roster' && (
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)' }} />
          <div style={{ padding: '15px 18px 8px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Roster</p>
          </div>
          {stats.topPlayers.length === 0 ? (
            <div style={{ padding: '12px 18px 20px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
              No roster data yet. Upload demos to see player stats.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 48px 56px', padding: '2px 18px 8px', gap: 0, fontSize: 9.5, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['Player', 'Rating', 'ADR', 'K/D'].map((h, i) => (
                  <span key={h} style={{ textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              <div style={{ paddingBottom: 8 }}>
                {stats.topPlayers.map((p, i) => (
                  <Link key={p.name} href={`/my-team/player/${encodeURIComponent(p.name)}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 48px 56px', padding: '8px 18px', alignItems: 'center', borderBottom: i < stats.topPlayers.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, background: i === 0 ? 'rgba(251,191,36,0.18)' : i === 1 ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'rgba(255,255,255,0.07)', color: i === 0 ? '#fbbf24' : i === 1 ? 'var(--accent)' : 'var(--faint)', border: i === 0 ? '1px solid rgba(251,191,36,0.35)' : '1px solid var(--border)' }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                            {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.18)', color: '#fbbf24', flexShrink: 0 }}>#1</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{p.games} {p.games === 1 ? 'game' : 'games'}</span>
                            {p.entryKills > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'color-mix(in srgb, var(--tside) 14%, transparent)', color: 'var(--tside)' }}>
                                {p.entryKills}E
                              </span>
                            )}
                            {p.clutchRate !== null && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)' }}>
                                {Math.round(p.clutchRate * 100)}%C
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, textAlign: 'right', margin: 0, color: p.avgRating >= 1.1 ? 'var(--signal)' : p.avgRating >= 0.9 ? 'var(--text)' : 'var(--loss)' }}>{p.avgRating.toFixed(2)}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', margin: 0, color: 'var(--muted)' }}>{p.avgAdr.toFixed(0)}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', margin: 0, color: 'var(--muted)' }}>{p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : '—'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Maps Tab ── */}
      {!hasNoDemos && activeTab === 'maps' && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--ct)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px 8px' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Map Performance</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ct)' }} />CT</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--tside)' }} />T</span>
              </div>
            </div>
            <div style={{ padding: '4px 18px 14px' }}>
              {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length === 0 ? (
                <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>No map data yet.</p>
              ) : mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').map(g => {
                const sw = stats.mapSideWins[g.map]
                const tWr  = sw && sw.tTotal  > 0 ? Math.round(sw.tWins  / sw.tTotal  * 100) : null
                const ctWr = sw && sw.ctTotal > 0 ? Math.round(sw.ctWins / sw.ctTotal * 100) : null
                const name = g.map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                const tBarPct = sw ? Math.round(sw.tTotal / (sw.tTotal + sw.ctTotal) * 100) : 50
                return (
                  <div key={g.map} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', width: 72 }}>{name}</span>
                    <div style={{ flex: 1, height: 11, borderRadius: 4, overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
                      <div style={{ width: `${tBarPct}%`, background: tWr !== null && tWr >= 55 ? 'linear-gradient(90deg,#e09a2e,var(--tside))' : tWr !== null && tWr < 40 ? 'linear-gradient(90deg,var(--loss),#c0392b)' : 'linear-gradient(90deg,var(--tside),#e09a2e)' }} />
                      <div style={{ flex: 1, background: ctWr !== null && ctWr >= 55 ? 'linear-gradient(90deg,#4d83e6,var(--ct))' : ctWr !== null && ctWr < 40 ? 'linear-gradient(90deg,var(--loss),#c0392b)' : 'linear-gradient(90deg,#4d83e6,var(--ct))' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--tside)', width: 48, textAlign: 'right' }}>T {tWr !== null ? `${tWr}%` : '—'}</span>
                    <span style={{ fontSize: 11, color: 'var(--ct)', width: 50, textAlign: 'right' }}>CT {ctWr !== null ? `${ctWr}%` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {mapGroups.filter(g => g.demos.length > 0).length > 0 && (
            <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Win rate by map</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mapGroups.filter(g => g.demos.length > 0).map((g) => {
                  const total = g.wins + g.losses + g.draws
                  const wr = total > 0 ? Math.round(g.wins / total * 100) : 0
                  const name = g.map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <div key={g.map} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text)', width: 80, fontWeight: 500 }}>{name}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${wr}%`, height: '100%', background: 'linear-gradient(90deg,var(--signal),var(--accent))' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text)', width: 30, textAlign: 'right', fontWeight: 600 }}>{wr}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} style={{ color: 'var(--signal)' }} /> Map Pool
          </p>
          {stats.topMaps.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>No map data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.topMaps.map(([map, count]) => {
                const name = map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                return (
                  <span key={map} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {name}
                    <span style={{ fontSize: 10, color: 'var(--signal)', fontWeight: 700 }}>{count}×</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </>)}

      {/* ── Demos Tab ── */}
      {!hasNoDemos && activeTab === 'demos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Film size={16} style={{ color: 'var(--signal)' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>My Team&apos;s Demos</p>
            {effectiveDemos.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                {effectiveDemos.length} · {mapGroups.filter(g => g.demos.length > 0 && g.map !== 'unknown').length} maps
              </span>
            )}
          </div>
          <MapFolderList mapGroups={mapGroups} onSideChange={handleSideChange} />
        </div>
      )}

      {/* ── Edit Name modal ─────────────────────────────────────────────────── */}
      {modal === 'edit' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Edit Team Name</p>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !editNameSaving && handleSaveName()}
              placeholder="Team name"
              autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input, var(--card-2))', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            {editNameError && <p style={{ color: 'var(--loss)', fontSize: 12, marginTop: 6 }}>{editNameError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                disabled={editNameSaving || !editName.trim()}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: editNameSaving ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: editNameSaving || !editName.trim() ? 0.65 : 1 }}
              >
                {editNameSaving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Friends modal ─────────────────────────────────────────────── */}
      {modal === 'invite' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Invite Friends</p>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {friendsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading friends…
                </div>
              ) : friends.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', padding: '32px 0' }}>
                  No friends yet. Add friends on the{' '}
                  <Link href="/social" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Social</Link>
                  {' '}page first.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {friends.map(f => {
                    const isInvited = invitedIds.has(f.profile.id)
                    const errMsg = inviteErrors[f.profile.id]
                    return (
                      <div key={f.profile.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-2, rgba(255,255,255,0.03))' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                            {f.profile.display_name || f.profile.username}
                          </p>
                          {errMsg && <p style={{ fontSize: 11, color: 'var(--loss)', margin: '2px 0 0' }}>{errMsg}</p>}
                        </div>
                        <button
                          onClick={() => !isInvited && handleInvite(f.profile.id)}
                          disabled={isInvited}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, background: isInvited ? 'rgba(99,102,241,0.12)' : 'var(--accent)', color: isInvited ? 'var(--accent)' : 'white', fontSize: 12, fontWeight: 600, border: 'none', cursor: isInvited ? 'default' : 'pointer', opacity: isInvited ? 0.8 : 1 }}
                        >
                          {isInvited ? <Check size={12} /> : <UserPlus size={12} />}
                          {isInvited ? 'Invited' : 'Invite'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Discord Integration modal ───────────────────────────────────────── */}
      {modal === 'discord' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 460, maxWidth: 'calc(100vw - 32px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={15} style={{ color: '#5865F2' }} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Discord Integration</p>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {discordLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </div>
            ) : discordIntegration ? (
              /* Connected state */
              <div>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(87,242,135,0.06)', border: '1px solid rgba(87,242,135,0.2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#57F287', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Connected</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>
                      Guild {discordIntegration.guild_id}{discordIntegration.channel_id ? ` · #channel ${discordIntegration.channel_id}` : ''}
                    </p>
                  </div>
                </div>

                {/* Link code for slash commands */}
                {discordLinkCode && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Slash Command Link Code</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--card-2)', border: '1px solid var(--border)' }}>
                      <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: '#5865F2' }}>{discordLinkCode}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(discordLinkCode); setDiscordCodeCopied(true); setTimeout(() => setDiscordCodeCopied(false), 2000) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: discordCodeCopied ? '#57F287' : 'var(--muted)', cursor: 'pointer', fontSize: 12 }}
                      >
                        {discordCodeCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                        {discordCodeCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Run <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', background: 'var(--elevated)', padding: '1px 5px', borderRadius: 4 }}>/rivalize link {discordLinkCode}</code> in any Discord server to enable slash commands there.
                    </p>
                  </div>
                )}

                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Match summaries will be posted automatically whenever a demo finishes processing. Use <strong style={{ color: 'var(--text)' }}>/rivalize report</strong> and <strong style={{ color: 'var(--text)' }}>/rivalize standings</strong> for on-demand stats.
                </p>

                {discordError && <p style={{ color: 'var(--loss)', fontSize: 12, marginBottom: 12 }}>{discordError}</p>}

                <button
                  onClick={handleDiscordDisconnect}
                  disabled={discordDisconnecting}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {discordDisconnecting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                  Disconnect Discord
                </button>
              </div>
            ) : (
              /* Not connected state */
              <div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>
                  Connect a Discord webhook to auto-post match summaries when demos finish processing.
                </p>

                <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                  <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>How to connect:</p>
                  <ol style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <li>Open Discord → your server → channel settings</li>
                    <li>Go to <strong style={{ color: 'var(--text)' }}>Integrations → Webhooks → New Webhook</strong></li>
                    <li>Copy the webhook URL and paste it below</li>
                  </ol>
                  <a href="https://support.discord.com/hc/en-us/articles/228383668" target="_blank" rel="noopener noreferrer" style={{ color: '#5865F2', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11 }}>
                    Discord webhook guide <ExternalLink size={10} />
                  </a>
                </div>

                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>Webhook URL</label>
                <input
                  value={discordWebhookInput}
                  onChange={e => { setDiscordWebhookInput(e.target.value); setDiscordError(null) }}
                  onKeyDown={e => e.key === 'Enter' && !discordConnecting && handleDiscordConnect()}
                  placeholder="https://discord.com/api/webhooks/..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${discordError ? 'var(--loss)' : 'var(--border)'}`, background: 'var(--input, var(--card-2))', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: discordError ? 6 : 14 }}
                />
                {discordError && <p style={{ color: 'var(--loss)', fontSize: 12, marginBottom: 12 }}>{discordError}</p>}

                <button
                  onClick={handleDiscordConnect}
                  disabled={discordConnecting || !discordWebhookInput.trim()}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: 9, background: '#5865F2', color: 'white', fontSize: 13, fontWeight: 700, border: 'none', cursor: discordConnecting || !discordWebhookInput.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: discordConnecting || !discordWebhookInput.trim() ? 0.65 : 1 }}
                >
                  {discordConnecting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  Connect Discord
                </button>

                {discordLinkCode && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Slash Command Link Code</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--card-2)', border: '1px solid var(--border)' }}>
                      <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: '#5865F2' }}>{discordLinkCode}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(discordLinkCode); setDiscordCodeCopied(true); setTimeout(() => setDiscordCodeCopied(false), 2000) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: discordCodeCopied ? '#57F287' : 'var(--muted)', cursor: 'pointer', fontSize: 12 }}
                      >
                        {discordCodeCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                        {discordCodeCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Run <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', background: 'var(--elevated)', padding: '1px 5px', borderRadius: 4 }}>/rivalize link {discordLinkCode}</code> in any Discord server to enable slash commands there.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Team modal ────────────────────────────────────────────────── */}
      {modal === 'delete' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => !deleteSaving && setModal(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 400, maxWidth: 'calc(100vw - 32px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Delete Team</p>
              <button onClick={() => setModal(null)} disabled={deleteSaving} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{teamName}</strong>?
              All demos, stats, and lineups for this team will be permanently removed. This cannot be undone.
            </p>
            {deleteError && <p style={{ color: 'var(--loss)', fontSize: 12, marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} disabled={deleteSaving} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSaving}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--loss)', color: 'white', fontSize: 13, fontWeight: 600, cursor: deleteSaving ? 'not-allowed' : 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: deleteSaving ? 0.7 : 1 }}
              >
                {deleteSaving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                Delete Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
