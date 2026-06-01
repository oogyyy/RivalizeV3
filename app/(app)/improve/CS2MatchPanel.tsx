'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Loader2, RefreshCw, Upload,
  Key, Copy, Check, ChevronDown, ChevronUp, X, Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sharecode_toSteamUrl } from '@/lib/cs2-sharecode'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedDemo {
  id: string
  status: string
  map: string | null
  match_date: string | null
  parsed_data: {
    header?: { map?: string; score_team1?: number; score_team2?: number }
    opponentSide?: string
  } | null
}

interface CS2Match {
  id: string
  sharecode: string
  match_id: string
  reservation_id: string
  discovered_at: string
  demo_id: string | null
  // GC-sourced fields
  map: string | null
  score_ct: number | null
  score_t: number | null
  match_result: number | null
  match_time: string | null
  demo_url: string | null
  demos: LinkedDemo | null
}

interface ApiResponse {
  configured: boolean
  botMode: boolean
  linked: boolean
  steamId: string | null
  matches: CS2Match[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function mapLabel(raw: string | null | undefined): string {
  if (!raw) return '?'
  return raw.replace(/^de_/, '').replace(/\b\w/g, c => c.toUpperCase())
}

/** Determine W/L/D from a parsed demo. */
function demoResult(demo: LinkedDemo): { result: 'W' | 'L' | 'D' | null; score: string } {
  const h  = demo.parsed_data?.header
  const os = demo.parsed_data?.opponentSide ?? 'team2'
  if (!h || demo.status !== 'completed') return { result: null, score: '' }
  const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
  const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
  const result = ours > theirs ? 'W' : ours === theirs ? 'D' : 'L'
  return { result, score: `${ours}–${theirs}` }
}

/** Summarise score from GC data. match_result: 2 = team1 wins, 3 = team2 wins, 1 = tie */
function gcScore(m: CS2Match): string {
  if (m.score_ct == null && m.score_t == null) return ''
  return `${m.score_ct ?? 0}–${m.score_t ?? 0}`
}

// ── Setup modal (sharecode-chain mode only) ───────────────────────────────────

function SetupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [authToken, setAuthToken] = useState('')
  const [sharecode, setSharecode] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [step, setStep]           = useState<1 | 2>(1)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/cs2/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chain', steamAuthToken: authToken.trim(), seedSharecode: sharecode.trim() }),
      })
      const data = await res.json() as { error?: unknown }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Setup failed')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Connect CS2 Match History</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Discover Premier &amp; Competitive matches automatically</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0', step >= 1 ? 'bg-[#00ffc8] text-black' : 'bg-border text-muted-foreground')}>1</div>
              <p className="text-[12px] font-semibold text-foreground">Get your Steam Game Auth Code</p>
            </div>
            <div className="ml-7 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Go to{' '}
                <a href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128" target="_blank" rel="noopener noreferrer" className="text-[#00ffc8] underline-offset-2 hover:underline">
                  Steam Help → CS2 → I want to see my match history
                </a>
                {' '}and sign in. Copy the auth code shown.
              </p>
              <Input
                placeholder="AAAA-BBBBB-CCCC"
                value={authToken}
                onChange={e => { setAuthToken(e.target.value); if (e.target.value) setStep(2) }}
                className="h-8 text-[12px] font-mono"
              />
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0', step >= 2 ? 'bg-[#00ffc8] text-black' : 'bg-border text-muted-foreground')}>2</div>
              <p className="text-[12px] font-semibold text-foreground">Paste your latest match sharecode</p>
            </div>
            <div className="ml-7 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Open CS2 → <span className="text-foreground font-medium">Watch</span> → <span className="text-foreground font-medium">Your Matches</span> → click the share icon on any match.
              </p>
              <Input
                placeholder="CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                value={sharecode}
                onChange={e => setSharecode(e.target.value)}
                className="h-8 text-[12px] font-mono"
              />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="neon" size="sm" disabled={!authToken.trim() || !sharecode.trim() || saving} onClick={handleSave} className="gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Connecting…</> : <><Key size={12} /> Connect</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Import / grab demo modal ───────────────────────────────────────────────────

function GrabDemoModal({ match, onClose }: { match: CS2Match; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const hasRealSharecode = !match.sharecode.startsWith('gc-')
  const hasDemoUrl = Boolean(match.demo_url)

  function copySharecode() {
    navigator.clipboard.writeText(match.sharecode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">Grab Full Demo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {match.map ? mapLabel(match.map) : 'Unknown map'} · {formatDate(match.match_time ?? match.discovered_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {hasDemoUrl ? (
            /* Auto-download URL found */
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#00ffc8] flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                Demo URL found
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Valve CDN URL located. Click below to queue the demo for automatic download and parsing.
              </p>
              <Button variant="neon" size="sm" className="gap-1.5 w-full" onClick={onClose}>
                <Download size={12} /> Download &amp; Parse Demo
              </Button>
            </div>
          ) : (
            /* Manual download via CS2 client */
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-foreground">Step 1 — Download the demo in CS2</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {hasRealSharecode
                    ? 'Click below to open CS2 and automatically start downloading this demo.'
                    : 'Open CS2 → Watch → Your Matches and find this match to download the demo.'}
                </p>
                {hasRealSharecode && (
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={sharecode_toSteamUrl(match.sharecode)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.3)] text-[#00ffc8] text-[11px] font-medium hover:bg-[rgba(0,255,200,0.15)] transition-colors"
                    >
                      Open in CS2
                    </a>
                    <button
                      onClick={copySharecode}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-muted-foreground text-[11px] hover:text-foreground transition-colors"
                    >
                      {copied ? <Check size={11} className="text-[#00ffc8]" /> : <Copy size={11} />}
                      {copied ? 'Copied!' : 'Copy sharecode'}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-foreground">Step 2 — Upload the .dem file</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  After CS2 downloads it, upload the <span className="font-mono text-[10px]">.dem</span> file here for full stats.
                </p>
                <a
                  href={`/improve?upload=1&matchId=${match.id}`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-muted border border-border text-foreground text-[11px] font-medium hover:bg-muted/80 transition-colors w-fit"
                >
                  <Upload size={11} /> Upload Demo File
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Match row ─────────────────────────────────────────────────────────────────

function MatchRow({ match, onGrab }: { match: CS2Match; onGrab: (m: CS2Match) => void }) {
  const demo   = match.demos
  const parsed = demo ? demoResult(demo) : { result: null, score: '' }

  // Prefer parsed demo result, fall back to GC score display
  const isParsed = demo?.status === 'completed'
  const hasGCData = Boolean(match.map || match.score_ct != null)

  // For the result badge: show parsed result if available, else ? (GC doesn't give user's perspective)
  const badge = isParsed ? parsed.result : null
  const score = isParsed ? parsed.score : gcScore(match)
  const map   = isParsed
    ? mapLabel(demo?.parsed_data?.header?.map ?? demo?.map)
    : mapLabel(match.map)
  const date  = formatDate(match.match_time ?? match.discovered_at)

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      {/* Badge */}
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0',
        badge === 'W' ? 'bg-[rgba(0,255,200,0.12)] text-[#00ffc8]' :
        badge === 'L' ? 'bg-red-500/10 text-red-400' :
        badge === 'D' ? 'bg-yellow-500/10 text-yellow-400' :
        demo?.status === 'processing' || demo?.status === 'queued' ? 'bg-muted/50 text-muted-foreground' :
        'bg-muted/50 text-muted-foreground'
      )}>
        {demo?.status === 'processing' || demo?.status === 'queued'
          ? <Loader2 size={11} className="animate-spin" />
          : badge ?? (hasGCData ? '·' : '?')}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground leading-tight truncate">
          {map !== '?' ? map : <span className="text-muted-foreground">Unknown map</span>}
          {score && (
            <span className={cn(
              'ml-1.5 text-[10px] font-mono',
              badge === 'W' ? 'text-[#00ffc8]' :
              badge === 'L' ? 'text-red-400' :
              badge === 'D' ? 'text-yellow-400' :
              'text-muted-foreground'
            )}>
              {score}
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{date}</p>
      </div>

      {/* Action */}
      {isParsed ? (
        <a href={`/demos/${demo!.id}`} className="shrink-0 text-[10px] text-[#00ffc8] hover:underline">View</a>
      ) : demo?.status === 'queued' || demo?.status === 'processing' ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">Parsing…</span>
      ) : (
        <button
          onClick={() => onGrab(match)}
          className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-foreground bg-muted hover:bg-muted/70 border border-border rounded-md px-2 h-6 transition-colors"
        >
          <Download size={10} /> Grab Demo
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { personalTeamId: string }

export default function CS2MatchPanel({ personalTeamId: _personalTeamId }: Props) {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [newCount, setNewCount] = useState<number | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [grabMatch, setGrabMatch] = useState<CS2Match | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/cs2/matches')
      const json = await res.json() as ApiResponse
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true); setNewCount(null); setSyncError(null)
    try {
      const res  = await fetch('/api/cs2/sync', { method: 'POST' })
      const json = await res.json() as { newMatches: number; error?: string }
      if (!res.ok || json.error) {
        setSyncError(json.error ?? 'Sync failed')
      } else {
        setNewCount(json.newMatches)
        if (json.newMatches > 0) await load()
      }
    } catch {
      setSyncError('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    await fetch('/api/cs2/setup', { method: 'DELETE' })
    await load()
  }

  const visible = showAll ? (data?.matches ?? []) : (data?.matches ?? []).slice(0, 8)
  const isBotMode = data?.botMode ?? false

  // ── Not configured ────────────────────────────────────────────────────────
  if (!loading && data && !data.configured) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2 px-4">
        <p className="text-[12px] text-muted-foreground">CS2 match history requires a Steam API key.</p>
      </div>
    )
  }

  // ── Bot mode but no Steam ID linked ──────────────────────────────────────
  if (!loading && data && !data.linked && isBotMode) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2 px-4">
        <p className="text-[13px] font-semibold text-foreground">Link your Steam account</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[220px]">
          Go to <a href="/settings" className="text-[#00ffc8] underline-offset-2 hover:underline">Settings</a> and link your Steam profile so we can pull your match history.
        </p>
      </div>
    )
  }

  // ── Not linked (chain mode, no auth token yet) ────────────────────────────
  if (!loading && data && !data.linked && !isBotMode) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3 px-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Key size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-1">Connect CS2 Match History</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[220px]">
              Discover Premier &amp; Competitive matches automatically.
            </p>
          </div>
          <Button variant="neon" size="sm" onClick={() => setShowSetup(true)} className="gap-1.5 mt-1">
            <Key size={12} /> Connect CS2
          </Button>
        </div>
        {showSetup && (
          <SetupModal onClose={() => setShowSetup(false)} onDone={() => { setShowSetup(false); load() }} />
        )}
      </>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2">
        <Loader2 size={15} className="animate-spin text-muted-foreground" />
        <span className="text-[12px] text-muted-foreground">Loading…</span>
      </div>
    )
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/30">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {data?.matches.length ?? 0} matches
          </span>
          {isBotMode && (
            <span className="text-[9px] bg-[rgba(0,255,200,0.1)] text-[#00ffc8] border border-[rgba(0,255,200,0.2)] rounded px-1 py-0.5 font-medium">
              Auto
            </span>
          )}
          {newCount !== null && newCount > 0 && (
            <span className="text-[10px] text-[#00ffc8]">+{newCount} new</span>
          )}
          {newCount === 0 && !syncError && (
            <span className="text-[10px] text-muted-foreground/50">· up to date</span>
          )}
          {syncError && (
            <span className="text-[10px] text-red-400 truncate max-w-[160px]" title={syncError}>· {syncError}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={sync}
            disabled={syncing}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={10} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          {!isBotMode && (
            <>
              <span className="text-border">·</span>
              <button onClick={disconnect} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Match list */}
      <div className="p-3 space-y-1.5">
        {(data?.matches.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
            <p className="text-[12px] font-medium text-foreground">No matches yet</p>
            <p className="text-[11px] text-muted-foreground">
              {isBotMode ? 'Click Sync to pull your recent matches.' : 'Play a match or sync to discover history.'}
            </p>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={sync} disabled={syncing}>
              <RefreshCw size={11} className={cn(syncing && 'animate-spin')} /> Sync Now
            </Button>
          </div>
        ) : (
          <>
            {visible.map(m => (
              <MatchRow key={m.id} match={m} onGrab={setGrabMatch} />
            ))}
            {(data?.matches.length ?? 0) > 8 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-1"
              >
                {showAll
                  ? <><ChevronUp size={11} /> Show less</>
                  : <><ChevronDown size={11} /> Show all {data?.matches.length}</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showSetup && (
        <SetupModal onClose={() => setShowSetup(false)} onDone={() => { setShowSetup(false); load() }} />
      )}
      {grabMatch && (
        <GrabDemoModal match={grabMatch} onClose={() => setGrabMatch(null)} />
      )}
    </>
  )
}
