'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ExternalLink, Loader2, Trophy, Zap } from 'lucide-react'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

// ── Map display name helper ─────────────────────────────────────────────────

const MAP_LABELS: Record<string, string> = {
  de_ancient: 'Ancient',
  de_anubis: 'Anubis',
  de_dust2: 'Dust2',
  de_inferno: 'Inferno',
  de_mirage: 'Mirage',
  de_nuke: 'Nuke',
  de_overpass: 'Overpass',
  de_vertigo: 'Vertigo',
  de_cache: 'Cache',
  de_train: 'Train',
}

function mapLabel(raw: string | null | undefined): string {
  if (!raw) return '—'
  const lower = raw.toLowerCase()
  return MAP_LABELS[lower] ?? raw.replace(/^de_/, '').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── FACEIT type ─────────────────────────────────────────────────────────────

interface FaceitRecentMatch {
  match_id: string
  competition_name: string
  started_at: number
  my_team: string | null
  opponent: string | null
  score: { faction1: number; faction2: number } | null
  winner: string | null
  my_faction: 'faction1' | 'faction2'
  match_url: string
  imported: boolean
}

// ── CS2 match row ───────────────────────────────────────────────────────────

function CS2Row({ demo }: { demo: DemoRowData }) {
  const h = demo.parsed_data?.header
  const os = demo.parsed_data?.opponentSide ?? 'team2'

  let result: 'W' | 'L' | 'D' | null = null
  let scoreStr = ''

  if (demo.status === 'completed' && h) {
    const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (ours > theirs) result = 'W'
    else if (ours === theirs) result = 'D'
    else result = 'L'
    scoreStr = `${ours}–${theirs}`
  }

  const map = mapLabel(demo.parsed_data?.header?.map ?? demo.map)
  const date = demo.match_date ?? demo.created_at

  return (
    <Link
      href={`/demos/${demo.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 hover:bg-background/70 hover:border-border/80 transition-colors group"
    >
      {/* Result badge */}
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0',
        result === 'W' ? 'bg-[rgba(0,255,200,0.12)] text-[#00ffc8]' :
        result === 'L' ? 'bg-red-500/10 text-red-400' :
        result === 'D' ? 'bg-yellow-500/10 text-yellow-400' :
        'bg-muted/50 text-muted-foreground'
      )}>
        {demo.status === 'processing' || demo.status === 'queued' ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          result ?? '?'
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground leading-tight truncate">{map}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {scoreStr ? `${scoreStr} · ` : ''}{formatDate(date)}
        </p>
      </div>

      {/* League / type */}
      <div className="shrink-0 text-right">
        {demo.league && (
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide block">
            {demo.league.length > 14 ? demo.league.slice(0, 14) + '…' : demo.league}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── FACEIT match row ─────────────────────────────────────────────────────────

function FaceitRow({ match }: { match: FaceitRecentMatch }) {
  const myScore  = match.score?.[match.my_faction] ?? null
  const oppFac   = match.my_faction === 'faction1' ? 'faction2' : 'faction1'
  const oppScore = match.score?.[oppFac] ?? null

  let result: 'W' | 'L' | 'D' | null = null
  let scoreStr = ''
  if (match.winner) {
    result = match.winner === match.my_faction ? 'W' : (myScore === oppScore ? 'D' : 'L')
  }
  if (myScore !== null && oppScore !== null) scoreStr = `${myScore}–${oppScore}`

  return (
    <a
      href={match.match_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 hover:bg-background/70 hover:border-border/80 transition-colors group"
    >
      {/* Result badge */}
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0',
        result === 'W' ? 'bg-[rgba(0,255,200,0.12)] text-[#00ffc8]' :
        result === 'L' ? 'bg-red-500/10 text-red-400' :
        result === 'D' ? 'bg-yellow-500/10 text-yellow-400' :
        'bg-muted/50 text-muted-foreground'
      )}>
        {result ?? '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-medium text-foreground leading-tight truncate">
            {match.opponent ?? 'Unknown'}
          </p>
          {scoreStr && (
            <span className={cn(
              'text-[10px] font-mono font-bold shrink-0',
              result === 'W' ? 'text-[#00ffc8]' : result === 'L' ? 'text-red-400' : 'text-yellow-400'
            )}>
              {scoreStr}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
          {match.competition_name} · {formatDate(match.started_at)}
        </p>
      </div>

      {/* External link */}
      <ExternalLink size={12} className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </a>
  )
}

// ── Column wrapper ───────────────────────────────────────────────────────────

function Column({
  icon, title, accent, children,
}: {
  icon: React.ReactNode
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b border-border', accent)}>
        {icon}
        <span className="text-[12px] font-semibold text-foreground tracking-wide">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[360px] p-3 space-y-1.5">
        {children}
      </div>
    </div>
  )
}

function EmptyCol({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5">
      <p className="text-[13px] font-medium text-foreground">{message}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">{sub}</p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  demos: DemoRowData[]
  faceitPlayerId: string | null
}

interface FaceitState {
  matches: FaceitRecentMatch[]
  loading: boolean
  linked: boolean
}

export default function RecentMatchesSplit({ demos, faceitPlayerId }: Props) {
  const cs2Demos = demos.filter(d => !d.faceit_match_id).slice(0, 15)

  const [faceit, setFaceit] = useState<FaceitState>({
    matches: [],
    loading: !!faceitPlayerId,
    linked: !!faceitPlayerId,
  })

  useEffect(() => {
    if (!faceitPlayerId) return
    let cancelled = false

    fetch('/api/matches/recent-faceit')
      .then(r => r.json())
      .then((data: { matches?: FaceitRecentMatch[]; linked?: boolean }) => {
        if (cancelled) return
        setFaceit({
          matches: data.matches ?? [],
          loading: false,
          linked: data.linked !== false,
        })
      })
      .catch(() => {
        if (!cancelled) setFaceit(prev => ({ ...prev, loading: false }))
      })

    return () => { cancelled = true }
  }, [faceitPlayerId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── CS2 Premier / Competitive ── */}
      <Column
        title="CS2 Premier / Competitive"
        accent="bg-blue-500/5"
        icon={<Trophy size={13} className="text-blue-400" />}
      >
        {cs2Demos.length === 0 ? (
          <EmptyCol
            message="No CS2 matches yet"
            sub="Upload a Premier or Competitive demo to start tracking."
          />
        ) : (
          cs2Demos.map(d => <CS2Row key={d.id} demo={d} />)
        )}
      </Column>

      {/* ── FACEIT ── */}
      <Column
        title="FACEIT"
        accent="bg-orange-500/5"
        icon={<Zap size={13} className="text-orange-400" />}
      >
        {faceit.loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">Loading matches…</span>
          </div>
        ) : !faceit.linked ? (
          <EmptyCol
            message="FACEIT not linked"
            sub="Run an ELO check in the AI Scout section to link your FACEIT account."
          />
        ) : faceit.matches.length === 0 ? (
          <EmptyCol
            message="No FACEIT matches found"
            sub="No recent CS2 match history available for your account."
          />
        ) : (
          faceit.matches.map(m => <FaceitRow key={m.match_id} match={m} />)
        )}
      </Column>
    </div>
  )
}
