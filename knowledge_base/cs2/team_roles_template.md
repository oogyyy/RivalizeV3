# CS2 Team Roles Template

## Overview
A competitive CS2 team consists of exactly 5 players, each assigned a primary role. Roles define default responsibilities but players must be flexible enough to adapt mid-round.

---

## Role Definitions

### Entry Fragger
**Primary job:** First into a site or contested area; trades information for map control.
▸ T-side: Opens sites, forces trades, creates space for teammates. First to peek aggression angles.
▸ CT-side: Early aggressive peek positions to deny T map control; plays the most forward CT position.
▸ Profile: High ADR, accepts death trades, strong aim under pressure, decisive movement.
▸ Utility: Relies on Support's flashes to enter; carries 1 flash of their own for clearing close angles.

### AWPer
**Primary job:** High-impact, long-range pick-taker who controls vision across the map.
▸ T-side: Cross-map picks to open the map; holds mid-ground to deny CT rotations after picks.
▸ CT-side: Opens crossmap angles from safe positions; punishes T's slow approach; repositions after picks.
▸ Profile: Patient, disciplined, manages a costly weapon, high impact per round.
▸ Utility: Support flashes for duel openings; does not over-commit when flanked.

### Support
**Primary job:** Enables teammates through utility — smokes, flashes, mollies, and information calls.
▸ T-side: Executes the smoke/flash choreography for site executes; trails Entry to clean angles.
▸ CT-side: Provides crossfire support; flashes for teammates in duels; rotates to assist anchors.
▸ Profile: High utility damage, strong game sense, willing to sacrifice stats for round impact.
▸ Utility: Carries full utility every round — owns the most utility slots of any role.

### Lurker
**Primary job:** Creates time pressure by threatening rotations and catching defenders out of position.
▸ T-side: Splits from the main attack; cuts off CT rotation paths; times engagement to coincide with execute.
▸ CT-side: Passive information position watching the least-covered T approach; calls early info.
▸ Profile: Excellent game sense, strong 1v1 capability, patient and disciplined.
▸ Utility: Carries minimal utility; uses movement and timing as primary tools.

### IGL (In-Game Leader)
**Primary job:** Reads the round state, calls executes, and manages team economy and morale.
▸ T-side: Safe calling position with good information flow; commits to the execute call at the right moment.
▸ CT-side: Anchors or takes a mid-position; dictates rotation timing; calls for information before committing.
▸ Profile: Strong game sense, decisive, communicates clearly, consistent rather than spectacular.
▸ Utility: Carries 1–2 pieces of utility for their own position; does not over-spend on entry utility.

---

## Dynamic Role Input Format

When generating strategies, team composition is passed as:

```
ROSTER:
- [PlayerName]: [Role]
- [PlayerName]: [Role]
- [PlayerName]: [Role]
- [PlayerName]: [Role]
- [PlayerName]: [Role]
```

**Rules:**
▸ Exactly 5 players must be listed.
▸ Each player gets exactly one role from: Entry, AWPer, Support, Lurker, IGL.
▸ If a player has no assigned role, default to "Rifler" and treat as a flexible Entry/IGL hybrid.
▸ Never invent player names. Use only the names provided.
▸ If more than 2 players share the same role, note the imbalance and adapt positions accordingly.

---

## Role Interaction Matrix

| Role | Depends On | Enables |
|---|---|---|
| Entry | Support (flashes), AWPer (cross-map picks) | IGL (commit call), Support (follow-in) |
| AWPer | Support (openers), IGL (positioning call) | Entry (map opens after picks) |
| Support | IGL (execute timing call) | Entry, AWPer, Lurker (all utility recipients) |
| Lurker | IGL (timing), Entry (distraction) | IGL (info for round decision) |
| IGL | All roles (information flow) | All roles (execute decision) |

---

## Flexibility Rules
▸ AWPer without AWP (eco/force round): plays as a Rifler; prioritises safe picks over aggressive pushes.
▸ Support on low money: carries only 2 utility pieces; prioritises flashes for Entry over smokes.
▸ IGL on eco: gathers information passively with pistol; does not force 1v1 duels.
▸ Lurker on pistol round: plays with the team on either site rather than splitting alone.
