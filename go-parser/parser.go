package main

import (
	"bytes"
	"fmt"
	"math"
	"sort"
	"strings"

	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/msg"
)

// ── MR12 halftime constants ───────────────────────────────────────────────────

const regulationHalf = 12
const otHalfSize = 3

// tWinsGoToTeam1 returns true when T-side wins in this round should be credited
// to team1 (the original first-half T-starters). Matches the TypeScript logic.
func tWinsGoToTeam1(roundIdx int) bool {
	if roundIdx < regulationHalf {
		return true // Rounds 1-12: T is team1
	}
	if roundIdx < regulationHalf*2 {
		return false // Rounds 13-24: T is team2
	}
	// OT: each mini-half is otHalfSize rounds, alternating orientation
	otIdx := roundIdx - regulationHalf*2
	otHalf := otIdx / otHalfSize
	return otHalf%2 == 1
}

// ── Output types (match ParsedDemoData in types/database.ts) ─────────────────

type ParseResult struct {
	Header   DemoHeader   `json:"header"`
	Rounds   []Round      `json:"rounds"`
	Players  []PlayerStat `json:"players"`
	Events   []GameEvent  `json:"events"`
	Warnings []string     `json:"warnings"`
}

type DemoHeader struct {
	Map         string `json:"map"`
	Team1       string `json:"team1"`
	Team2       string `json:"team2"`
	ScoreTeam1  int    `json:"score_team1"`
	ScoreTeam2  int    `json:"score_team2"`
	Duration    int    `json:"duration"`
	TotalRounds int    `json:"total_rounds"`
}

type Round struct {
	Number       int    `json:"number"`
	Winner       string `json:"winner"`
	WinReason    string `json:"win_reason"`
	Duration     int    `json:"duration"`
	Team1Economy int    `json:"team1_economy"`
	Team2Economy int    `json:"team2_economy"`
	BombPlanted  bool   `json:"bomb_planted"`
	BombDefused  bool   `json:"bomb_defused"`
	Kills        []Kill `json:"kills"`
}

type Kill struct {
	Tick       int     `json:"tick"`
	Time       float64 `json:"time"`
	KillerName string  `json:"killer_name"`
	VictimName string  `json:"victim_name"`
	Weapon     string  `json:"weapon"`
	Headshot   bool    `json:"headshot"`
	KillerX    float64 `json:"killer_x"`
	KillerY    float64 `json:"killer_y"`
	VictimX    float64 `json:"victim_x"`
	VictimY    float64 `json:"victim_y"`
}

type PlayerStat struct {
	SteamID            string  `json:"steam_id"`
	Name               string  `json:"name"`
	Team               string  `json:"team"`
	Kills              int     `json:"kills"`
	Deaths             int     `json:"deaths"`
	Assists            int     `json:"assists"`
	Headshots          int     `json:"headshots"`
	HeadshotPercentage int     `json:"headshot_percentage"`
	ADR                float64 `json:"adr"`
	KAST               int     `json:"kast"`
	Rating             float64 `json:"rating"`
	UtilityDamage      int     `json:"utility_damage"`
	FlashAssists       int     `json:"flash_assists"`
	MVPs               int     `json:"mvps"`
	RoundsPlayed       int     `json:"rounds_played"`
}

type GameEvent struct {
	Tick int    `json:"tick"`
	Type string `json:"type"`
}

// ── Internal per-player state ─────────────────────────────────────────────────

type playerAccum struct {
	name       string
	steamID    string
	team       string
	totalDmg   int
	utilDmg    int
	kills      int
	deaths     int
	assists    int
	headshots  int
	mvps       int
	kastRounds int
}

// roundContrib tracks a single player's contribution within one round so we
// can subtract knife-round contributions from accums in post-processing.
type roundContrib struct {
	kills     int
	deaths    int
	assists   int
	headshots int
	dmg       int
	utilDmg   int
}

// ── Internal per-round state ──────────────────────────────────────────────────

type roundState struct {
	startTick    int
	endTick      int
	winnerTeam   common.Team
	winReason    events.RoundEndReason
	team1Eco     int
	team2Eco     int
	bombPlanted  bool
	bombDefused  bool
	isKnifeRound bool
	kills        []Kill
	// per-player contributions this round (for knife-round post-processing)
	contribs map[uint64]*roundContrib
	// KAST helpers
	killers   map[uint64]bool
	victims   map[uint64]bool
	assisters map[uint64]bool
	killedBy  map[uint64]killedByEntry
}

type killedByEntry struct {
	attackerID uint64
	tick       int
}

// ── Main parse function ───────────────────────────────────────────────────────

func parseDemo(buf []byte) (result *ParseResult, err error) {
	// Recover from panics caused by corrupt / truncated demo files
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("parser panic: %v", r)
		}
	}()

	p := dem.NewParser(bytes.NewReader(buf))
	defer p.Close()

	mapName := "unknown"
	var warnings []string
	accums := map[uint64]*playerAccum{}
	var completedRounds []roundState
	var cur *roundState

	// Team names — only collected from the first half so the names are anchored
	// to the original T/CT starting sides before the halftime swap.
	// nonKnifeCollected tracks how many real (non-knife) rounds we've seen so far
	// in the RoundEnd handler so we stop collecting after regulationHalf rounds.
	nonKnifeCollected := 0
	tNames := map[string]int{}
	ctNames := map[string]int{}

	getOrCreate := func(pl *common.Player) *playerAccum {
		if pl == nil || pl.SteamID64 == 0 {
			return nil
		}
		a, ok := accums[pl.SteamID64]
		if !ok {
			a = &playerAccum{
				name:    pl.Name,
				steamID: fmt.Sprintf("%d", pl.SteamID64),
			}
			accums[pl.SteamID64] = a
		} else if pl.Name != "" {
			a.name = pl.Name
		}
		return a
	}

	// getContrib returns (creating if needed) the per-round contribution tracker
	// for the given player in the given round.
	getContrib := func(r *roundState, sid uint64) *roundContrib {
		if c, ok := r.contribs[sid]; ok {
			return c
		}
		c := &roundContrib{}
		r.contribs[sid] = c
		return c
	}

	// ── Handlers ─────────────────────────────────────────────────────────────

	p.RegisterEventHandler(func(e events.RoundStart) {
		gs := p.GameState()
		r := &roundState{
			startTick: gs.IngameTick(),
			contribs:  map[uint64]*roundContrib{},
			killers:   map[uint64]bool{},
			victims:   map[uint64]bool{},
			assisters: map[uint64]bool{},
			killedBy:  map[uint64]killedByEntry{},
		}
		if t := gs.TeamTerrorists(); t != nil {
			r.team1Eco = t.MoneySpentThisRound()
		}
		if ct := gs.TeamCounterTerrorists(); ct != nil {
			r.team2Eco = ct.MoneySpentThisRound()
		}
		cur = r
	})

	p.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
		// Economy after freeze-time is more accurate (captures buy-phase spending)
		if cur == nil {
			return
		}
		gs := p.GameState()
		if t := gs.TeamTerrorists(); t != nil {
			cur.team1Eco = t.MoneySpentThisRound()
		}
		if ct := gs.TeamCounterTerrorists(); ct != nil {
			cur.team2Eco = ct.MoneySpentThisRound()
		}
	})

	p.RegisterEventHandler(func(e events.RoundEnd) {
		if cur == nil {
			return
		}
		gs := p.GameState()
		cur.endTick = gs.IngameTick()
		cur.winnerTeam = e.Winner
		cur.winReason = e.Reason

		// Mark as knife round if every kill used a knife — detected at RoundEnd
		// after all Kill events for this round have already fired.
		if len(cur.kills) > 0 {
			allKnife := true
			for _, k := range cur.kills {
				if !isKnifeWeapon(k.Weapon) {
					allKnife = false
					break
				}
			}
			cur.isKnifeRound = allKnife
		}

		// ── Team name collection — first half real rounds only ─────────────────
		// Score counting is done in post-processing where we know the knife offset.
		// Team names: collect while we haven't yet seen regulationHalf non-knife rounds.
		if !cur.isKnifeRound && nonKnifeCollected < regulationHalf {
			if t := gs.TeamTerrorists(); t != nil {
				n := strings.TrimSpace(t.ClanName())
				if isRealTeamName(n) {
					tNames[n]++
				}
			}
			if ct := gs.TeamCounterTerrorists(); ct != nil {
				n := strings.TrimSpace(ct.ClanName())
				if isRealTeamName(n) {
					ctNames[n]++
				}
			}
			nonKnifeCollected++
		}

		completedRounds = append(completedRounds, *cur)
		cur = nil
	})

	p.RegisterEventHandler(func(e events.BombPlanted) {
		if cur != nil {
			cur.bombPlanted = true
		}
	})

	p.RegisterEventHandler(func(e events.BombDefused) {
		if cur != nil {
			cur.bombDefused = true
		}
	})

	p.RegisterEventHandler(func(e events.Kill) {
		if cur == nil {
			return
		}
		// NOTE: Do NOT check cur.isKnifeRound here — that flag is set at RoundEnd,
		// which fires AFTER all Kill events for the round. Knife-round exclusion is
		// handled in post-processing below.

		gs := p.GameState()
		tick := gs.IngameTick()

		killer := e.Killer
		victim := e.Victim
		assister := e.Assister

		// World kills (C4 explosion, fall damage): killer is nil or SteamID64==0.
		// The victim still gets a death; there's no killer credit or kill list entry.
		isWorldKill := killer == nil || killer.SteamID64 == 0

		if isWorldKill {
			if victim != nil && victim.SteamID64 != 0 {
				if va := getOrCreate(victim); va != nil {
					va.deaths++
				}
				cur.victims[victim.SteamID64] = true
				getContrib(cur, victim.SteamID64).deaths++
			}
			return
		}

		// True self-kills (fall damage etc. where killer == victim): skip entirely.
		// FACEIT does not count self-kills as deaths, so neither do we.
		if victim == nil || victim.SteamID64 == 0 || killer.SteamID64 == victim.SteamID64 {
			return
		}

		crossTeam := killer.Team != victim.Team

		// Victim death
		if va := getOrCreate(victim); va != nil {
			va.deaths++
		}
		cur.victims[victim.SteamID64] = true
		cur.killedBy[victim.SteamID64] = killedByEntry{attackerID: killer.SteamID64, tick: tick}
		getContrib(cur, victim.SteamID64).deaths++

		// Killer stats (cross-team only)
		if crossTeam {
			if ka := getOrCreate(killer); ka != nil {
				ka.kills++
				if e.IsHeadshot {
					ka.headshots++
				}
			}
			cur.killers[killer.SteamID64] = true
			kc := getContrib(cur, killer.SteamID64)
			kc.kills++
			if e.IsHeadshot {
				kc.headshots++
			}
		}

		// Assist (cross-team only)
		if crossTeam && assister != nil && assister.SteamID64 != 0 {
			if aa := getOrCreate(assister); aa != nil {
				aa.assists++
			}
			cur.assisters[assister.SteamID64] = true
			getContrib(cur, assister.SteamID64).assists++
		}

		timeInRound := 0.0
		if cur.startTick > 0 && tick > cur.startTick {
			timeInRound = float64(tick-cur.startTick) / 64.0
		}

		k := Kill{Tick: tick, Time: timeInRound, Headshot: e.IsHeadshot}
		if e.Weapon != nil {
			k.Weapon = e.Weapon.String()
		}
		k.KillerName = killer.Name
		pos := killer.Position()
		k.KillerX, k.KillerY = float64(pos.X), float64(pos.Y)
		k.VictimName = victim.Name
		pos = victim.Position()
		k.VictimX, k.VictimY = float64(pos.X), float64(pos.Y)
		cur.kills = append(cur.kills, k)
	})

	p.RegisterEventHandler(func(e events.PlayerHurt) {
		if cur == nil {
			return
		}
		// NOTE: Knife-round exclusion handled in post-processing, not here.
		if e.Attacker == nil || e.Player == nil {
			return
		}
		if e.Attacker.SteamID64 == 0 || e.Player.SteamID64 == 0 {
			return
		}
		if e.Attacker.Team == e.Player.Team {
			return // skip friendly fire
		}
		atk := getOrCreate(e.Attacker)
		if atk == nil {
			return
		}
		dmg := e.HealthDamageTaken
		if dmg > 100 {
			dmg = 100
		}
		atk.totalDmg += dmg
		rc := getContrib(cur, e.Attacker.SteamID64)
		rc.dmg += dmg
		if e.Weapon != nil && e.Weapon.Class() == common.EqClassGrenade {
			atk.utilDmg += dmg
			rc.utilDmg += dmg
		}
	})

	p.RegisterEventHandler(func(e events.RoundMVPAnnouncement) {
		if e.Player == nil || e.Player.SteamID64 == 0 {
			return
		}
		if a := getOrCreate(e.Player); a != nil {
			a.mvps++
		}
	})

	// Primary: capture map name from the binary demo file header message
	p.RegisterNetMessageHandler(func(m *msg.CDemoFileHeader) {
		if n := strings.TrimSpace(m.GetMapName()); n != "" {
			mapName = n
		}
	})

	// Fallback: ConVars event (fires during gameplay, after the header)
	p.RegisterEventHandler(func(e events.ConVarsUpdated) {
		if mapName != "unknown" {
			return
		}
		if m, ok := e.UpdatedConVars["mapname"]; ok && m != "" {
			mapName = strings.TrimSpace(m)
		}
	})

	// ── Parse ─────────────────────────────────────────────────────────────────

	if err := p.ParseToEnd(); err != nil {
		warnings = append(warnings, fmt.Sprintf("ParseToEnd: %v", err))
	}

	// Final fallback: game rules ConVars (checked after ParseToEnd)
	if mapName == "unknown" {
		if cv := p.GameState().Rules().ConVars(); cv != nil {
			if m, ok := cv["mapname"]; ok && m != "" {
				mapName = strings.TrimSpace(m)
			}
		}
	}

	// ── Post-process: subtract knife-round contributions ──────────────────────
	// Kill/PlayerHurt handlers fire DURING the round, before isKnifeRound is set
	// at RoundEnd. We tracked per-round per-player contributions so we can undo
	// knife-round stats here, after all rounds are complete.
	nonKnifeRounds := 0
	for i := range completedRounds {
		rnd := &completedRounds[i]
		if rnd.isKnifeRound {
			for sid, contrib := range rnd.contribs {
				if a, ok := accums[sid]; ok {
					a.kills -= contrib.kills
					a.deaths -= contrib.deaths
					a.assists -= contrib.assists
					a.headshots -= contrib.headshots
					a.totalDmg -= contrib.dmg
					a.utilDmg -= contrib.utilDmg
				}
			}
		} else {
			nonKnifeRounds++
		}
	}

	// ── Compute scores (post-processing, knife-round aware) ──────────────────
	// We use a real-round index (skipping knife rounds) so that the MR12 halftime
	// boundary is correct even when a knife round precedes the actual match.
	// e.g. knife + 12 first-half rounds means the second half begins at real-idx 12,
	// not demo-idx 12 — without this adjustment, the 12th real round is incorrectly
	// counted as a second-half round and its T-win credited to the wrong team.
	score1, score2 := 0, 0
	{
		realIdx := 0
		for _, rnd := range completedRounds {
			if rnd.isKnifeRound {
				continue
			}
			if tWinsGoToTeam1(realIdx) {
				if rnd.winnerTeam == common.TeamTerrorists {
					score1++
				} else {
					score2++
				}
			} else {
				if rnd.winnerTeam == common.TeamTerrorists {
					score2++
				} else {
					score1++
				}
			}
			realIdx++
		}
	}

	// ── Resolve team names ────────────────────────────────────────────────────

	team1Name := mostCommon(tNames) // original T-starters
	team2Name := mostCommon(ctNames) // original CT-starters
	if team1Name == "" {
		team1Name = "T-Side"
	}
	if team2Name == "" {
		team2Name = "CT-Side"
	}

	totalRounds := len(completedRounds)

	// ── Assign player starting teams ─────────────────────────────────────────
	for _, pl := range p.GameState().Participants().All() {
		if pl.SteamID64 == 0 {
			continue
		}
		a := getOrCreate(pl)
		if a == nil {
			continue
		}
		currentTeam := pl.Team
		startTeam := currentTeam
		if nonKnifeRounds > regulationHalf && nonKnifeRounds <= regulationHalf*2 {
			if currentTeam == common.TeamTerrorists {
				startTeam = common.TeamCounterTerrorists
			} else if currentTeam == common.TeamCounterTerrorists {
				startTeam = common.TeamTerrorists
			}
		}
		if startTeam == common.TeamTerrorists {
			a.team = team1Name
		} else if startTeam == common.TeamCounterTerrorists {
			a.team = team2Name
		} else {
			a.team = "Unknown"
		}
	}

	// ── KAST (excludes knife rounds) ─────────────────────────────────────────

	for _, rnd := range completedRounds {
		if rnd.isKnifeRound {
			continue
		}
		traded := map[uint64]bool{}
		for victimID, kb := range rnd.killedBy {
			if rnd.victims[kb.attackerID] {
				if atkKb, ok := rnd.killedBy[kb.attackerID]; ok && atkKb.tick > kb.tick {
					traded[victimID] = true
				}
			}
		}
		for sid, a := range accums {
			K := rnd.killers[sid]
			A := rnd.assisters[sid]
			S := !rnd.victims[sid]
			T := traded[sid]
			if K || A || S || T {
				a.kastRounds++
			}
		}
	}

	// ── Build player list ─────────────────────────────────────────────────────

	var players []PlayerStat
	for _, a := range accums {
		if a.name == "" || a.steamID == "" || a.steamID == "0" {
			continue
		}
		if a.team == "Unknown" && a.kills == 0 && a.deaths == 0 {
			continue
		}

		hsPercent := 0
		if a.kills > 0 {
			hsPercent = int(math.Round(float64(a.headshots) / float64(a.kills) * 100))
		}
		// ADR and KAST use nonKnifeRounds to match FACEIT's denominator
		adr := 0.0
		if nonKnifeRounds > 0 {
			adr = math.Round(float64(a.totalDmg)/float64(nonKnifeRounds)*10) / 10
		}
		kast := 0
		if nonKnifeRounds > 0 {
			kast = int(math.Round(float64(a.kastRounds) / float64(nonKnifeRounds) * 100))
		}
		kd := float64(a.kills) / math.Max(float64(a.deaths), 1)
		rating := math.Round(math.Max(0.3, math.Min(2.5,
			kd*0.38+adr/100.0*0.42+0.317+float64(a.mvps)/math.Max(float64(nonKnifeRounds), 1)*0.1,
		))*100) / 100

		players = append(players, PlayerStat{
			SteamID:            a.steamID,
			Name:               a.name,
			Team:               a.team,
			Kills:              a.kills,
			Deaths:             a.deaths,
			Assists:            a.assists,
			Headshots:          a.headshots,
			HeadshotPercentage: hsPercent,
			ADR:                adr,
			KAST:               kast,
			Rating:             rating,
			UtilityDamage:      a.utilDmg,
			FlashAssists:       0,
			MVPs:               a.mvps,
			RoundsPlayed:       nonKnifeRounds,
		})
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].Rating > players[j].Rating
	})

	// ── Build round list ──────────────────────────────────────────────────────

	var outRounds []Round
	{
		realIdx := 0
		for i, rnd := range completedRounds {
			// Knife rounds are in the "first half" orientation by definition;
			// real rounds use a 0-based index that excludes knife rounds so the
			// MR12 halftime boundary is correct regardless of how many knife rounds
			// preceded the match.
			var winner string
			if rnd.isKnifeRound || tWinsGoToTeam1(realIdx) {
				if rnd.winnerTeam == common.TeamTerrorists {
					winner = team1Name
				} else {
					winner = team2Name
				}
			} else {
				if rnd.winnerTeam == common.TeamTerrorists {
					winner = team2Name
				} else {
					winner = team1Name
				}
			}
			if !rnd.isKnifeRound {
				realIdx++
			}

			dur := 90
			if rnd.endTick > rnd.startTick {
				dur = (rnd.endTick - rnd.startTick) / 64
			}
			outRounds = append(outRounds, Round{
				Number:       i + 1,
				Winner:       winner,
				WinReason:    roundReasonString(rnd.winReason),
				Duration:     dur,
				Team1Economy: rnd.team1Eco,
				Team2Economy: rnd.team2Eco,
				BombPlanted:  rnd.bombPlanted,
				BombDefused:  rnd.bombDefused,
				Kills:        rnd.kills,
			})
		}
	}

	if len(players) == 0 {
		return nil, fmt.Errorf("no player data extracted (rounds=%d, map=%s)", totalRounds, mapName)
	}

	return &ParseResult{
		Header: DemoHeader{
			Map:         mapName,
			Team1:       team1Name,
			Team2:       team2Name,
			ScoreTeam1:  score1,
			ScoreTeam2:  score2,
			Duration:    totalRounds * 90,
			TotalRounds: totalRounds,
		},
		Rounds:   outRounds,
		Players:  players,
		Events:   []GameEvent{},
		Warnings: warnings,
	}, nil
}

// isRealTeamName returns true when a clan name is a genuine team name and not
// a CS2 placeholder string.
func isRealTeamName(n string) bool {
	if n == "" {
		return false
	}
	bad := []string{
		"Terrorists", "TERRORIST", "T",
		"Counter-Terrorists", "Counter Terrorists", "CT",
		"Unassigned", "Spectator",
	}
	for _, b := range bad {
		if strings.EqualFold(n, b) {
			return false
		}
	}
	return true
}

func isKnifeWeapon(w string) bool {
	switch w {
	case "Knife", "Knife T", "Bayonet", "Karambit", "M9 Bayonet", "Gut Knife",
		"Flip Knife", "Falchion Knife", "Bowie Knife", "Butterfly Knife",
		"Shadow Daggers", "Huntsman Knife", "Navaja Knife", "Stiletto Knife",
		"Talon Knife", "Ursus Knife", "Classic Knife", "Paracord Knife",
		"Survival Knife", "Nomad Knife", "Skeleton Knife":
		return true
	}
	return false
}

// mostCommon returns the most frequently occurring key in a count map.
func mostCommon(m map[string]int) string {
	best, bestN := "", 0
	for k, n := range m {
		if n > bestN {
			best, bestN = k, n
		}
	}
	return best
}

func roundReasonString(r events.RoundEndReason) string {
	switch r {
	case events.RoundEndReasonTargetBombed:
		return "bomb_exploded"
	case events.RoundEndReasonBombDefused:
		return "bomb_defused"
	case events.RoundEndReasonCTWin:
		return "ct_killed"
	case events.RoundEndReasonTerroristsWin:
		return "terrorists_win"
	case events.RoundEndReasonTargetSaved:
		return "time_expired"
	case events.RoundEndReasonHostagesRescued:
		return "hostage_rescued"
	default:
		return "elimination"
	}
}
