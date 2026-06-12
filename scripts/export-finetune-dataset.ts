/**
 * Export rated AI outputs from ai_feedback as a JSONL fine-tuning dataset
 * (OpenAI/Together/Unsloth-compatible chat format).
 *
 * Positively rated examples become training rows; the negative count is
 * reported so you know how much contrast data exists for preference tuning.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/export-finetune-dataset.ts [--feature coach] [--out dataset.jsonl]
 *
 * See docs/CUSTOM_MODEL.md for the full custom-model roadmap.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const featureFilter = argValue('--feature')
const outPath = argValue('--out') ?? 'finetune-dataset.jsonl'

const SYSTEM_PROMPT =
  'You are a professional CS2 coach and tactical analyst with deep knowledge of competitive Counter-Strike: callouts, utility lineups, executes, rotations, economy, and counter-strategy.'

type FeedbackRow = {
  feature: string
  rating: number
  prompt: string | null
  content: string
  context: Record<string, unknown> | null
  model: string
  created_at: string
}

async function main() {
  const supabase = createClient(url!, key!)

  let query = supabase
    .from('ai_feedback')
    .select('feature, rating, prompt, content, context, model, created_at')
    .order('created_at', { ascending: true })
  if (featureFilter) query = query.eq('feature', featureFilter)

  const { data, error } = await query
  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as FeedbackRow[]
  const positive = rows.filter(r => r.rating === 1)
  const negative = rows.filter(r => r.rating === -1)

  const lines = positive.map(r => {
    const ctx = r.context && Object.keys(r.context).length > 0
      ? `\n[Context: ${Object.entries(r.context).map(([k, v]) => `${k}=${v}`).join(', ')}]`
      : ''
    const userContent = (r.prompt?.trim() || `Provide ${r.feature} analysis.`) + ctx
    return JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
        { role: 'assistant', content: r.content },
      ],
    })
  })

  fs.writeFileSync(outPath, lines.join('\n') + (lines.length ? '\n' : ''))

  const byFeature: Record<string, number> = {}
  positive.forEach(r => { byFeature[r.feature] = (byFeature[r.feature] ?? 0) + 1 })

  console.log(`Wrote ${lines.length} training examples to ${outPath}`)
  console.log(`By feature: ${Object.entries(byFeature).map(([f, c]) => `${f}=${c}`).join(', ') || 'none'}`)
  console.log(`Negative examples available for preference tuning: ${negative.length}`)
  if (lines.length < 500) {
    console.log(`\nNote: ~500-1000 high-quality examples is a realistic minimum for a useful LoRA fine-tune; you have ${lines.length}. Keep collecting.`)
  }
}

main()
