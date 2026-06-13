export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Brain, Sparkles, BookOpen, Swords } from 'lucide-react'
import type { TeamFolder } from '@/types/database'
import PrepHeroSection from '@/components/prep/PrepHeroSection'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

const ACTIVE_DUTY_MAPS = [
  { key: 'de_mirage',   name: 'Mirage' },
  { key: 'de_inferno',  name: 'Inferno' },
  { key: 'de_nuke',     name: 'Nuke' },
  { key: 'de_ancient',  name: 'Ancient' },
  { key: 'de_overpass', name: 'Overpass' },
  { key: 'de_anubis',   name: 'Anubis' },
  { key: 'de_vertigo',  name: 'Vertigo' },
]

export default async function PrepPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map(m => m.team_id).filter(Boolean)

  const [foldersRes, demosRes] = await Promise.all([
    teamIds.length
      ? admin
          .from('team_folders')
          .select('id, opponent_display_name, opponent_slug, aggregated_stats')
          .in('user_team_id', teamIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? admin
          .from('demos')
          .select(`id, status, map, ${PARSED_SUMMARY_SELECT}`)
          .in('team_id', teamIds)
          .eq('demo_type', 'self')
          .eq('status', 'completed')
      : Promise.resolve({ data: [] }),
  ])

  const typedFolders = (foldersRes.data ?? []) as TeamFolder[]
  const nextOpponent = typedFolders[0] ?? null

  // Compute per-map win rates from user's own demos
  const mapStats: Record<string, { wins: number; total: number }> = {}
  for (const r of (demosRes.data ?? []) as Array<{ map: string | null } & ParsedSummaryRow>) {
    const demo = { map: r.map, parsed_data: summaryToParsedData(r) } as DemoRowData
    const rawMap = (demo.parsed_data?.header?.map ?? demo.map ?? '').toLowerCase()
    if (!rawMap || rawMap === 'unknown') continue
    const h = demo.parsed_data?.header
    if (!h) continue
    const os = demo.parsed_data?.opponentSide ?? 'team2'
    const ours = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
    const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
    if (!mapStats[rawMap]) mapStats[rawMap] = { wins: 0, total: 0 }
    mapStats[rawMap].total++
    if (ours > theirs) mapStats[rawMap].wins++
  }

  const mapWinRates: Record<string, number> = {}
  for (const [map, s] of Object.entries(mapStats)) {
    if (s.total > 0) mapWinRates[map] = Math.round(s.wins / s.total * 100)
  }

  return (
    <div className="p-5 md:p-7 flex flex-col gap-4 max-w-7xl">

      {/* Hero */}
      <PrepHeroSection
        allOpponents={typedFolders}
        defaultOpponent={nextOpponent}
        mapWinRates={mapWinRates}
        activeDutyMaps={ACTIVE_DUTY_MAPS}
      />

      {/* Prep Tools */}
      <div className="rv-panel" style={{ padding: '18px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Prep Tools</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { href: '/ai-coach', Icon: Brain,    color: 'var(--signal)',  label: 'AI Scout',         desc: 'Ask about your opponent' },
            { href: '/veto',     Icon: Swords,   color: 'var(--accent)',  label: 'Veto Simulator',   desc: 'Practice map vetoing' },
            { href: '/playbook', Icon: BookOpen, color: 'var(--tside)',   label: 'Playbook',         desc: 'Review your strategies' },
            { href: '/lineups',  Icon: Sparkles, color: 'var(--ct)',      label: 'Utility Hub',      desc: 'Utility lineup library' },
          ].map(({ href, Icon, color, label, desc }) => (
            <Link key={href} href={href}>
              <div className="rv-row" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</p>
                </div>
                <ArrowRight size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
