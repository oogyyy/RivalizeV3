import type { Round } from '@/types/database'

export interface RoundFeature {
  roundNumber: number
  equipValue: number       // max(team1_economy, team2_economy)
  hasPlant: boolean
  killCount: number
  grenadeCount: number
  firstKillTime: number
}

export interface Routine {
  id: number
  name: string
  description: string
  color: string
  rounds: number[]
  avgKills: number
  plantRate: number
  avgFirstKillTime: number
}

// ─── Feature extraction ───────────────────────────────────────────────────────

export function extractFeatures(rounds: Round[]): RoundFeature[] {
  return rounds.map(r => {
    const kills = r.kills ?? []
    const sortedKills = [...kills].sort((a, b) => a.time - b.time)
    const firstKillTime = sortedKills[0]?.time ?? 90

    return {
      roundNumber: r.number ?? 0,
      equipValue: Math.max(r.team1_economy ?? 0, r.team2_economy ?? 0),
      hasPlant: r.bomb_planted ?? false,
      killCount: kills.length,
      grenadeCount: (r.grenades ?? []).length,
      firstKillTime,
    }
  })
}

// ─── K-means (k=4) ────────────────────────────────────────────────────────────

function toVec(f: RoundFeature): number[] {
  return [
    Math.min(1, f.equipValue / 8000),      // buy level
    f.hasPlant ? 1 : 0,                    // bomb plant
    Math.min(1, f.killCount / 10),         // kill pace
    Math.min(1, f.grenadeCount / 8),       // nade usage
    Math.min(1, f.firstKillTime / 90),     // early vs late first blood
  ]
}

function dist(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))
}

function centroid(vecs: number[][]): number[] {
  if (vecs.length === 0) return Array(5).fill(0)
  return vecs[0].map((_, i) => vecs.reduce((s, v) => s + v[i], 0) / vecs.length)
}

function kmeans(features: RoundFeature[], k = 4, iters = 30): number[] {
  const vecs = features.map(toVec)
  if (vecs.length < k) return vecs.map((_, i) => i % k)

  let centers = Array.from({ length: k }, (_, i) => vecs[Math.floor((i / k) * vecs.length)])
  let labels = Array(vecs.length).fill(0)

  for (let iter = 0; iter < iters; iter++) {
    const newLabels = vecs.map(v => {
      let best = 0, bestD = Infinity
      centers.forEach((c, ci) => { const d = dist(v, c); if (d < bestD) { bestD = d; best = ci } })
      return best
    })
    if (newLabels.every((l, i) => l === labels[i])) break
    labels = newLabels
    centers = Array.from({ length: k }, (_, ci) =>
      centroid(vecs.filter((_, i) => labels[i] === ci)),
    )
  }
  return labels
}

// ─── Routine naming ───────────────────────────────────────────────────────────

const ROUTINE_DEFS = [
  { name: 'Aggressive Rush',  description: 'Fast pace, early first blood, high kill tempo',            color: '#ff4466' },
  { name: 'Default Setup',    description: 'Utility-heavy, mid-round reads, full buy',                 color: '#2DE3CE' },
  { name: 'Eco / Force Buy',  description: 'Low equipment value — pistol rounds or force buys',        color: '#facc15' },
  { name: 'Slow Grind',       description: 'Late first contact, passive map control, bomb plants',     color: '#818cf8' },
]

function pickName(center: number[]): number {
  const [buyLevel, hasPlant, killPace, , firstKillNorm] = center
  if (buyLevel < 0.3) return 2                           // eco
  if (firstKillNorm < 0.25 && killPace > 0.4) return 0  // rush
  if (firstKillNorm > 0.55 || hasPlant > 0.5) return 3  // slow/plant
  return 1                                               // default
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function detectRoutines(rounds: Round[]): Routine[] {
  const features = extractFeatures(rounds)
  if (features.length === 0) return []

  const k = Math.min(4, features.length)
  const labels = kmeans(features, k)

  const vecs = features.map(toVec)
  const clusterVecs: number[][][] = Array.from({ length: k }, () => [])
  labels.forEach((l, i) => clusterVecs[l].push(vecs[i]))
  const centers = clusterVecs.map(cv => centroid(cv))

  return Array.from({ length: k }, (_, ci) => {
    const memberFeatures = features.filter((_, i) => labels[i] === ci)
    if (memberFeatures.length === 0) return null
    const avgKills = memberFeatures.reduce((s, f) => s + f.killCount, 0) / memberFeatures.length
    const plantRate = memberFeatures.filter(f => f.hasPlant).length / memberFeatures.length
    const avgFirstKill = memberFeatures.reduce((s, f) => s + f.firstKillTime, 0) / memberFeatures.length
    const defIdx = pickName(centers[ci])
    const def = ROUTINE_DEFS[defIdx]
    return {
      id: ci,
      name: def.name,
      description: def.description,
      color: def.color,
      rounds: memberFeatures.map(f => f.roundNumber),
      avgKills: Math.round(avgKills * 10) / 10,
      plantRate: Math.round(plantRate * 100),
      avgFirstKillTime: Math.round(avgFirstKill),
    } satisfies Routine
  }).filter(Boolean) as Routine[]
}
