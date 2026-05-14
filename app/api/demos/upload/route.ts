import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateMockDemoData } from '@/lib/demo-parser/mock-parser'
import { slugify } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const teamId = formData.get('teamId') as string | null
  const opponentName = formData.get('opponentName') as string | null
  const mapName = (formData.get('map') as string | null) || 'unknown'

  if (!file || !teamId || !opponentName) {
    return NextResponse.json(
      { error: 'Missing required fields: file, teamId, opponentName' },
      { status: 400 }
    )
  }

  // Upload file to Supabase storage
  const timestamp = Date.now()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${teamId}/${timestamp}-${safeFileName}`

  const { error: uploadError } = await supabase.storage
    .from('demos')
    .upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const opponentSlug = slugify(opponentName)

  // Create demo record
  const { data: demo, error: demoError } = await supabase
    .from('demos')
    .insert({
      team_id: teamId,
      opponent_name: opponentName,
      opponent_slug: opponentSlug,
      map: mapName,
      raw_file_path: filePath,
      status: 'processing',
      file_size_bytes: file.size,
      created_by: user.id,
    })
    .select()
    .single()

  if (demoError) {
    return NextResponse.json({ error: demoError.message }, { status: 500 })
  }

  // Upsert team folder
  await supabase.from('team_folders').upsert(
    {
      user_team_id: teamId,
      opponent_slug: opponentSlug,
      opponent_display_name: opponentName,
    },
    { onConflict: 'user_team_id,opponent_slug' }
  )

  // Trigger background parsing (mock — replace with real parser queue in production)
  // Using a non-blocking async operation
  const demoId = demo.id

  ;(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const parsedData = generateMockDemoData('My Team', opponentName, mapName)

      await supabase
        .from('demos')
        .update({
          parsed_data: parsedData,
          status: 'completed',
          map: parsedData.header.map,
        })
        .eq('id', demoId)

      // Recalculate folder aggregated stats
      const { data: allDemos } = await supabase
        .from('demos')
        .select('parsed_data, status')
        .eq('team_id', teamId)
        .eq('opponent_slug', opponentSlug)
        .eq('status', 'completed')

      if (allDemos && allDemos.length > 0) {
        const wins = allDemos.filter(d => {
          const h = (d.parsed_data as { header?: { score_team1?: number; score_team2?: number } } | null)?.header
          return h && (h.score_team1 ?? 0) > (h.score_team2 ?? 0)
        }).length

        await supabase
          .from('team_folders')
          .update({
            aggregated_stats: {
              total_matches: allDemos.length,
              wins,
              losses: allDemos.length - wins,
              draws: 0,
              win_rate: allDemos.length > 0 ? wins / allDemos.length : 0,
              avg_rating: 1.05,
              maps_played: {},
              top_players: [],
            },
          })
          .eq('user_team_id', teamId)
          .eq('opponent_slug', opponentSlug)
      }
    } catch (err) {
      await supabase
        .from('demos')
        .update({
          status: 'failed',
          error_message: String(err),
        })
        .eq('id', demoId)
    }
  })()

  return NextResponse.json(demo, { status: 201 })
}
