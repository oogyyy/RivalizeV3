import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadObject } from '@/lib/r2'
import { NextResponse } from 'next/server'

function getParsedJsonKey(demoId: string, parsedJsonUrl?: string | null) {
  if (parsedJsonUrl) {
    try {
      const path = decodeURIComponent(new URL(parsedJsonUrl).pathname.replace(/^\/+/, ''))
      const marker = 'parsed-demos/'
      const markerIndex = path.indexOf(marker)
      if (markerIndex >= 0) return path.slice(markerIndex)
    } catch {
      // Fall back to the canonical key below.
    }
  }

  return `parsed-demos/${demoId}.json`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ demoId: string }> },
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, parsed_json_url')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const key = getParsedJsonKey(demo.id, demo.parsed_json_url)
    const parsed = JSON.parse((await downloadObject(key)).toString('utf-8'))
    return NextResponse.json(parsed, {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load parsed replay data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
