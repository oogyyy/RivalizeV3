'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Trophy, Loader2, RefreshCw, ExternalLink, Upload,
  Key, Copy, Check, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sharecode_toSteamUrl } from '@/lib/cs2-sharecode'

// ── Types ────────────────────────────────────────────────────────────────────

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
  demos: LinkedDemo | null
}

interface ApiResponse {
  configured: boolean
  linked: boolean
  steamId: string | null
  matches: CS2Match[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function mapLabel(raw: string | null | undefined): string {
  if (!raw) return '?'
  return raw.replace(/^de_/, '').replace(/\b\w/g, c => c.toUpperCase())
}

function getResult(demo: LinkedDemo): { result: 'W' | 'L' | 'D' | null; score: string } {
  const h  = demo.parsed_data?.header
  const os = demo.parsed_data?.opponentSide ?? 'team2'
  if (!h || demo.status !== 'completed') return { result: null, score: '' }
  const ours   = os === 'team1' ? (h.score_team2 ?? 0) : (h.score_team1 ?? 0)
  const theirs = os === 'team1' ? (h.score_team1 ?? 0) : (h.score_team2 ?? 0)
  const result = ours > theirs ? 'W' : ours === theirs ? 'D' : 'L'
  return { result, score: `${ours}–${theirs}` }
}

// ── Setup modal ──────────────────────────────────────────────────────────────

function SetupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [authToken, setAuthToken]       = useState('')
  const [sharecode, setSharecode]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [step, setStep]                 = useState<1 | 2>(1)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/cs2/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamAuthToken: authToken.trim(), seedSharecode: sharecode.trim() }),
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

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Connect CS2 Match History</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Discover your Premier &amp; Competitive matches automatically
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Step 1 — Auth token */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                step >= 1 ? 'bg-[#00ffc8] text-black' : 'bg-border text-muted-foreground'
              )}>1</div>
              <p className="text-[12px] font-semibold text-foreground">Get your Steam Game Auth Code</p>
            </div>
            <div className="ml-7 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Go to{' '}
                <a
                  href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00ffc8] underline-offset-2 hover:underline"
                >
                  Steam Help → CS2 → I want to see my match history
                </a>
                {' '}and sign in. Steam will display your auth code — paste it below.
              </p>
              <Input
                placeholder="AAAA-BBBBB-CCCC"
                value={authToken}
                onChange={e => { setAuthToken(e.target.value); if (e.target.value) setStep(2) }}
                className="h-8 text-[12px] font-mono"
              />
            </div>
          </div>

          {/* Step 2 — Seed sharecode */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                step >= 2 ? 'bg-[#00ffc8] text-black' : 'bg-border text-muted-foreground'
              )}>2</div>
              <p className="text-[12px] font-semibold text-foreground">Paste your latest match sharecode</p>
            </div>
            <div className="ml-7 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Open CS2 → <span className="text-foreground font-medium">Watch</span> →{' '}
                <span className="text-foreground font-medium">Your Matches</span> → click the share icon on
                any recent match to copy its sharecode.
              </p>
              <Input
                placeholder="CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                value={sharecode}
                onChange={e => setSharecode(e.target.value)}
                className="h-8 text-[12px] font-mono"
              />
              <p className="text-[10px] text-muted-foreground/60">
                New matches played after this point will be discovered automatically on sync.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="neon"
            size="sm"
            disabled={!authToken.trim() || !sharecode.trim() || saving}
            onClick={handleSave}
            className="gap-1.5"
          >
            {saving ? <><Loader2 size={12} className="animate-spin" /> Connecting…</> : <><Key size={12} /> Connect</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Import instructions modal ────────────────────────────────────────────────

function ImportModal({
  match,
  personalTeamId,
  onClose,
  onUploaded,
}: {
  match: CS2Match
  personalTeamId: string
  onClose: () => void
  onUploaded: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copySharecode() {
    navigator.clipboard.writeText(match.sharecode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steamUrl = sharecode_toSteamUrl(match.sharecode)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-[14px] font-bold text-foreground">Import Demo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Discovered {formatDate(match.discovered_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1 - Open in CS2 */}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-foreground">Step 1 — Download the demo in CS2</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Click below to open CS2 and automatically start downloading this demo.
              CS2 saves demos to your{' '}
              <span className="text-foreground font-mono text-[10px]">csgo/replays/</span> folder.
            </p>
            <div className="flex gap-2">
              <a
                href={steamUrl}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-[rgba(0,255,200,0.1)] border border-[rgba(0,255,200,0.3)] text-[#00ffc8] text-[11px] font-medium hover:bg-[rgba(0,255,200,0.15)] transition-colors"
              >
                <ExternalLink size={11} /> Open in CS2
              </a>
              <button
                onClick={copySharecode}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-muted-foreground text-[11px] hover:text-foreground hover:border-border/80 transition-colors"
              >
                {copied ? <Check size={11} className="text-[#00ffc8]" /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy sharecode'}
              </button>
            </div>
          </div>

          {/* Sharecode display */}
          <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
            {match.sharecode}
          </div>

          {/* Step 2 - Upload */}
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-foreground">Step 2 — Upload the .dem file</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Once CS2 has finished downloading, find the <span className="text-foreground font-mono text-[10px]">.dem</span> file
              and upload it here to parse your stats (map, score, K/D, ADR).
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
      </div>
    </div>
  )
}

// ── Match row ────────────────────────────────────────────────────────────────

function MatchRow({
  match,
  personalTeamId,
  onImport,
}: {
  match: CS2Match
  personalTeamId: string
  onImport: (m: CS2Match) => void
}) {
  const demo   = match.demos
  const parsed = demo ? getResult(demo) : { result: null, score: '' }
  const map    = demo?.parsed_data?.header?.map ?? demo?.map ?? null
  const isParsed = demo?.status === 'completed'
  const isPending = demo && demo.status !== 'completed'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      {/* Result badge */}
      <div className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0',
        parsed.result === 'W' ? 'bg-[rgba(0,255,200,0.12)] text-[#00ffc8]' :
        parsed.result === 'L' ? 'bg-red-500/10 text-red-400' :
        parsed.result === 'D' ? 'bg-yellow-500/10 text-yellow-400' :
        'bg-muted/50 text-muted-foreground'
      )}>
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : parsed.result ?? '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground leading-tight">
          {isParsed ? mapLabel(map) : (
            <span className="text-muted-foreground">Not imported yet</span>
          )}
          {parsed.score && (
            <span className={cn(
              'ml-1.5 text-[10px] font-mono',
              parsed.result === 'W' ? 'text-[#00ffc8]' :
              parsed.result === 'L' ? 'text-red-400' : 'text-yellow-400'
            )}>
              {parsed.score}
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDate(match.discovered_at)}
        </p>
      </div>

      {/* Action */}
      {isParsed ? (
        <a
          href={`/demos/${demo!.id}`}
          className="shrink-0 text-[10px] text-[#00ffc8] hover:underline"
        >
          View
        </a>
      ) : isPending ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">Parsing…</span>
      ) : (
        <button
          onClick={() => onImport(match)}
          className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-foreground bg-muted hover:bg-muted/70 border border-border rounded-md px-2 h-6 transition-colors"
        >
          <Upload size={10} /> Grab Demo
        </button>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  personalTeamId: string
}

export default function CS2MatchPanel({ personalTeamId }: Props) {
  const [data, setData]           = useState<ApiResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [newCount, setNewCount]   = useState<number | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [importMatch, setImportMatch] = useState<CS2Match | null>(null)
  const [showAll, setShowAll]     = useState(false)

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
    setSyncing(true)
    setNewCount(null)
    try {
      const res  = await fetch('/api/cs2/sync', { method: 'POST' })
      const json = await res.json() as { newMatches: number }
      setNewCount(json.newMatches)
      if (json.newMatches > 0) await load()
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    await fetch('/api/cs2/setup', { method: 'DELETE' })
    await load()
  }

  const visible = showAll ? (data?.matches ?? []) : (data?.matches ?? []).slice(0, 8)

  // ── Not set up ──
  if (!loading && data && !data.linked) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Trophy size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-1">Connect CS2 Match History</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[220px]">
              Discover your Premier &amp; Competitive matches and grab demos with one click.
            </p>
          </div>
          <Button variant="neon" size="sm" onClick={() => setShowSetup(true)} className="gap-1.5 mt-1">
            <Key size={12} /> Connect CS2
          </Button>
        </div>
        {showSetup && (
          <SetupModal
            onClose={() => setShowSetup(false)}
            onDone={() => { setShowSetup(false); load() }}
          />
        )}
      </>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2">
        <Loader2 size={15} className="animate-spin text-muted-foreground" />
        <span className="text-[12px] text-muted-foreground">Loading matches…</span>
      </div>
    )
  }

  // ── Connected ──
  return (
    <>
      {/* Sub-header with sync controls */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/30">
        <span className="text-[10px] text-muted-foreground">
          {data?.matches.length ?? 0} discovered
          {newCount !== null && newCount > 0 && (
            <span className="ml-1.5 text-[#00ffc8]">+{newCount} new</span>
          )}
          {newCount === 0 && (
            <span className="ml-1.5 text-muted-foreground/50">· up to date</span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={sync}
            disabled={syncing}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={10} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <span className="text-border">·</span>
          <button
            onClick={disconnect}
            className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Match list */}
      <div className="p-3 space-y-1.5">
        {data?.matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
            <p className="text-[12px] font-medium text-foreground">No matches discovered yet</p>
            <p className="text-[11px] text-muted-foreground">
              Play a match then click Sync, or provide an older seed sharecode to see history.
            </p>
            <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={sync} disabled={syncing}>
              <RefreshCw size={11} className={cn(syncing && 'animate-spin')} /> Sync Now
            </Button>
          </div>
        ) : (
          <>
            {visible.map(m => (
              <MatchRow
                key={m.id}
                match={m}
                personalTeamId={personalTeamId}
                onImport={setImportMatch}
              />
            ))}
            {(data?.matches.length ?? 0) > 8 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-1"
              >
                {showAll ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show all {data?.matches.length}</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showSetup && (
        <SetupModal
          onClose={() => setShowSetup(false)}
          onDone={() => { setShowSetup(false); load() }}
        />
      )}
      {importMatch && (
        <ImportModal
          match={importMatch}
          personalTeamId={personalTeamId}
          onClose={() => setImportMatch(null)}
          onUploaded={() => { setImportMatch(null); load() }}
        />
      )}
    </>
  )
}
