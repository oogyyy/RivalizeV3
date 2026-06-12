// Runs once when the Next.js server boots (node runtime only).
// Kicks off the knowledge base embedding sync in the background so deploys
// that change knowledge_base/*.md refresh the vector store automatically.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

  // Fire and forget — never block or crash server startup
  import('@/lib/knowledge/sync')
    .then(m => m.syncKnowledgeBase())
    .catch(err => console.warn('[instrumentation] knowledge sync failed:', (err as Error).message))
}
