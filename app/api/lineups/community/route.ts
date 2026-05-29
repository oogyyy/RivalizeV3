import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mapFilter  = searchParams.get('map') ?? ''
  const typeFilter = searchParams.get('type') ?? ''

  const admin = createAdminClient()

  let query = admin
    .from('lineups')
    .select('id, map, name, type, notes, canvas_data, published_at, created_at')
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .limit(100)

  if (mapFilter)  query = query.eq('map', mapFilter)
  if (typeFilter) query = query.eq('type', typeFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
