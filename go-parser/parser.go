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

// ── Output types (match ParsedDemoData in types/database.ts) ─────────────────

type ParseResult struct {
	Header      DemoHeader   `json:"header"`
	Rounds      []Round      `json:"rounds"`
	Players     []PlayerStat `json:"players"`
	Events      []GameEvent  `json:"events"`
	Warnings    []string     `json:"warnings"`
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
	ADR                int     `json:"adr"`
	KAST               int     `json:"kast"`
	Rating             float64 `json:"rating"`
	UtilityDamage      int     `json:"utility_damage"`
	FlashAssists       int     `json:"flash_assists"` //nolint
	MVPs               int     `json:"mvps"`
	RoundsPlayed       int     `json:"rounds_played"`
}

type GameEvent struct {
	Tick int    `json:"tick"`
	Type string `json:"type"`
}

// ── Internal per-player state ─────────────────────────────────────────────────

type playerAccum struct {
	name      string
	steamID   string
	team      string
	totalDmg  int
	utilDmg   int
	kills     int
	deaths    int
	assists   int
	headshots int
	mvps       int
	kastRounds int
}

// ── Internal per-round state ───────────────────────────────────────────────────

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

func parseDemo(buf []byte) (*ParseResult, error) {
	p := dem.NewParser(bytes.NewReader(buf))
	defer p.Close()

	var warnings []string
	accums := map[uint64]*playerAccum{}
	var completedRounds []roundState
	var cur *roundState
	score1, score2 := 0, 0

	// Team name tracking — collected on every RoundEnd
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
			a.name = pl.Name // keep latest name
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
		// Economy at round start (freeze-time end is when players have bought)
		if t := gs.TeamTerrorists(); t != nil {
			r.team1Eco = t.MoneySpentThisRound()
		}
		if ct := gs.TeamCounterTerrorists(); ct != nil {
			r.team2Eco = ct.MoneySpentThisRound()
		}
		cur = r
	})

	p.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
		// Capture economy after freeze-time (more accurate than round start)
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

		if e.Winner == common.TeamTerrorists {
			score1++
		} else if e.Winner == common.TeamCounterTerrorists {
			score2++
		}

		// Collect team names — prefer non-generic values
		if t := gs.TeamTerrorists(); t != nil {
			n := strings.TrimSpace(t.ClanName())
			if n != "" && n != "Terrorists" && n != "TERRORIST" && n != "T" {
				tNames[n]++
			}
		}
		if ct := gs.TeamCounterTerrorists(); ct != nil {
			n := strings.TrimSpace(ct.ClanName())
			if n != "" && n != "Counter-Terrorists" && n != "CT" && n != "Counter Terrorists" {
				ctNames[n]++
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
				cur.killedBy[victim.SteamID64] = killedByEntry{attackerID: killer.SteamID64, tick: tick}
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

		k := Kill{Tick: tick, Headshot: e.IsHeadshot}
		if e.Weapon != nil {
			k.Weapon = e.Weapon.String()
		}
		if killer != nil {
			k.KillerName = killer.Name
			pos := killer.Position()
			k.KillerX, k.KillerY = float64(pos.X), float64(pos.Y)
		}
		if victim != nil {
			k.VictimName = victim.Name
			pos := victim.Position()
			k.VictimX, k.VictimY = float64(pos.X), float64(pos.Y)
		}
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
			return
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

	// ── Parse ─────────────────────────────────────────────────────────────────

	// Capture map name from ConVars during parsing
	mapName := "unknown"
	p.RegisterEventHandler(func(e events.ConVarsUpdated) {
		if m, ok := e.UpdatedConVars["mapname"]; ok && m != "" {
			mapName = strings.TrimSpace(m)
		}
	})

	if err := p.ParseToEnd(); err != nil {
		warnings = append(warnings, fmt.Sprintf("ParseToEnd: %v", err))
	}

	// Fallback: try game rules convar
	if mapName == "unknown" {
		if cv := p.GameState().Rules().ConVars(); cv != nil {
			if m, ok := cv["mapname"]; ok && m != "" {
				mapName = strings.TrimSpace(m)
			}
		}
	}

	// ── Resolve team names ────────────────────────────────────────────────────

	team1Name := mostCommon(tNames)
	team2Name := mostCommon(ctNames)
	if team1Name == "" {
		team1Name = "T-Side"
	}
	if team2Name == "" {
		team2Name = "CT-Side"
	}

	totalRounds := len(completedRounds)

	// ── Assign player teams ───────────────────────────────────────────────────
	// Use current team from game state at parse end, then adjust for halftime.
	// For a standard MR12 game the teams swap after round 12. At game end,
	// players are on their second-half side. We need their starting side.
	for _, pl := range p.GameState().Participants().All() {
		if pl.SteamID64 == 0 {
			continue
		}
		a := getOrCreate(pl)
		if a == nil {
			continue
		}
		// Determine starting team accounting for halftime swap.
		// If we're past regulation (>24 rounds) we don't try to guess OT swaps.
		currentTeam := pl.Team
		startTeam := currentTeam
		if totalRounds > 0 && totalRounds <= 24 {
			// After halftime the sides swap, so starting team = opposite of current
			if totalRounds > 12 {
				if currentTeam == common.TeamTerrorists {
					startTeam = common.TeamCounterTerrorists
				} else if currentTeam == common.TeamCounterTerrorists {
					startTeam = common.TeamTerrorists
				}
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
		adr := 0
		if totalRounds > 0 {
			adr = int(math.Round(float64(a.totalDmg) / float64(totalRounds)))
		}
		kast := 0
		if totalRounds > 0 {
			kast = int(math.Round(float64(a.kastRounds) / float64(totalRounds) * 100))
		}
		kd := float64(a.kills) / math.Max(float64(a.deaths), 1)
		rating := math.Round(math.Max(0.3, math.Min(2.5,
			kd*0.38+float64(adr)/100.0*0.42+0.317+float64(a.mvps)/math.Max(float64(totalRounds), 1)*0.1,
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
			FlashAssists:       0, // flash assist detection requires extra event tracking
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
		winner := team1Name
		if rnd.winnerTeam == common.TeamCounterTerrorists {
			winner = team2Name
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
