import { createAdminClient } from '@/lib/supabase/admin'

export async function notifyTeamDemoReady(
  teamId: string,
  demoId: string,
  map: string,
  opponentName: string,
  demoType: 'opponent' | 'self',
): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: members } = await admin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    if (!members || members.length === 0) return

    const mapName = map !== 'unknown'
      ? map.replace(/^(de_|cs_|ar_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : null

    const title = demoType === 'self'
      ? `Your demo is ready${mapName ? ` — ${mapName}` : ''}`
      : `Demo vs ${opponentName} is ready${mapName ? ` — ${mapName}` : ''}`

    const link = demoType === 'self'
      ? `/my-team/demos/${demoId}`
      : `/opponents/demos/${demoId}`

    await admin.from('notifications').insert(
      members.map((m: { user_id: string }) => ({
        user_id: m.user_id,
        type:    'demo_ready',
        title,
        body:    'Stats and analysis are now available.',
        link,
      }))
    )
  } catch (err) {
    // Non-fatal — don't let notification failure break the parse pipeline
    console.error('[notify] Failed to insert demo_ready notifications:', err)
  }
}
