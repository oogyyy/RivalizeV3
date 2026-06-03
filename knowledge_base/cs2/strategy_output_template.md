# Strategy Output Template

All AI-generated playbook sections MUST follow this exact structure. Do not add extra sections or omit required ones.

---

## Template: T-Side Default

```
## T-Side Default — [MAP NAME]

### Starting Positions
| Role | Callout | Opening Job |
|---|---|---|
| [Role 1] | [Exact callout] | [First 5-second task] |
| [Role 2] | [Exact callout] | [First 5-second task] |
| [Role 3] | [Exact callout] | [First 5-second task] |
| [Role 4] | [Exact callout] | [First 5-second task] |
| [Role 5] | [Exact callout] | [First 5-second task] |

### Default Phase (1:40 → 1:00)
[2–4 sentences describing map control objectives, info-gathering positions, and utility used to create early pressure. Name every callout explicitly.]

**Utility in this phase:**
- [Role] smokes [exact callout] from [exact throw position] — [Watch lineup](URL)
- [Role] flashes [exact callout] from [exact throw position] — [Watch lineup](URL)

### Mid-Round Reads (1:00 → 0:50)
**Commit to A if:** [Specific information trigger]
**Commit to B if:** [Specific information trigger]
**Stay default if:** [Specific information trigger]

### Execute Entry (0:50 → 0:40)
1. [Role] throws [utility] FROM [callout] TO [callout] at 0:52
2. [Role] throws [utility] FROM [callout] TO [callout] at 0:50
3. [Role] enters [entry angle], [Role] ready to trade from [callout]
4. [Role] cleans [callout], [Role] plants at [plant position]

### Post-Plant (0:40 and below)
- [Role] holds [callout] watching [retake path]
- [Role] holds [callout] watching [retake path]
- [Role] holds [callout] watching [retake path]
- [Role] holds [callout] watching [retake path]
- [Role] time-wastes at [callout]

### Abort / Adjustment
If CT rotation is heard or smoke is flashed out: [specific abort call and redirect].
```

---

## Template: CT-Side Default

```
## CT-Side Default — [MAP NAME]

### Starting Positions
| Role | Callout | Anchor Responsibility |
|---|---|---|
| [Role 1] | [Exact callout] | [What they watch/hold] |
| [Role 2] | [Exact callout] | [What they watch/hold] |
| [Role 3] | [Exact callout] | [What they watch/hold] |
| [Role 4] | [Exact callout] | [What they watch/hold] |
| [Role 5] | [Exact callout] | [What they watch/hold] |

### Early Map Control (1:40 → 1:10)
[Describe which CTs apply aggression, what utility they use to contest T map control. Name every throw.]

**Opening utility:**
- [Role] smokes [callout] from [callout] — [Watch lineup](URL)
- [Role] flashes for [callout] peek — [Watch lineup](URL)

### Rotation Rules (1:10 → 0:45)
| Trigger | Response |
|---|---|
| [Specific sound/sight cue] | [Which player rotates, from where, to where] |
| [Specific sound/sight cue] | [Which player rotates, from where, to where] |
| [Specific sound/sight cue] | [Which player rotates, from where, to where] |

### Crossfire Setups
**Setup 1 — [Callout pair]:** [Player A] at [callout], [Player B] at [callout]. Forces T to peek two angles simultaneously.
**Setup 2 — [Callout pair]:** [Player A] at [callout], [Player B] at [callout].

### Retake — A Site
1. [Role] enters from [callout] with [utility]
2. [Role] enters from [callout], clears [angle]
3. [Role] defuses from [plant position]

### Retake — B Site
1. [Role] enters from [callout] with [utility]
2. [Role] enters from [callout], clears [angle]
3. [Role] defuses from [plant position]
```

---

## Template: Execute

```
## [A/B] Execute — [MAP NAME]

### Trigger Condition
[What information or round state justifies running this execute.]

### Utility Sequence
| Step | Role | Utility | From | Lands At | Clock |
|---|---|---|---|---|---|
| 1 | [Role] | Smoke | [callout] | [callout] | 0:52 |
| 2 | [Role] | Flash | [callout] | [callout] | 0:50 |
| 3 | [Role] | Smoke | [callout] | [callout] | 0:50 |
| 4 | [Role] | Molotov | [callout] | [callout] | 0:48 |

[Watch lineup links for each]

### Entry & Trade Plan
1. [Role] pushes [entry angle] at 0:48 with [utility popped]
2. [Role] stands [callout], ready to trade immediately
3. [Role] follows at 0:45, clears [angle]
4. [Role] plants at [plant position]
5. [Role] watches [exit/rotate path]

### Post-Plant Positions
- [Role] → [callout], watching [path]
- [Role] → [callout], watching [path]
- [Role] → [callout] (close hold)
- [Role] → [callout] (time waste)
- [Role] → [callout] (lurk exit)

### Abort
[Clock time and condition that triggers abort + redirect call.]
```

---

## Template: Role Assignments

```
## Role Assignments — [MAP NAME]

| Role | Player | T-Side Key Positions | CT-Side Key Positions | Primary Utility Owned |
|---|---|---|---|---|
| Entry | [Name] | [callout 1, callout 2] | [callout 1, callout 2] | 1× flash |
| AWPer | [Name] | [callout 1, callout 2] | [callout 1, callout 2] | AWP + pistol |
| Support | [Name] | [callout 1, callout 2] | [callout 1, callout 2] | 2× smoke, 2× flash, molotov |
| Lurker | [Name] | [callout 1, callout 2] | [callout 1, callout 2] | 1× smoke or flash |
| IGL | [Name] | [callout 1, callout 2] | [callout 1, callout 2] | 1× smoke or molotov |
```

---

## Template: Economy Rules

```
## Economy Rules — [MAP NAME]

### Full Buy Threshold
- Entry: $4,750 (AK/M4 + full armor + 1× flash)
- AWPer: $5,200 (AWP + armor + pistol backup)
- Support: $5,500 (rifle + armor + 2× smoke + flash + molotov)
- Lurker: $4,750 (rifle + armor + 1× util)
- IGL: $4,750 (rifle + armor + 1× smoke)
- **Team floor:** If fewer than 3 players can full buy, consider a coordinated force.

### Force Buy Conditions
- [Specific round-state trigger]
- [Specific round-state trigger]

### Eco Strategy
- Full save if team bank < $[amount]
- Pistol force if [condition]
- Drop priority: AWPer → Entry → Support → IGL → Lurker

### Pistol Round
- T pistol: [recommended load-out and opening strategy for this map]
- CT pistol: [recommended load-out and defensive approach for this map]
```

---

## Output Quality Rules

1. **Side purity:** T-side sections describe ONLY Terrorist actions. CT sections describe ONLY CT actions.
2. **Callout accuracy:** Every position must use the map's real, established callout name.
3. **Player count:** Always exactly 5 players assigned.
4. **Timing realism:** Default phase 1:40→1:00, execute 0:55→0:40, post-plant below 0:40.
5. **Utility completeness:** Every smoke, flash, molotov must have throw position AND landing callout.
6. **No vague language:** Never say "towards site", "somewhere near mid", "push aggressively". Always specific.
7. **Watch lineup links:** Append `[▶ Watch lineup](URL)` to every utility entry.
