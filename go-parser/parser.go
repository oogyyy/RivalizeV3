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
	Number       int     `json:"number"`
	Winner       string  `json:"winner"`
	WinReason    string  `json:"win_reason"`
	Duration     int     `json:"duration"`
	Team1Economy int     `json:"team1_economy"`
	Team2Economy int     `json:"team2_economy"`
	BombPlanted  bool    `json:"bomb_planted"`
	BombDefused  bool    `json:"bomb_defused"`
	Kills        []Kill  `json:"kills"`
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

// ── Internal per-round state ──────────────────────────────────────────────────

type roundState struct {
	startTick   int
	endTick     int
	winnerTeam  common.Team
	winReason   events.RoundEndReason
	team1Eco    int
	team2Eco    int
	bombPlanted bool
	bombDefused bool
	kills       []Kill
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

	var warnings []string
	accums := map[uint64]*playerAccum{}
	var completedRounds []roundState
	var cur *roundState
	score1, score2 := 0, 0

	// Team names — only collected from the FIRST HALF (rounds 0–11) so the names
	// are anchored to the original T/CT starting sides before the halftime swap.
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

	// ── Handlers ─────────────────────────────────────────────────────────────

	p.RegisterEventHandler(func(e events.RoundStart) {
		gs := p.GameState()
		r := &roundState{
			startTick: gs.IngameTick(),
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

		// ── MR12-aware score counting ──────────────────────────────────────────
		// roundIdx is 0-based index of the round being completed.
		// In the first half (rounds 0-11) T wins go to team1.
		// After halftime the sides swap, so T wins go to team2, etc.
		roundIdx := len(completedRounds)
		if tWinsGoToTeam1(roundIdx) {
			if e.Winner == common.TeamTerrorists {
				score1++
			} else {
				score2++
			}
		} else {
			if e.Winner == common.TeamTerrorists {
				score2++
			} else {
				score1++
			}
		}

		// ── Team name collection — first half only ─────────────────────────────
		// Collecting from all rounds would mix post-halftime names (wrong team
		// labeled as T or CT). First-half names are stable and unambiguous.
		if roundIdx < regulationHalf {
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
		gs := p.GameState()
		tick := gs.IngameTick()

		killer := e.Killer
		victim := e.Victim
		assister := e.Assister

		if victim != nil && victim.SteamID64 != 0 {
			if va := getOrCreate(victim); va != nil {
				va.deaths++
			}
			cur.victims[victim.SteamID64] = true
			if killer != nil && killer.SteamID64 != 0 && killer.SteamID64 != victim.SteamID64 {
				cur.killedBy[victim.SteamID64] = killedByEntry{
					attackerID: killer.SteamID64,
					tick:       tick,
				}
			}
		}

		if killer != nil && killer.SteamID64 != 0 && victim != nil && victim.SteamID64 != 0 &&
			killer.SteamID64 != victim.SteamID64 && killer.Team != victim.Team {
			if ka := getOrCreate(killer); ka != nil {
				ka.kills++
				if e.IsHeadshot {
					ka.headshots++
				}
			}
			cur.killers[killer.SteamID64] = true
		}

		if assister != nil && assister.SteamID64 != 0 {
			if aa := getOrCreate(assister); aa != nil {
				aa.assists++
			}
			cur.assisters[assister.SteamID64] = true
		}

		// Skip self-kills (fall damage, world kills) — they corrupt stats and heatmaps
		isSelfKill := killer == nil || victim == nil || killer.SteamID64 == 0 || victim.SteamID64 == 0 ||
			killer.SteamID64 == victim.SteamID64
		if isSelfKill {
			return
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
		if e.Weapon != nil && e.Weapon.Class() == common.EqClassGrenade {
			atk.utilDmg += dmg
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

	// Capture map name — prefer demo header, fall back to ConVars
	mapName := strings.TrimSpace(p.Header().MapName)
	if mapName == "" {
		mapName = "unknown"
	}
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
	if mapName == "" {
		mapName = "unknown"
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
	// At parse end, players are on their current (possibly post-halftime) side.
	// For regulation games (≤24 rounds), if more than 12 rounds completed the
	// teams have swapped, so we flip current team → starting team.
	// OT (>24 rounds) is not adjusted — acceptable known limitation.
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
		if totalRounds > regulationHalf && totalRounds <= regulationHalf*2 {
			// Regulation second half: flip to get starting side
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

	// ── KAST ─────────────────────────────────────────────────────────────────

	for _, rnd := range completedRounds {
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
		// ADR: one decimal place for precision matching reference stat sites
		adr := 0.0
		if totalRounds > 0 {
			adr = math.Round(float64(a.totalDmg)/float64(totalRounds)*10) / 10
		}
		kast := 0
		if totalRounds > 0 {
			kast = int(math.Round(float64(a.kastRounds) / float64(totalRounds) * 100))
		}
		kd := float64(a.kills) / math.Max(float64(a.deaths), 1)
		rating := math.Round(math.Max(0.3, math.Min(2.5,
			kd*0.38+adr/100.0*0.42+0.317+float64(a.mvps)/math.Max(float64(totalRounds), 1)*0.1,
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
			RoundsPlayed:       totalRounds,
		})
	}

	sort.Slice(players, func(i, j int) bool {
		return players[i].Rating > players[j].Rating
	})

	// ── Build round list ──────────────────────────────────────────────────────

	var outRounds []Round
	for i, rnd := range completedRounds {
		// Use the same MR12 logic to determine the winner team name
		var winner string
		if tWinsGoToTeam1(i) {
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
