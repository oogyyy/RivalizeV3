import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/opponents/[folderId]/publish  body: { isPublic: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { folderId } = await params
  const { isPublic } = await req.json() as { isPublic: boolean }

  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders').select('user_team_id').eq('id', folderId).single()
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', folder.user_team_id).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('team_folders').update({
    is_public:    isPublic,
    published_at: isPublic ? new Date().toISOString() : null,
  } as Record<string, unknown>).eq('id', folderId)

  return NextResponse.json({ isPublic })
}
