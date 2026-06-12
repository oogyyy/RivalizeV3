import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { streamText } from 'ai'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { aiConfigured, getAIModel, logAIUsage } from '@/lib/ai'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import type { Round, Kill, GrenadeEvent, PlayerStats } from '@/types/database'
import { detectTacticalPatterns } from '@/lib/cs2-zones'
import { calloutGuide } from '@/lib/map-callouts'
import { retrieve, formatContext } from '@/lib/knowledge/retrieval'

const bodySchema = z.object({
  sectionType: z.enum(['t_side', 'ct_side', 'a_execute', 'b_execute', 'roles', 'economy']),
  teamId:      z.string().uuid().optional(),
})

// ── Prompt sets ──────────────────────────────────────────────────────────────

const UTILITY_FORMAT_INSTRUCTION = `
UTILITY FORMATTING RULES (apply to every grenade/molotov/flash):
1. Name the EXACT throw position using the map's real callout (e.g. "B Apps", "Top Mid", "CT Spawn").
2. Name the EXACT landing/target callout — never say "towards the site". Be specific: "CT smoke", "Van smoke", "Jungle smoke", "Short flash", etc.
3. After each utility line add: [▶ Watch lineup](https://www.youtube.com/results?search_query=cs2+{map}+UTILITY_TYPE+FROM_CALLOUT+to+LANDING_CALLOUT) — substitute real callouts, lowercase, spaces as +.
Example: [▶ Watch lineup](https://www.youtube.com/results?search_query=cs2+mirage+smoke+b+apps+to+ct)
`

// ─── Self-improvement prompts ─────────────────────────────────────────────────
// Each prompt opens with a side-lock header so the model never drifts.

const SELF_PROMPTS: Record<string, string> = {
  t_side: `[T-SIDE / ATTACKER SECTION — describe ONLY what the Terrorist side does. Do NOT mention CT positions, CT setups, or what defenders should do.]

CRITICAL: T-side players CANNOT physically reach CT-only areas in the first 30 seconds. Never place a T-side player at positions like Jungle, Short (CT side), CT Spawn, Window Room, or any area that requires crossing the bombsite first. T-side starting positions must be reachable from T Spawn without passing through a bombsite.

Write the T-side attacking default for {map}. Use exactly these sections:

## Starting Positions
Name the exact {map} callout where each of the 5 players begins the round and their immediate first-5-second job (e.g. smoke, flash, aggressive peek, passive info).

## Default Phase (1:40 → 1:00 on clock)
- Per-player info assignments and map-control positions
- Utility used to create early pressure or gather info (name throw spot and landing callout)
- Decision checkpoints: what info triggers a mid-round read

## Site Selection (1:00 → 0:50)
List the specific conditions that make you commit to A, B, or a mid-fight. Be concrete — "if AWPer gets a pick at [callout], rotate to A".

## Execute Entry (0:50 → 0:40)
- Exact utility sequence: player → throws from [callout] → lands at [callout] → timing
- Who enters first, who trades, who cleans up
- How to adjust if CTs pre-aim the common entry angle

## Post-Plant (0:40 and below)
Where each player positions after the bomb drops, using exact {map} callouts. Cover both A and B plant scenarios.`,

  ct_side: `[CT-SIDE / DEFENDER SECTION — describe ONLY what the Counter-Terrorist side does. Do NOT mention T-side attack routes, T positions, or how to attack.]

Write the CT-side defensive default for {map}. Use exactly these sections:

## Starting Positions
Name the exact {map} callout for each of the 5 players at round start, their anchor role, and any opening utility they throw.

## Early Map Control (1:40 → 1:10)
- Which players peek aggression and where
- Smokes/flashes to contest T early map control (name throw callout and landing callout)
- Information positions that give the most rotation value

## Mid-Round Rotation Rules (1:10 → 0:45)
Define clear triggers: "if [player] hears X at [callout], AWPer rotates from [callout] to [callout]". At least 3 specific trigger-and-response rules.

## Crossfire Setups
2–3 two-man crossfire positions specific to {map} that are difficult for Ts to clear cleanly. Name both players' positions.

## Retake Coordination
If bomb is planted at A: which players come from which callouts, in what order, with what utility.
If bomb is planted at B: same detail for B site retake.`,

  a_execute: `[T-SIDE A EXECUTE — the team is attacking A site as Terrorists. Do NOT describe CT defender actions or what happens on B site.]

Write a complete step-by-step A site execute for {map}. Use exactly these sections:

## When to Run This Execute
Specific conditions that make A the right call (info gathered, clock time, opponent reaction seen).

## Utility Sequence (numbered, in order)
For each throw: Step N — [Player/Role] throws [utility type] FROM [exact callout] TO [exact landing callout] at [clock time].
Cover all smokes needed to safely enter A, any flashes for the entry fragger, and a molotov for common CT anchor spots.

## Entry & Trade Plan
1. Who pushes entry first, from which angle, and when
2. Who stands ready to trade immediately if entry dies
3. Who follows to clean remaining angles
Name the exact angles being cleared at each step.

## Post-Plant Positions
Where each player holds after bomb is planted — exact callouts, covering both the plant position and retake prevention angles.

## Abort / Counter-Read
If CTs read the execute early (fast rotate heard, smoke cleared), what does the caller say and what does the team do?`,

  b_execute: `[T-SIDE B EXECUTE — the team is attacking B site as Terrorists. Do NOT describe CT defender actions or what happens on A site.]

Write a complete step-by-step B site execute for {map}. Use exactly these sections:

## When to Run This Execute
Specific conditions that make B the right call (info gathered, clock time, opponent reaction seen).

## Utility Sequence (numbered, in order)
For each throw: Step N — [Player/Role] throws [utility type] FROM [exact callout] TO [exact landing callout] at [clock time].
Cover smokes for the key B site angles, flashes to blind defenders, and a molotov for common CT boost or anchor positions.

## Entry & Trade Plan
1. Who pushes entry first, from which angle, and when
2. Who trades immediately if entry dies
3. Who cleans up remaining angles
Name the exact angles cleared at each step.

## Post-Plant Positions
Where each player holds after bomb is planted — exact callouts for both plant position and watching retake paths.

## B Fake Option
How to use this execute as a fake to draw CT rotations and open A. Specify: how much utility to commit before aborting, at what clock time, and where the team redirects.`,

  roles: `Write role assignments for a 5-player competitive team on {map}. For EACH role, list T-side duties and CT-side duties separately in that order. Do not mix the two sides.

## Entry Fragger
**T-side:** First into site — list 2–3 specific {map} entry angles and the utility they need cleared ahead of them.
**CT-side:** Aggressive early peek positions on {map} where they trade info and apply pressure.
**Key {map} positions:** [list 2–3 callouts]

## AWPer
**T-side:** Holding crossmap picks and supporting mid-control — specific {map} AWP positions for T-side default.
**CT-side:** Opening AWP positions on {map} that cover the most T-entry paths.
**Key {map} positions:** [list 2–3 callouts]

## Support
**T-side:** Utility assignments — which smokes and flashes they own, from which callouts, at what timings.
**CT-side:** Lurk-deterrent flashes, crossfire partner, rotation support role.
**Key {map} positions:** [list 2–3 callouts]

## Lurker
**T-side:** Where they apply late pressure or cut off rotations on {map} while the execute happens elsewhere.
**CT-side:** Passive information position that monitors the T route least watched by anchors.
**Key {map} positions:** [list 2–3 callouts]

## IGL
**T-side:** Calling position — where they stay to gather info and make the mid-round call safely.
**CT-side:** Anchor or rotator role, and what information they call for before committing.
**Key {map} positions:** [list 2–3 callouts]`,

  economy: `Write economy rules for a competitive team on {map}. Cover each scenario with clear thresholds.

## Full Buy Threshold
Minimum $ per role to buy a proper rifle round. List: Entry (AK/M4 + armor + flash), AWPer (AWP + pistol + armor), Support (rifle + smokes + flash), Lurker (rifle + armor), IGL (rifle + armor + smoke). State the team-wide floor.

## Force Buy Rules
When to force despite being below threshold:
- After pistol round win (anti-eco): what to buy to maximize the 2-round advantage
- After losing 3+ rounds in a row: pistol force or half-buy conditions
- When 1 teammate is significantly richer: drop priority order

## Eco Round Strategy
- Full save vs. pistol-only decision (what triggers each)
- Best pistol for eco (and why for this map specifically)
- Whether to buy armor or skip it on eco

## Pistol Rounds
**T pistol:** recommended load-out (pistol, armor y/n, utility y/n) and opening strategy for {map}.
**CT pistol:** recommended load-out and defensive approach for {map}.

## Save Threshold
The $ amount below which a player saves their primary weapon rather than dying with it. Any exceptions for AWPers.

## Drop Priority
Order in which players receive drops when 1-2 teammates are poor: who gets the rifle first and why.`,
}

// ─── Anti-strat prompts ───────────────────────────────────────────────────────

const ANTISTRAT_PROMPTS: Record<string, string> = {
  t_side: `[T-SIDE / ATTACKER SECTION — describe ONLY what OUR Terrorist side does to attack. Do NOT describe what the opponent's CTs do in general; only reference their tendencies to explain WHY our attack plan works.]

CRITICAL: T-side players CANNOT physically reach CT-only areas in the first 30 seconds. Never place a T-side player at positions like Jungle, Short (CT side), CT Spawn, Window Room, or any area that requires crossing the bombsite first. T-side starting positions must be reachable from T Spawn without passing through a bombsite.

Based on the opponent's CT-side patterns on {map}, write our T-side attack plan. Use exactly these sections:

## Exploitable Weakness
Which site is most attackable and why — reference their specific CT tendencies from the demo data (slow rotations, predictable anchors, weak utility).

## Opening Play (1:40 → 1:00)
- Our 5 starting positions and early utility to apply pressure where they are weakest
- Which player gathers info at the site we plan to hit and how

## Execute Trigger & Plan (1:00 → 0:40)
- The information or timing that confirms our attack
- Utility sequence to neutralise their typical anchor setup: Step N — [Role] FROM [callout] TO [callout] at [time]
- Entry order and trade plan against their likely defensive positions

## Post-Plant (0:40 and below)
Where our 5 players hold after the plant to defeat their retake pattern. Reference their known retake paths from demo data.

## Fake Option
Use the weaker site as a fake to trigger their rotation and create an opening on the main target. Include timing and commitment level.`,

  ct_side: `[CT-SIDE / DEFENDER SECTION — describe ONLY what OUR Counter-Terrorist side does to defend. Reference opponent T-side tendencies only to explain why our setup counters them.]

Based on the opponent's T-side tendencies on {map}, write our CT-side defensive setup. Use exactly these sections:

## Their Main T-Side Threat
Their most common execute or default route on {map} from the demo data, and the 1–2 positions that make it dangerous.

## Counter Setup — Starting Positions
Our 5 player positions designed specifically to pre-empt their tendencies. Name exact callouts and explain what each player watches.

## Pre-emptive Utility
Smokes and flashes we use at round start to neutralise their typical opening positions: [Role] FROM [callout] TO [callout].

## Rotation Triggers
3 specific opponent actions (heard or seen) and our exact rotation response each time.

## Retake Plan
If they successfully execute to A or B, how we retake — player order, entry callouts, utility used, coordinated timing.`,

  a_execute: `[T-SIDE A EXECUTE — we are attacking A site. Reference opponent's A defence only to explain how our execute beats it. Do NOT describe CT-side defensive plays.]

Based on how this opponent defends A on {map}, write our A execute designed to beat their setup. Use exactly these sections:

## Their A Defence (from demo data)
Their typical A anchor position(s) and any utility they pre-use at A. 1–2 sentences max.

## Our Utility Sequence to Beat It (numbered)
Step N — [Role] throws [type] FROM [exact callout] TO [exact callout] at [time]. Each smoke and flash directly addresses their specific defensive positions above.

## Entry Against Their Crossfires
Which angle our entry takes, why it bypasses their typical crossfire, and who is ready to trade.

## Post-Plant vs Their Retake
Where each player positions to defeat their known retake pattern. Name the exact callouts covering their retake routes.

## Adjustment If They Adapt
If they shift their A setup in response, what is our one-change counter?`,

  b_execute: `[T-SIDE B EXECUTE — we are attacking B site. Reference opponent's B defence only to explain how our execute beats it. Do NOT describe CT-side defensive plays.]

Based on how this opponent defends B on {map}, write our B execute designed to beat their setup. Use exactly these sections:

## Their B Defence (from demo data)
Their typical B anchor position(s) and common utility. 1–2 sentences max.

## Our Utility Sequence to Beat It (numbered)
Step N — [Role] throws [type] FROM [exact callout] TO [exact callout] at [time]. Each utility item directly targets their defensive positions above.

## Entry Against Their Setup
Who enters, from which angle, why it bypasses their typical positioning, and the trade plan.

## Post-Plant vs Their Retake
Positions for all 5 players targeting the retake paths they most commonly use. Exact callouts.

## B Fake to Open A
Commit enough utility to force their CT rotate, then abort at [clock time] and redirect to A. Specify the tipping point.`,

  roles: `Based on this opponent's player tendencies and stats on {map}, assign our team roles to maximise counter-play. For EACH role cover T-side and CT-side duties separately.

## Entry Fragger
**T-side:** Which of the opponent's anchor players they must out-duel and at which callout. How to enter given the opponent's typical first-contact position.
**CT-side:** Early aggression spots that shut down the opponent's most common early T-side move on {map}.

## AWPer
**T-side:** Which long-range pick opportunities exist based on opponent CT positions. Specific {map} callouts for AWP impact.
**CT-side:** AWP position(s) that directly neutralise the opponent's primary entry path based on their demo data.

## Support
**T-side:** The specific smokes and flashes required to clear this opponent's defensive setup at the targeted site.
**CT-side:** Utility to deny the opponent's most used T-side opening positions.

## Lurker
**T-side:** Which rotation path to cut off based on how quickly this opponent rotates in their demos.
**CT-side:** Passive info position that monitors the T-side approach they use most.

## IGL
**T-side:** Calling reads based on this opponent's most predictable mid-round habits. What to listen and look for.
**CT-side:** When to commit a rotation against this opponent's favoured execute — specific triggers from their demo patterns.`,

  economy: `Based on this opponent's economic patterns on {map}, write our economy counter-strategy. Use exactly these sections:

## Their Buy Patterns (from demo data)
When they typically full buy, force, and eco — and on which side.

## Punishing Their Force Buys
How we play when we know they are force buying — aggressive play, specific setups that punish half-equipment opponents on {map}.

## Playing Against Their Eco Rounds
Do they full-save or pistol-force? How aggressively do we push, and do we risk our rifles?

## Creating Economic Pressure
Round-win sequences that keep them in eco longer. Should we push aggressive T-side to deny them resets?

## Our Drop Priority Against Them
Given their weapon preferences, which of our roles most needs a rifle drop to survive their force buys?

## Save Threshold
The $ amount below which individuals save. Does anything about their playstyle change this calculus?`,
}

// ── Curated map reference docs ───────────────────────────────────────────────
// Always loaded directly from disk so the model is grounded in the verified
// map playbooks even when vector retrieval is unavailable or returns weak hits.

const KB_DIR = path.join(process.cwd(), 'knowledge_base/cs2')

function loadReferenceDocs(map: string, sectionType: string): string {
  const short = map.replace(/^de_/, '')
  const files: string[] = []

  if (['t_side', 'a_execute', 'b_execute'].includes(sectionType)) {
    files.push(`${short}_t_default.md`)
  } else if (sectionType === 'ct_side') {
    files.push(`${short}_ct_default.md`)
  } else if (sectionType === 'roles') {
    files.push(`${short}_t_default.md`, `${short}_ct_default.md`, 'team_roles_template.md')
  } else if (sectionType === 'economy') {
    files.push('pro_default_principles.md')
  }

  const docs = files
    .map(f => {
      const fp = path.join(KB_DIR, f)
      try {
        return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8').slice(0, 6000) : null
      } catch {
        return null
      }
    })
    .filter((d): d is string => d !== null)

  if (docs.length === 0) return ''
  return `--- VERIFIED MAP REFERENCE (ground truth for ${map}) ---\n${docs.join('\n\n')}\n--- END MAP REFERENCE ---`
}

// ── Demo context helpers ─────────────────────────────────────────────────────

type DemoParsedData = {
  header?: { map?: string; team1?: string; team2?: string; score_team1?: number; score_team2?: number; total_rounds?: number }
  opponentSide?: string
  players?: PlayerStats[]
  rounds?: Round[]
}

function buildDemoContext(
  demos: Array<{ parsed_data: unknown }>,
  map: string,
  label: string,
): string {
  const mapDemos = demos
    .filter(d => (d.parsed_data as DemoParsedData | null)?.header?.map === map)
    .slice(0, 5)

  if (mapDemos.length === 0) return ''

  const lines: string[] = [`\n${label} demo data for ${map}:`]
  const allRoundSets: Round[][] = []

  mapDemos.forEach((demo, i) => {
    const pd = demo.parsed_data as DemoParsedData | null
    if (!pd?.header) return
    const h = pd.header
    lines.push(`Match ${i + 1}: Score ${h.score_team1}-${h.score_team2} (${h.total_rounds} rounds)`)

    const rounds = pd.rounds ?? []
    if (rounds.length > 0) {
      allRoundSets.push(rounds)

      const allKills: Kill[] = rounds.flatMap(r => r.kills ?? [])
      const plants = rounds.filter(r => r.bomb_planted).length
      if (allKills.length > 0) {
        const hs = allKills.filter((k: Kill) => k.headshot).length
        lines.push(`  Kills: ${allKills.length}, HS% ${Math.round((hs / allKills.length) * 100)}%`)
      }
      if (plants > 0) lines.push(`  Bomb planted: ${plants}/${rounds.length} rounds`)

      const nades = rounds.flatMap(r => r.grenades ?? [])
      if (nades.length > 0) {
        const byType: Record<string, number> = {}
        nades.forEach((g: GrenadeEvent) => { byType[g.type] = (byType[g.type] ?? 0) + 1 })
        lines.push(`  Grenades: ${Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ')}`)
      }

      // Economy pattern
      const ecoPct = Math.round((rounds.filter(r => (r.team1_economy ?? 0) < 2000 || (r.team2_economy ?? 0) < 2000).length / Math.max(rounds.length, 1)) * 100)
      if (ecoPct > 0) lines.push(`  Eco/force rounds: ~${ecoPct}%`)
    }

    if (pd.players && pd.players.length > 0) {
      const top = [...pd.players].sort((a, b) => b.rating - a.rating).slice(0, 5)
      lines.push(`  Players: ${top.map(p => `${p.name} (Rtg ${p.rating.toFixed(2)}, ADR ${p.adr.toFixed(0)}${p.kast != null ? `, KAST ${Math.round(p.kast * 100)}%` : ''})`).join(', ')}`)
    }
  })

  // Cross-demo execute patterns (only useful with 2+ demos on the same map)
  if (allRoundSets.length >= 2) {
    const patterns = detectTacticalPatterns(allRoundSets, map)
    if (patterns.hasData) {
      lines.push(`\nCross-demo execute tendencies on ${map} (${allRoundSets.length} demos):`)
      lines.push(...patterns.text)
    }
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 30/min — a full playbook generates one section per request (6 sections)
  if (!rateLimit(`ai:playbook:${user.id}`, 30, 60_000)) {
    return rateLimitResponse()
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { sectionType, teamId } = parsed.data

  const { data: playbook } = await supabase
    .from('playbooks')
    .select('map, name, folder_id, opponent_name, team_id, players, player_roles')
    .eq('id', id)
    .single()

  if (!playbook) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })

  if (!aiConfigured()) {
    return NextResponse.json({ error: 'AI provider not configured' }, { status: 503 })
  }

  const isAntistrat = !!playbook.folder_id
  const admin = createAdminClient()
  let demoContext = ''

  if (isAntistrat && playbook.folder_id) {
    // Fetch opponent folder stats
    const { data: folder } = await supabase
      .from('team_folders')
      .select('opponent_display_name, aggregated_stats')
      .eq('id', playbook.folder_id)
      .single()

    if (folder) {
      const stats = folder.aggregated_stats as {
        total_matches?: number; wins?: number; losses?: number; win_rate?: number; avg_rating?: number; maps_played?: Record<string, number>
      } | null
      const foldTeamId = teamId ?? playbook.team_id
      demoContext += `\nOpponent: ${folder.opponent_display_name}`
      demoContext += `\nRecord: ${stats?.wins ?? 0}W-${stats?.losses ?? 0}L (${Math.round((stats?.win_rate ?? 0) * 100)}% win rate), avg rating ${stats?.avg_rating?.toFixed(2) ?? 'N/A'}`
      if (stats?.maps_played) {
        const mapPref = Object.entries(stats.maps_played).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m,c]) => `${m}(${c}x)`).join(', ')
        demoContext += `\nMap preferences: ${mapPref}`
      }

      // Fetch opponent demos
      const { data: oppDemos } = await supabase
        .from('demos')
        .select('parsed_data')
        .eq('team_id', foldTeamId)
        .eq('opponent_slug', (folder as { opponent_slug?: string } & typeof folder).opponent_slug ?? '')
        .eq('status', 'completed')
        .eq('demo_type', 'opponent')
        .order('created_at', { ascending: false })
        .limit(5)

      demoContext += buildDemoContext(oppDemos ?? [], playbook.map, `${folder.opponent_display_name} opponent`)
    }
  } else if (teamId) {
    // Self-improvement: use own demos
    const { data: selfDemos } = await admin
      .from('demos')
      .select('parsed_data')
      .eq('team_id', teamId)
      .eq('status', 'completed')
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(5)
    demoContext = buildDemoContext(selfDemos ?? [], playbook.map, 'Team')
  }

  // ── Knowledge base retrieval (best-effort; degrades gracefully if model not warm) ─
  const KB_QUERIES: Record<string, string> = {
    t_side:    `T-side default starting positions utility sequence execute ${playbook.map}`,
    ct_side:   `CT-side defensive positions rotation rules crossfires retake ${playbook.map}`,
    a_execute: `A site execute utility smokes flashes entry plan post-plant ${playbook.map}`,
    b_execute: `B site execute utility smokes flashes entry plan post-plant ${playbook.map}`,
    roles:     `team roles entry AWPer support lurker IGL responsibilities ${playbook.map}`,
    economy:   `economy buy thresholds force eco pistol round save ${playbook.map}`,
  }
  let knowledgeContext = ''
  try {
    const kbResult = await Promise.race([
      retrieve({ query: KB_QUERIES[sectionType] ?? sectionType, map: playbook.map, topK: 6 }),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('kb timeout')), 8000)),
    ])
    // The 'file' fallback returns the same docs we already load deterministically below
    if (kbResult && kbResult.source !== 'file') knowledgeContext = formatContext(kbResult)
  } catch (err) {
    console.warn('[generate] knowledge retrieval skipped:', (err as Error).message)
  }

  // Deterministic grounding: curated map playbook docs + verified callout list
  const referenceContext = loadReferenceDocs(playbook.map, sectionType)
  const calloutContext   = calloutGuide(playbook.map)

  const prompts    = isAntistrat ? ANTISTRAT_PROMPTS : SELF_PROMPTS
  const promptTmpl = prompts[sectionType] ?? prompts.t_side
  const prompt     = promptTmpl.replace(/{map}/g, playbook.map)

  // Build roster instruction — use stored names+roles, or role labels, never invented names
  const storedPlayers: string[] = (playbook as { players?: string[] }).players ?? []
  const storedRoles: Record<string, string> = (playbook as { player_roles?: Record<string, string> }).player_roles ?? {}
  let rosterInstruction: string
  if (storedPlayers.length > 0) {
    const lines = storedPlayers.map((n, i) => {
      const role = storedRoles[n]
      return role ? `${i + 1}. ${n} (${role})` : `${i + 1}. ${n}`
    })
    const hasRoles = storedPlayers.some(n => storedRoles[n])
    rosterInstruction = `\nTeam roster — use ONLY these exact names for players, never invent names:\n${lines.join('\n')}`
    if (hasRoles) rosterInstruction += `\nRole labels are shown in parentheses — use them when referencing each player's responsibilities.`
  } else {
    rosterInstruction = `\nDo NOT invent player names. Refer to players by role only (Entry Fragger, AWPer, Support, Lurker, IGL).`
  }

  const utilityInstruction = UTILITY_FORMAT_INSTRUCTION.replace(/{map}/g, playbook.map.replace('de_', ''))

  const sharedRules = `
CRITICAL RULES — violating any of these invalidates the entire response:
1. SIDE PURITY: Each section is locked to one side. T-side and execute sections describe ONLY what the Terrorist (attacking) team does. CT-side sections describe ONLY what the Counter-Terrorist (defending) team does. Never include instructions for the opposing side in the same section.
2. PLAYER COUNT: A team has exactly 5 players. Never assign more than 5 players to positions.
3. CALLOUTS: Use ONLY real, established callouts for ${playbook.map}. Never invent position names.
4. ROUND TIMING: CS2 rounds are 1:55. Default phase runs 1:40→1:00. Execute window is 1:00→0:40. Post-plant is 0:40 and below.
5. REALISM: Strategies must be physically executable. A player cannot be in two places at once. Splits require time to travel.
6. STRUCTURE: Follow the section headers in the prompt exactly. Do not add extra sections or skip required ones.
7. LINEUPS: When describing a specific smoke/flash lineup, prefer the exact lineups named in the map reference. If the reference has no lineup for a throw you need, name the throw position and landing callout but do NOT invent precise aim instructions.`

  const systemPrompt = isAntistrat
    ? `You are an expert CS2 anti-strat analyst building a structured pre-match counter-strategy playbook.
Map: ${playbook.map}
Playbook: ${playbook.name}
${demoContext}
${rosterInstruction}
${sharedRules}
${calloutContext}
${utilityInstruction}
${referenceContext ? `\n${referenceContext}\nThe map reference above is verified ground truth for ${playbook.map} positions, timings, and smoke lineups. Adapt it against the opponent rather than writing from scratch.` : ''}
${knowledgeContext ? `\n${knowledgeContext}` : ''}
Base every recommendation directly on the opponent demo data provided. Reference their specific tendencies and positions. Keep it practical — coaches should be able to read this to players in a team meeting.`
    : `You are an expert CS2 tactical coach writing a structured competitive playbook.
Map: ${playbook.map}
Playbook: ${playbook.name}
${demoContext}
${rosterInstruction}
${sharedRules}
${calloutContext}
${utilityInstruction}
${referenceContext ? `\n${referenceContext}\nThe map reference above is verified ground truth for ${playbook.map} positions, timings, and smoke lineups. Build your answer on it — reuse its named lineups and structures, adapting them to the requested section.` : ''}
${knowledgeContext ? `\n${knowledgeContext}` : ''}
${demoContext ? 'Where relevant, incorporate the team demo data above to tailor recommendations.' : ''}
Keep it practical and specific — every position, throw, and timing must be named with real ${playbook.map} callouts.`

  const result = streamText({
    model: getAIModel(),
    system: systemPrompt,
    prompt,
    maxTokens: 3000,
    temperature: 0.25,
    onFinish: async ({ usage }) => {
      await logAIUsage({
        userId: user.id,
        feature: 'playbook',
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
      })
    },
  })

  return new Response(
    result.textStream.pipeThrough(new TextEncoderStream()),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' } }
  )
}
