export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { MAP_THUMBS } from '@/lib/map-config'
import DemoListMultiSelect, { type DemoRowData } from '@/components/teams/DemoListMultiSelect'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

interface Props {
  params: Promise<{ mapName: string }>
}

function mapDisplayName(map: string): string {
  return map
    .replace(/^(de_|cs_|ar_)/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function MyTeamMapPage({ params }: Props) {
  const { mapName } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id)

  // Find the first real (non-personal) team
  const { data: teamRows } = await admin
    .from('teams')
    .select('id, name')
    .in('id', teamIds)
    .eq('is_personal', false)
    .limit(1)

  const team = teamRows?.[0] ?? null
  if (!team) redirect('/my-team')

  const { data: demosRaw } = await admin
    .from('demos')
    .select(`id, status, map, match_date, created_at, opponent_slug, error_message, processing_started_at, ${PARSED_SUMMARY_SELECT}`)
    .eq('team_id', team.id)
    .eq('demo_type', 'self')
    .eq('map', mapName)
    .order('created_at', { ascending: false })
    .limit(100)

  const demos = ((demosRaw ?? []) as Array<Record<string, unknown> & ParsedSummaryRow>)
    .map(r => ({ ...r, parsed_data: summaryToParsedData(r) })) as unknown as DemoRowData[]

  const name  = mapDisplayName(mapName)
  const thumb = MAP_THUMBS[mapName]

  const total = demos.filter(d => d.status === 'completed').length
  let wins = 0, losses = 0, draws = 0
  for (const d of demos) {
    if (d.status !== 'completed') continue
    const h  = d.parsed_data?.header
    const os = d.parsed_data?.opponentSide ?? 'team2'
    if (!h) continue
    const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (ours > theirs)        wins++
    else if (ours === theirs) draws++
    else                      losses++
  }
  const wr = total > 0 ? Math.round((wins / total) * 100) : null
  const wrColor = wr === null ? undefined : wr >= 55 ? 'var(--win)' : wr >= 45 ? '#facc15' : 'var(--loss)'

  return (
    <div className="min-h-full">
      {/* Page header with thumbnail */}
      <div className="relative h-36 overflow-hidden border-b border-border">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <MapPin size={32} className="text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end px-4 md:px-6 pb-4">
          <Link
            href="/my-team"
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors mb-2 w-fit"
          >
            <ArrowLeft size={12} />
            My Team
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white leading-none">{name}</h1>
              {wr !== null && (
                <p className="text-sm font-semibold mt-1" style={{ color: wrColor }}>
                  {wr}% win rate · {wins}W – {losses}L{draws > 0 ? ` – ${draws}D` : ''}
                </p>
              )}
            </div>
            <DemoUploadButton teamId={team.id} demoType="self" />
          </div>
        </div>
      </div>

      {/* Demo list */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {demos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center">
              <MapPin size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground">No demos on {name} yet</p>
            <p className="text-xs text-muted-foreground">Upload a demo to start tracking your performance here.</p>
          </div>
        ) : (
          <DemoListMultiSelect
            demos={demos}
            demoHrefPrefix="/my-team/demos"
            showSideSelector
            showReparse
            canDelete
            layout="cards"
          />
        )}
      </div>
    </div>
  )
}
