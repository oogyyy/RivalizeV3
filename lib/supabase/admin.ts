import { createClient } from '@supabase/supabase-js'

// Module-level singleton — safe for long-running Node.js servers.
// Avoids re-instantiating the client (and re-parsing config) on every request.
let _admin: ReturnType<typeof createClient> | null = null

export function createAdminClient() {
  if (_admin) return _admin
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return _admin
}
