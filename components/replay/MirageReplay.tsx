'use client'
// MirageReplay — controller around the R3F MirageScene blockout.
// Handles round selection, playback clock, the parsed_data → frames adapter,
// and forwards an onStateChange compatible with Replay3DCanvas so the demo
// page's AI chat / voice sync keep working when mirage uses this viewer.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import type { ParsedDemoData, Round, PositionFrame, Kill } from '@/types/database'
import MirageScene, { type DemoData, type PlayerState, type Trajectory } from '@/components/replay/MirageScene'

interface Props {
  parsed: ParsedDemoData | null
  team1?: string
  team2?: string
  onStateChange?: (state: {
    roundIdx: number; time: number; duration: number; mapName: string
    aliveCT: number; aliveT: number; bombStatus: string | null
    recentKills: { killer: string; victim: string; weapon: string; time: number }[]
  }) => void
}

// Adapt one round's position frames (snapshots, seconds) → MirageScene DemoData.
// Snapshots have no steamId, so the player name is used as the stable id.
function roundToDemoData(round: Round | undefined): DemoData {
  const frames = round?.frames ?? []
  return {
    frames: frames.map((f: PositionFrame) => ({
      tick: f.t, // seconds since round start — fractional "tick" the scene interpolates on
      players: (f.p ?? []).map(s => ({
        steamId: s.n,
        name: s.n,
        team: (s.t === 'CT' ? 'CT' : 'T') as 'T' | 'CT',
        x: s.x, y: s.y, z: s.z ?? 0,
        yaw: s.w ?? 0,
        alive: s.a,
      })),
    })),
  }
}

export default function MirageReplay({ parsed, onStateChange }: Props) {
  const rounds = useMemo(() => parsed?.rounds ?? [], [parsed])
  const [roundIdx, setRoundIdx] = useState(0)
  const [time, setTime] = useState(0)         // seconds since round start
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showZones, setShowZones] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)

  const round = rounds[roundIdx]
  const duration = Math.max(round?.duration ?? 115, 1)
  const demoData = useMemo(() => roundToDemoData(round), [round])

  // Reset clock when the round changes.
  useEffect(() => { setTime(0); setPlaying(false) }, [roundIdx])

  // Playback loop (real seconds × speed).
  useEffect(() => {
    if (!playing) { cancelAnimationFrame(rafRef.current); return }
    lastRef.current = performance.now()
    const step = () => {
      const now = performance.now()
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      setTime(t => {
        const next = t + dt * speed
        if (next >= duration) { setPlaying(false); return duration }
        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, speed, duration])

  // Selected player's path up to `time` → trajectory tube.
  const trajectories = useMemo<Trajectory[]>(() => {
    if (!selected) return []
    const pts: { x: number; y: number; z: number }[] = []
    for (const f of demoData.frames) {
      if (f.tick > time) break
      const p = f.players.find(pl => pl.steamId === selected)
      if (p && p.alive !== false) pts.push({ x: p.x, y: p.y, z: p.z })
    }
    return pts.length > 1 ? [{ points: pts, color: '#ffd54f' }] : []
  }, [selected, demoData, time])

  // Forward replay state for the AI chat / voice sync (Replay3DCanvas parity).
  const emit = useCallback(() => {
    if (!onStateChange || !round) return
    const frame = [...demoData.frames].reverse().find(f => f.tick <= time) ?? demoData.frames[0]
    const alive = (team: 'CT' | 'T') => (frame?.players ?? []).filter((p: PlayerState) => p.team === team && p.alive !== false).length
    const planted = round.bomb_planted && round.plant_time != null && time >= round.plant_time
    const recentKills = (round.kills ?? [])
      .filter((k: Kill) => k.time <= time && k.time > time - 4)
      .map((k: Kill) => ({ killer: k.killer_name, victim: k.victim_name, weapon: k.weapon, time: k.time }))
    onStateChange({
      roundIdx, time, duration, mapName: parsed?.header.map ?? 'de_mirage',
      aliveCT: alive('CT'), aliveT: alive('T'),
      bombStatus: planted ? (round.bomb_defused ? 'defused' : 'planted') : null,
      recentKills,
    })
  }, [onStateChange, round, demoData, time, roundIdx, duration, parsed])
  useEffect(() => { emit() }, [emit])

  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
  }

  if (!round) {
    return (
      <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: 12, color: 'var(--muted)', fontSize: 13 }}>
        No movement data in this demo.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 3D viewport */}
      <div style={{ position: 'relative', width: '100%', height: 500, borderRadius: 12, overflow: 'hidden', background: '#0e1016' }}>
        <MirageScene
          demoData={demoData}
          currentTick={time}
          trajectories={trajectories}
          showZones={showZones}
          selectedSteamId={selected}
          onSelectPlayer={setSelected}
        />
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, fontSize: 11, color: 'var(--muted)', background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 6 }}>
          de_mirage · 3D blockout{selected ? ` · following ${selected}` : ''}
        </div>
        <button
          onClick={() => setShowZones(v => !v)}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, ...btn, fontSize: 11, background: showZones ? 'rgba(96,165,250,0.25)' : 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <Layers size={12} /> {showZones ? 'Hide zones' : 'Calibrate'}
        </button>
      </div>

      {/* Transport */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => setRoundIdx(i => Math.max(0, i - 1))} disabled={roundIdx === 0} title="Previous round"><ChevronLeft size={14} /></button>
        <select
          value={roundIdx}
          onChange={e => setRoundIdx(Number(e.target.value))}
          style={{ ...btn, paddingRight: 8 }}
        >
          {rounds.map((r, i) => <option key={i} value={i}>Round {r.number ?? i + 1}</option>)}
        </select>
        <button style={btn} onClick={() => setRoundIdx(i => Math.min(rounds.length - 1, i + 1))} disabled={roundIdx >= rounds.length - 1} title="Next round"><ChevronRight size={14} /></button>

        <button style={{ ...btn, background: 'var(--accent)', color: '#fff', border: 'none' }} onClick={() => setPlaying(p => !p)}>
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Play'}
        </button>
        <button style={btn} onClick={() => { setTime(0); setPlaying(false) }} title="Restart"><RotateCcw size={13} /></button>

        <input
          type="range" min={0} max={duration} step={0.05} value={time}
          onChange={e => { setPlaying(false); setTime(Number(e.target.value)) }}
          style={{ flex: 1, minWidth: 120, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', width: 78, textAlign: 'right' }}>
          {time.toFixed(1)}s / {duration.toFixed(0)}s
        </span>
        <button style={btn} onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)} title="Playback speed">{speed}×</button>
      </div>
    </div>
  )
}
