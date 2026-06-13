import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ScoutDetailClient from './ScoutDetailClient'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

export const revalidate = 3600 // ISR — rebuild every hour

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const admin = createAdminClient()
  const { data: folder } = await admin
    .from('team_folders')
    .select('opponent_display_name, aggregated_stats')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!folder) return { title: 'Not Found | Rivalize' }

  const stats = folder.aggregated_stats as Record<string, number> | null
  const total  = (stats?.wins ?? 0) + (stats?.losses ?? 0) + (stats?.draws ?? 0)
  const wr     = total > 0 ? Math.round(((stats?.wins ?? 0) / total) * 100) : null

  const title       = `${folder.opponent_display_name} CS2 Stats | Rivalize`
  const description = wr !== null
    ? `${folder.opponent_display_name} opponent analysis: ${wr}% win rate across ${total} matches. Map pool, player stats, and tactical breakdown on Rivalize.`
    : `${folder.opponent_display_name} CS2 match analysis and opponent scouting report on Rivalize.`

  return {
    title,
    description,
    openGraph: { title, description, siteName: 'Rivalize' },
    twitter:   { card: 'summary', title, description },
  }
}

export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('team_folders')
    .select('id')
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .limit(1000)

  return (data ?? []).map(f => ({ id: f.id }))
}

export default async function ScoutDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('id, opponent_display_name, opponent_slug, published_at, updated_at, aggregated_stats, ai_brief')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!folder) notFound()

  // Recent demos — slim parsed_data projection (header/players/opponentSide only)
  const { data: demosRaw } = await admin
    .from('demos')
    .select(`id, map, match_date, created_at, ${PARSED_SUMMARY_SELECT}`)
    .eq('opponent_slug', folder.opponent_slug)
    .eq('demo_type', 'opponent')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)
  const demos = ((demosRaw ?? []) as Array<{ id: string; map: string; match_date: string | null; created_at: string } & ParsedSummaryRow>)
    .map(r => ({ id: r.id, map: r.map, match_date: r.match_date, created_at: r.created_at, parsed_data: summaryToParsedData(r) }))

  // Rating counts
  const { data: ratings } = await admin
    .from('opponent_ratings')
    .select('rating')
    .eq('folder_id', folder.id)

  const up   = (ratings ?? []).filter(r => r.rating ===  1).length
  const down = (ratings ?? []).filter(r => r.rating === -1).length

  return (
    <ScoutDetailClient
      folderId={folder.id}
      name={folder.opponent_display_name}
      publishedAt={folder.published_at}
      updatedAt={folder.updated_at}
      stats={folder.aggregated_stats as Record<string, unknown> | null}
      aiBrief={folder.ai_brief}
      demos={(demos ?? []) as Array<{ id: string; map: string; match_date: string | null; created_at: string; parsed_data: unknown }>}
      initialRatings={{ up, down }}
    />
  )
}
