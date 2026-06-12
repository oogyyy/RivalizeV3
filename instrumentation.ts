// Runs once when the Next.js server boots.
// Kicks off the knowledge base embedding sync in the background so deploys
// that change knowledge_base/*.md refresh the vector store automatically.
//
// The NEXT_RUNTIME check must be a positive `if` wrapping the dynamic import:
// Next also compiles this file for the edge runtime (middleware), and only
// this exact pattern lets webpack dead-code-eliminate the Node-only import
// (fs/path/crypto) from the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
    const { syncKnowledgeBase } = await import('@/lib/knowledge/sync')
    // Fire and forget — never block or crash server startup
    syncKnowledgeBase().catch(err =>
      console.warn('[instrumentation] knowledge sync failed:', (err as Error).message),
    )
  }
}
