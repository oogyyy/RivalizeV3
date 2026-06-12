// Distilled professional CS2 knowledge injected into every AI prompt so the
// model reasons like an experienced coach instead of improvising game facts.
// Three blocks: hard game facts, professional principles, and counter-strat
// doctrine for punishing repetitive opponent patterns.

const GAME_FACTS = `
CS2 GAME FACTS (treat as hard constraints — never contradict these):
- Round clock 1:55. Bomb timer 40s. Plant ~3.2s, defuse 10s (5s with kit). Freeze time positions both teams at their spawns.
- Movement: ~250 u/s with knife, ~215-230 with rifles, slower scoped/walking. Ts reach first contact points (mid, chokes, site entrances) roughly 8-15s after barriers drop; CTs always reach their site positions first. A T-side player physically CANNOT be inside CT territory in the opening seconds.
- Grenade loadout: max 4 grenades per player — at most 1 smoke, 2 flashes, 1 molotov/incendiary, 1 HE. Five players carry at most 5 smokes total; an execute cannot use more smokes than the players committed to it carry.
- Utility behaviour: smokes bloom in ~1s and last ~18-20s (an HE briefly clears a hole); molotovs deny an area ~7s; a full flash blinds up to ~2s; utility thrown without an established lineup is unreliable.
- Economy: loss bonus ladder $1400→$3400 (resets on round win). Rifles: AK $2700, M4A1-S $2900 / M4A4 $3100, AWP $4750. Armor+helmet $1000, kit $400. Full rifle buy with utility needs ~$4700-5500 per player. After a pistol-round loss the losing team cannot full buy round 2; their realistic options are full eco or light force.
- Sides: 12 T rounds then 12 CT rounds (MR12). Pistol rounds are rounds 1 and 13.`

const PRO_PRINCIPLES = `
PROFESSIONAL PRINCIPLES (how 20,000-hour players actually think):
- Trades win rounds: an entry is only worth taking if a teammate is positioned to refrag within ~2s. Never describe a player taking a fight no one can trade.
- Map control before commitment: T-sides default to gather info and control space (mid, key chokes) with minimal risk, then convert control into an execute. Executes spend synchronized utility to take a site; the smokes must land within ~1s of each other.
- 5 players = 5 jobs: every strat must account for all five (entry, trade, utility, lurk/cut, caller). A player cannot throw two lineups from different positions at the same time or hold two angles at once.
- CT structure: anchors hold sites for time and information, not hero kills; rotations are triggered by confirmed info (bodies, utility, sound), never by silence — silence is what fakes are made of. Over-rotating off first contact loses rounds.
- Crossfires beat aim: two defenders covering each other from different angles force attackers to win two duels at once. Off-angles win the first round they're used, then become pre-aimed liabilities — vary them.
- Utility discipline: CTs who spend all utility early have nothing for the retake; Ts who execute without flashes feed anchors. Late-round utility is usually worth more than early-round utility.
- Tempo reads: fast contact at multiple points = rush or split, commit defense early; no contact by 1:10 = default/late execute, sneak aggression for info; one site quiet for several rounds = lurk or stack incoming.
- Economy is a weapon: winning a round matters less than what it does to both economies. Forcing the opponent to reset twice is worth more than a single round.`

const COUNTER_STRAT = `
COUNTER-STRAT DOCTRINE (apply whenever demo data shows a repeated pattern):
- Thresholds: a tendency appearing in ≥50% of rounds across 2+ demos is a reliable read; ≥70% is a habit you punish directly. Mention the rate when citing it.
- Every counter must be a trigger→response pair: "when we see/hear X, [player/role] does Y at [callout] with [utility]". A counter that is not actionable mid-round is not a counter.
- Repeated site executes: stack the favored site on their full-buy rounds, pre-aim their known entry choke, and time a molotov into the choke at their average execute timing so it burns as they commit. Keep 2 players' utility unspent for the retake on the off-site.
- Signature smoke setups: their smokes tell you where they WON'T be looking — hold the angles their usual smokes don't cut, reposition anchors so the standard lineups blank the wrong spots, and occasionally play inside or push through the expected smoke.
- Rushes: if they rush the same path, sacrifice map control elsewhere and meet them with a stacked crossfire plus early info utility (flash/HE into the choke at the timing the demos show).
- Slow defaults: punish with mid-round CT aggression on the map half their default leaves thin — win a 4v3 fight on their weak side before their execute window opens.
- Lurkers: identify the habitual lurker from the data; rotate around their known path, never through it, and assign one player to track the missing man.
- Economy habits: if they force after lost pistols, set anti-force positions (close-range, deny AWP value, play for exit denial); if they always full-save, preserve your utility and farm exit kills without over-chasing.
- Star players: deny their best player's known positions with utility before contact rather than dueling them dry; make the weakest opponent the one who has to make plays.`

export interface DoctrineOptions {
  /** Include the counter-strat doctrine (opponent scouting / anti-strat contexts) */
  counterStrat?: boolean
}

/** Composes the CS2 expert doctrine block for AI system prompts. */
export function cs2Doctrine(opts: DoctrineOptions = {}): string {
  const blocks = [GAME_FACTS, PRO_PRINCIPLES]
  if (opts.counterStrat) blocks.push(COUNTER_STRAT)
  return blocks.join('\n')
}
