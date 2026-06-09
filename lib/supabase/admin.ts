import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Explicit SupabaseClient<any> prevents ReturnType<> from resolving to SupabaseClient<never>
// which would cause all .from() queries to return never[].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: SupabaseClient<any> | null = null

export function createAdminClient() {
  if (_admin) return _admin
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return _admin
}
