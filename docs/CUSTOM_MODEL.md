# Building Rivalize's Own CS2 AI Model

The goal: a model that "knows CS2" natively instead of relying purely on prompt
grounding. Training from scratch is not realistic (frontier-scale compute), but
**distillation + fine-tuning** is — and the groundwork ships with the app.

## How the pieces fit

```
users rate AI outputs (👍/👎 in AI Coach)
        │
        ▼
ai_feedback table  ──►  scripts/export-finetune-dataset.ts  ──►  dataset.jsonl
                                                                     │
                                                                     ▼
                                              LoRA fine-tune an open model
                                                                     │
                                                                     ▼
                                        host it, point AI_BASE_URL / AI_MODEL at it
```

The provider config in `lib/ai.ts` is already env-swappable, so the custom
model drops in with zero code changes.

## Phase 1 — Collect (live now)

- Thumbs up/down on AI Coach answers writes to `ai_feedback` (rating, the
  user's question, the answer, mode/focus context, model id).
- Target: **500–1000 positively rated examples** before fine-tuning is worth
  the effort. Below that, prompt grounding beats a fine-tune.
- Check progress anytime:
  `npx tsx scripts/export-finetune-dataset.ts --out /tmp/check.jsonl`

## Phase 2 — Augment with synthetic gold data

Real usage data is the seed, not the whole dataset:

1. Use a frontier model (Claude, GPT) to generate model answers for the same
   prompt families (strats per map/section, scouting Q&A, counter-strats),
   grounded with `lib/cs2-doctrine.ts`, `lib/map-callouts.ts`, and
   `knowledge_base/cs2/`.
2. Validate each sample with the eval harness (`scripts/eval-coach.ts`
   patterns): side purity, real callouts only, 5-player realism.
3. Mix ~70% synthetic gold / 30% real rated data.

## Phase 3 — Fine-tune

- Base model: a strong open reasoning model in the 8–32B range (e.g. Qwen3
  or Llama family) — big enough to reason, small enough to host cheaply.
- Method: LoRA/QLoRA. Tooling: Unsloth (self-managed GPU, ~$50–200 of rental)
  or a managed service (Together AI fine-tuning).
- The exported JSONL is already in the standard chat format these expect.
- Re-run `scripts/eval-coach.ts` against the candidate before promoting it.

## Phase 4 — Deploy

Host the tuned model (Together/Fireworks serverless or self-host vLLM) and set:

```
AI_BASE_URL=https://<your-endpoint>/v1
AI_MODEL=<your-model-id>
AI_API_KEY=<key>
```

Until then, the default is `openai/gpt-oss-120b` on Groq's free tier — the
strongest free option, and the teacher you'd distill from is only needed for
Phase 2.

## Reality check

The moat is the data pipeline (demo parsing, zone/pattern detection, callouts,
doctrine, knowledge base), not the weights. A fine-tune buys consistency,
CS2-native voice, and cheaper inference at scale — it does not replace the
grounding, which stays in the prompts regardless of model.
