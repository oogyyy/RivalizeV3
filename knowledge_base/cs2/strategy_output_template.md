# Strategy Output Template

All AI-generated playbook sections MUST follow this exact structure. Do not add extra sections or omit required ones.

---

## Template: T-Side Default

```
# T-Side Default for de_[mapname]

#### Introduction
[1-2 sentences on map control focus and flexibility philosophy]

#### Opening Utility Usage (0-5s)
▸ [Support 1]: [Specific utility throw with from/to callouts] ▶ Watch lineup.
▸ [Support 2]: [Specific utility throw with from/to callouts] ▶ Watch lineup.
▸ [Entry]: [Flash from specific position to support team movement] ▶ Watch lineup.
▸ [IGL/Support]: [Molly or secondary utility for aggressive CT position]

#### Info-Gathering Positions
▸ [Lurker]: [Specific callout + what they're watching/detecting]
▸ [AWPer]: [Specific callout + duel/info objective]
▸ [Support]: [Specific callout + monitoring objective]
▸ [Entry + Support]: [Specific callout + control objective]

#### Default Split Routes
▸ Default A Split: [Clear player assignments with callouts and roles]
▸ Default B Split: [Clear player assignments with callouts and roles]

#### Timing Breakpoints
▸ First 30s: [Objective and constraints for this window]
▸ Mid-Round (30s-45s): [Decision criteria based on information gathered]
▸ Late Round (45s+): [Low-commitment option or forced play]

#### Adapting to CT Reads
▸ If CTs are aggressive in [specific area]:
- [Specific counter-adjustment with utility or positioning change]
- [Second adjustment or fallback option]
▸ If CTs are playing passively / stacked:
- [Specific response to a stacked setup]
- [Execute or fake option]
```

---

## Template: CT-Side Default

```
# CT-Side Default for de_[mapname]

#### Introduction
[1-2 sentences on defensive philosophy, key position, and rotation principle]

#### Opening Utility Usage (0-5s)
▸ [Role]: [Specific utility throw with from/to callouts] ▶ Watch lineup.
▸ [Role]: [Specific utility throw with from/to callouts] ▶ Watch lineup.
▸ [Role]: [Specific utility throw with from/to callouts] ▶ Watch lineup.

#### Default Positions
▸ [Role]: [Exact callout + what they hold/watch]
▸ [Role]: [Exact callout + what they hold/watch]
▸ [Role]: [Exact callout + what they hold/watch]
▸ [Role]: [Exact callout + what they hold/watch]
▸ [Role]: [Exact callout + what they hold/watch]

#### Rotation Rules
▸ If [specific trigger (sound/sight)]: [which player, exact route, comms call]
▸ If [specific trigger (sound/sight)]: [which player, exact route, comms call]
▸ If [specific trigger (sound/sight)]: [which player, exact route, comms call]
▸ If [specific trigger (sound/sight)]: [which player, exact route, comms call]

#### Crossfire Setups
▸ [Name]: [Player 1 at exact callout] + [Player 2 at exact callout] — [why it's hard to clear]
▸ [Name]: [Player 1 at exact callout] + [Player 2 at exact callout] — [why it's hard to clear]
▸ [Name]: [Player 1 at exact callout] + [Player 2 at exact callout] — [why it's hard to clear]

#### Retake Coordination
▸ A Site Retake: [Step-by-step with player roles, callouts, utility used]
▸ B Site Retake: [Step-by-step with player roles, callouts, utility used]

#### Adapting to T Reads
▸ If Ts are fast rushing [area]:
- [Passive adjustment that avoids the rush angle]
- [Rotation or utility response]
▸ If Ts are slow defaulting / setting up a coordinated execute:
- [Proactive information play to disrupt timing]
- [Crossfire or utility adjustment]
```

---

## Output Quality Rules

1. **Side purity:** T-side sections describe ONLY Terrorist actions. CT sections describe ONLY CT actions. Never mix.
2. **Callout accuracy:** Every position must use the map's real, established callout name. No invented names.
3. **Player count:** Always exactly 5 players assigned. Never 4, never 6.
4. **Timing realism:** Default phase 1:40→1:00, execute 0:55→0:40, post-plant below 0:40.
5. **Utility completeness:** Every smoke, flash, and molotov must have a throw position AND a landing callout.
6. **No vague language:** Never say "towards site", "somewhere near mid", "push aggressively". Always be specific.
7. **Watch lineup links:** Append `▶ Watch lineup.` to every utility entry in Opening Utility sections.
8. **Role references:** When players are named in the roster, use their names. When no names are given, use role labels.
