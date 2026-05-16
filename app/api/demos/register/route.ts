import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateMockDemoData } from '@/lib/demo-parser/mock-parser'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { slugify } from '@/lib/utils'
import { getPublicUrl } from '@/lib/r2'
import { z } from 'zod'

const schema = z.object({
  teamId: z.string().uuid(),
  r2Key: z.string().min(1),
  opponentName: z.string().min(1).max(100),
  map: z.string().default('unknown'),
  fileSize: z.number().positive().optional(),
  matchDate: z.string().optional(),
  league: z.string().optional(),
})

// Called by the client after a successful direct upload to R2.
// Creates the demo DB record and kicks off background parsing.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { teamId, r2Key, opponentName, map, fileSize, matchDate, league } = parsed.data

  const admin = createAdminClient()

  // Verify the caller belongs to their own team. Admin client bypasses RLS.
  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
  }

  const opponentSlug = slugify(opponentName)
  const fileUrl = getPublicUrl(r2Key)

  // Create the demo record
  const { data: demo, error: demoError } = await admin
    .from('demos')
    .insert({
      team_id: teamId,
      opponent_name: opponentName,
      opponent_slug: opponentSlug,
      map,
      match_date: matchDate ?? null,
      league: league ?? null,
      raw_file_path: r2Key,
      file_url: fileUrl,
      status: 'processing',
      file_size_bytes: fileSize ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (demoError) {
    console.error('[register] Demo insert error:', demoError)
    return NextResponse.json({ error: demoError.message }, { status: 500 })
  }

  // Upsert the team folder for this opponent
  await admin.from('team_folders').upsert(
    {
      user_team_id: teamId,
      opponent_slug: opponentSlug,
      opponent_display_name: opponentName,
    },
    { onConflict: 'user_team_id,opponent_slug' }
  )

  // Background parse — in production replace with a proper job queue
  const demoId = demo.id
  void (async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))

      const parsedData = generateMockDemoData('My Team', opponentName, map)

      await admin
        .from('demos')
        .update({ parsed_data: parsedData, status: 'completed', map: parsedData.header.map })
        .eq('id', demoId)

      // Recalculate folder aggregated stats
      const { data: allDemos } = await admin
        .from('demos')
        .select('parsed_data')
        .eq('team_id', teamId)
        .eq('opponent_slug', opponentSlug)
        .eq('status', 'completed')

      if (allDemos && allDemos.length > 0) {
        const wins = allDemos.filter(d => {
          const h = (d.parsed_data as { header?: { score_team1?: number; score_team2?: number } } | null)?.header
          return h && (h.score_team1 ?? 0) > (h.score_team2 ?? 0)
        }).length

        const mapsPlayed: Record<string, number> = {}
        allDemos.forEach(d => {
          const m = (d.parsed_data as { header?: { map?: string } } | null)?.header?.map
          if (m) mapsPlayed[m] = (mapsPlayed[m] ?? 0) + 1
        })

        const topPlayers = computeTopPlayers(allDemos)

        await admin
          .from('team_folders')
          .update({
            aggregated_stats: {
              total_matches: allDemos.length,
              wins,
              losses: allDemos.length - wins,
              draws: 0,
              win_rate: wins / allDemos.length,
              avg_rating: topPlayers.length > 0 ? topPlayers.reduce((s, p) => s + p.rating, 0) / topPlayers.length : 1.0,
              maps_played: mapsPlayed,
              top_players: topPlayers,
            },
          })
          .eq('user_team_id', teamId)
          .eq('opponent_slug', opponentSlug)
      }
    } catch (err) {
      console.error('[register] Background parse failed:', err)
      await admin
        .from('demos')
        .update({ status: 'failed', error_message: String(err) })
        .eq('id', demoId)
    }
  })()

  return NextResponse.json(demo, { status: 201 })
}
