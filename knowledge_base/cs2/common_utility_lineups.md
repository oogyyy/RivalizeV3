# Common Utility Lineups — CS2

This file covers utility concepts, throw mechanics, and cross-map principles applicable to all maps.

---

## Smoke Mechanics

### Key Rules
- A CS2 smoke lasts **18 seconds**.
- Two smokes thrown 3 seconds apart give a continuous 15-second overlap window.
- For an execute, all smokes must land within **1 second of each other** — otherwise CTs can peek through gaps.
- A smoke placed 1 unit outside a doorframe blocks the entire door — it does not need to be centered.

### Throw Types
| Throw Type | Description | When to Use |
|---|---|---|
| Running throw | Jump + throw while moving forward | Fastest; slightly less accurate |
| Standing throw | Aim at lineup, throw from standstill | Best accuracy; use for precise lineups |
| Jump throw | Jump, release at apex | For longer-distance smokes needing loft |
| Left-click + jump | Overhand throw mid-air | Standard for most pre-placed lineups |

### Jump Throw Bind (recommended)
```
alias "+jt" "+jump; -attack"
alias "-jt" "-jump"
bind "key" "+jt"
```
Ensures consistent smoke landing across all players who share a lineup.

---

## Flash Mechanics

### Types
| Type | Description | Ideal Use |
|---|---|---|
| Pop flash | Thrown overhand to explode near a corner | Entry fragging; peeks |
| Underhand flash | Bounced off walls to pop behind cover | Clearing corners; smoking out close holds |
| Airborne flash | Thrown from elevation to blind low-ground targets | Retakes; multi-level maps (Nuke, Overpass) |

### Key Rules
- A flash blinds for up to **3.0 seconds** at full white.
- Throw pop flash **0.5 seconds before** entry fragger peeks — not earlier (CT regains vision).
- Announce every flash: **"Flashing [side]"** on comms to prevent team blindness.
- Never flash from a position your team is looking toward.

---

## Molotov / Incendiary Mechanics

- Burns for **7 seconds** (molotov) / **7 seconds** (incendiary grenade).
- Damage: **40 HP/second** to anyone standing in fire.
- Cannot be extinguished by a smoke grenade landing on it.
- Use to:
  - Clear common CT anchor positions before site entry
  - Delay retakes (throw at bomb plant after planting)
  - Force CTs off aggressive peeks

### Most Impactful Molotov Positions by Map

| Map | T-side Molotov | CT-side Molotov |
|---|---|---|
| Mirage | CT corner on A-Site | B-Apps first corner |
| Dust2 | Goose area | Long Doors corner; B Tunnel lower |
| Inferno | Quad on A-Site | Top Banana; Second corner |
| Nuke | Default Upper plant area | Ramp drop corner |
| Ancient | Cave corner on A | B-Main first corner |
| Anubis | A-Site right corner | B-Main chokepoint |
| Overpass | Bank corner | B-Main Monster corner |

---

## HE Grenade Usage

- Maximum damage: **98 HP** on a direct hit in open air.
- At range: **30–60 HP** depending on distance and wall cover.
- Best used to:
  - Combine with molotov (HE first → molotov) to force movement into fire
  - Punish fast rushers stacking a chokepoint
  - Finish low-HP opponents hiding behind smoke

### "HE + Molotov" Combo
1. Throw HE into a tight choke (B-Apps, Banana top, Ramp)
2. Immediately throw molotov into the same area
3. Any CT who survived the HE is forced to walk through molotov fire
4. Result: CT takes 40–70 HP before any rifle engagement

---

## Smoke Lineup Quick Reference

### Mirage Smokes (T-side execute)
| Smoke | From | Landing | YouTube |
|---|---|---|---|
| CT | Jungle / T-Ramp | CT angle, A-Site | [▶ Watch](https://www.youtube.com/results?search_query=cs2+mirage+smoke+ct) |
| Stairs | T-Ramp | Stairs position, A-Site | [▶ Watch](https://www.youtube.com/results?search_query=cs2+mirage+smoke+stairs) |
| Jungle | T-Side Mid | Jungle corner | [▶ Watch](https://www.youtube.com/results?search_query=cs2+mirage+smoke+jungle) |
| Van | T-Spawn | Van area, B-Site | [▶ Watch](https://www.youtube.com/results?search_query=cs2+mirage+smoke+van) |
| Top Mid | Jungle | Top Mid window | [▶ Watch](https://www.youtube.com/results?search_query=cs2+mirage+smoke+top+mid) |

### Dust2 Smokes (T-side execute)
| Smoke | From | Landing | YouTube |
|---|---|---|---|
| CT | T-Spawn / Long | CT crossing | [▶ Watch](https://www.youtube.com/results?search_query=cs2+dust2+smoke+ct) |
| Short / Catwalk | Long / T-Spawn | Catwalk entry | [▶ Watch](https://www.youtube.com/results?search_query=cs2+dust2+smoke+short+catwalk) |
| Car | Long Doors | Car position | [▶ Watch](https://www.youtube.com/results?search_query=cs2+dust2+smoke+car) |
| B Window | B Tunnels | CT Window angle | [▶ Watch](https://www.youtube.com/results?search_query=cs2+dust2+smoke+b+window) |

### Inferno Smokes (T-side execute)
| Smoke | From | Landing | YouTube |
|---|---|---|---|
| CT (A) | Apartments | CT angle, A-Site | [▶ Watch](https://www.youtube.com/results?search_query=cs2+inferno+smoke+ct+a+site) |
| Library | Arch | Library exit | [▶ Watch](https://www.youtube.com/results?search_query=cs2+inferno+smoke+library) |
| Graveyard | Arch | Graveyard | [▶ Watch](https://www.youtube.com/results?search_query=cs2+inferno+smoke+graveyard) |
| Coffin | Second Banana | Coffin position | [▶ Watch](https://www.youtube.com/results?search_query=cs2+inferno+smoke+coffin) |
| CT (B) | Second Banana | CT back of B | [▶ Watch](https://www.youtube.com/results?search_query=cs2+inferno+smoke+ct+b+site) |

### Nuke Smokes (T-side execute)
| Smoke | From | Landing | YouTube |
|---|---|---|---|
| Heaven | Lobby | Heaven angle | [▶ Watch](https://www.youtube.com/results?search_query=cs2+nuke+smoke+heaven) |
| Trophy/Rafters | Ramp | Trophy position | [▶ Watch](https://www.youtube.com/results?search_query=cs2+nuke+smoke+trophy) |
| Control Room | Ramp | Control room | [▶ Watch](https://www.youtube.com/results?search_query=cs2+nuke+smoke+control+room) |
| Radio | Secret | Radio room | [▶ Watch](https://www.youtube.com/results?search_query=cs2+nuke+smoke+radio) |

---

## Utility Assignment Principles

### By Role

**Support (owns the most utility):**
- Carries: 2× smoke, 2× flash, 1× molotov
- Responsible for site-clearing smokes and entry flashes
- Never uses all utility on info; always saves the critical execute smoke

**IGL:**
- Carries: 1× smoke, 1× molotov OR 1× flash
- Throws the secondary smoke in execute choreography
- Does not sacrifice utility for information — save it for the execute

**Entry:**
- Carries: 1–2× flash
- Uses self-pop flash to enter; may carry HE for combo with molotov
- Does not carry smokes — needs hands free for rifle while entering

**AWPer:**
- Carries: 1× molotov or 1× flash
- Uses molotov to deny default plant during post-plant
- Carries flash only when designated to pop-flash for another entry

**Lurker:**
- Carries: 1× smoke or 1× flash
- Uses utility to delay CT rotation (smoke their rotation path)
- Carries minimal utility — mobility is the priority

---

## Retake Utility Principles

1. **Pop flash before entry** — always. Throw flash into site 0.5s before the first retaking player enters.
2. **Smoke the bomb** — throw a smoke on the bomb when you have enough time advantage. Forces a defuse through smoke (blind defuse risk).
3. **Molotov the bomb** — if T's are holding bomb close and you have a molotov, throw it at the bomb to force them off. They must take fire damage or move.
4. **Clear in order** — always clear closest angle first, then secondary. Rushing past an un-cleared corner loses retakes.
