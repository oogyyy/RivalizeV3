'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle,
  Info, RefreshCw, Users, Shield,
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024 // 300 MB
const MAX_FILE_SIZE        = 500 * 1024 * 1024 // 500 MB
const MAX_POLL_ATTEMPTS    = 40  // 40 × 3 s = 2 min timeout

interface DemoUploadButtonProps {
  teamId: string
  /** Controls upload context and data isolation.
   *  'opponent' (default) → Opponents / scouting flow.
   *  'self' → My Team / self-analysis flow. */
  demoType?: 'opponent' | 'self'
  onSuccess?: () => void
}

type UploadStatus = 'pending' | 'presigning' | 'uploading' | 'registering' | 'done' | 'error'

interface FileUpload {
  file: File
  progress: number
  status: UploadStatus
  error?: string
  demoId?: string
}

// Team data extracted from parsed demo — shown in the post-parse selection step.
interface ParsedTeamInfo {
  team1: { name: string; players: string[]; score: number; startSide: 'T' | 'CT' }
  team2: { name: string; players: string[]; score: number; startSide: 'T' | 'CT' }
  map: string
}

// Phase progression for self-demo post-upload team selection:
//   idle → polling → selecting → saving → confirmed
type PostUploadPhase = 'idle' | 'polling' | 'selecting' | 'saving' | 'confirmed'

function isValidDemoFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.dem') || lower.endsWith('.zst')
}

function uploadToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`R2 upload failed: HTTP ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
    xhr.send(file)
  })
}

export default function DemoUploadButton({ teamId, demoType = 'opponent', onSuccess }: DemoUploadButtonProps) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [uploads, setUploads]         = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [opponentName, setOpponentName] = useState('')

  // Post-upload team selection state (self-demos only)
  const [postUploadPhase, setPostUploadPhase]   = useState<PostUploadPhase>('idle')
  const [parsedTeamInfo, setParsedTeamInfo]     = useState<ParsedTeamInfo | null>(null)
  // 'team2' default: CT-Side is typically the user's team in GOTV recordings
  const [userTeamChoice, setUserTeamChoice]     = useState<'team1' | 'team2'>('team2')
  const pollTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollCountRef  = useRef(0)
  const doneIdsRef    = useRef<string[]>([])  // demo IDs that were uploaded successfully

  const updateUpload = useCallback(
    (index: number, update: Partial<FileUpload>) =>
      setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u))),
    []
  )

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const valid    = acceptedFiles.filter(f => isValidDemoFile(f.name) && f.size <= MAX_FILE_SIZE)
    const oversized = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE)
    setUploads(prev => [
      ...prev,
      ...valid.map(file => ({ file, progress: 0, status: 'pending' as const })),
      ...oversized.map(file => ({
        file, progress: 0, status: 'error' as const,
        error: `File exceeds 500 MB limit (${formatFileSize(file.size)})`,
      })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dem', '.zst'] },
    multiple: true,
  })

  const removeFile  = (index: number) => setUploads(prev => prev.filter((_, i) => i !== index))
  const retryFailed = () =>
    setUploads(prev =>
      prev.map(u => u.status === 'error' ? { ...u, status: 'pending', progress: 0, error: undefined } : u)
    )

  // ── Polling helpers ─────────────────────────────────────────────────────────

  const FALLBACK_TEAMS: ParsedTeamInfo = {
    team1: { name: 'Team 1 (T-Side)',  players: [], score: 0, startSide: 'T' },
    team2: { name: 'Team 2 (CT-Side)', players: [], score: 0, startSide: 'CT' },
    map: '',
  }

  const startPolling = useCallback((firstDemoId: string) => {
    setPostUploadPhase('polling')
    pollCountRef.current = 0

    const poll = async () => {
      pollCountRef.current++

      if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
        // Timed out — fall back to generic names so the user can still pick a side
        setParsedTeamInfo(FALLBACK_TEAMS)
        setPostUploadPhase('selecting')
        return
      }

      try {
        const res = await fetch(`/api/demos/${firstDemoId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (data.status === 'completed' && data.parsed_data?.header) {
          const h  = data.parsed_data.header
          const ps = (data.parsed_data.players ?? []) as Array<{
            name: string; team: string; rating: number
          }>

          const t1Players = ps
            .filter(p => p.team === h.team1)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 4)
            .map(p => p.name)

          const t2Players = ps
            .filter(p => p.team === h.team2)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 4)
            .map(p => p.name)

          setParsedTeamInfo({
            team1: {
              name:      h.team1 || 'Team 1 (T-Side)',
              players:   t1Players,
              score:     h.score_team1 ?? 0,
              startSide: 'T',
            },
            team2: {
              name:      h.team2 || 'Team 2 (CT-Side)',
              players:   t2Players,
              score:     h.score_team2 ?? 0,
              startSide: 'CT',
            },
            map: h.map || '',
          })
          setPostUploadPhase('selecting')
        } else if (data.status === 'failed') {
          setParsedTeamInfo(FALLBACK_TEAMS)
          setPostUploadPhase('selecting')
        } else {
          // Still processing — schedule next poll
          pollTimerRef.current = setTimeout(poll, 3000)
        }
      } catch {
        pollTimerRef.current = setTimeout(poll, 3000)
      }
    }

    poll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Saves the user's team choice by PATCHing all uploaded demos
  const saveTeamSelection = async () => {
    setPostUploadPhase('saving')

    // user chose 'team1' (T-Side) → opponent is team2 (CT-Side), so opponentSide = 'team2'
    // user chose 'team2' (CT-Side) → opponent is team1 (T-Side), so opponentSide = 'team1'
    const opponentSide: 'team1' | 'team2' = userTeamChoice === 'team1' ? 'team2' : 'team1'

    await Promise.all(
      doneIdsRef.current.map(id =>
        fetch(`/api/demos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opponentSide }),
        })
      )
    )

    setPostUploadPhase('confirmed')
    onSuccess?.()
    router.refresh()
  }

  // ── Upload logic ─────────────────────────────────────────────────────────────

  const uploadOne = async (i: number, file: File): Promise<string | null> => {
    try {
      updateUpload(i, { status: 'presigning', progress: 2 })

      const presignRes = await fetch('/api/demos/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, filename: file.name, fileSize: file.size }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Presign failed (${presignRes.status})`)
      }
      const { key, uploadUrl } = await presignRes.json()

      updateUpload(i, { status: 'uploading', progress: 5 })
      await uploadToR2(uploadUrl, file, pct => {
        updateUpload(i, { progress: 5 + Math.round(pct * 0.83) })
      })

      updateUpload(i, { progress: 90, status: 'registering' })

      const registerRes = await fetch('/api/demos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          r2Key: key,
          opponentName: opponentName.trim(),
          map: 'unknown',
          fileSize: file.size,
          demoType,
          // Self-demos: default opponentSide = 'team1' (user is CT-Side/team2).
          // The real choice is captured after parsing in the team-selection step.
          ...(demoType === 'self' && { opponentSide: 'team1' }),
        }),
      })
      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Register failed (${registerRes.status})`)
      }

      const demo = await registerRes.json()
      updateUpload(i, { status: 'done', progress: 100, demoId: demo.id })
      return demo.id as string
    } catch (err) {
      updateUpload(i, {
        status: 'error', progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed',
      })
      return null
    }
  }

  const uploadAll = async () => {
    if (!opponentName.trim()) return
    setIsProcessing(true)

    const pending = uploads
      .map((u, i) => ({ file: u.file, index: i, status: u.status }))
      .filter(u => u.status === 'pending')

    const successIds: string[] = []
    for (const { file, index } of pending) {
      const demoId = await uploadOne(index, file)
      if (demoId) successIds.push(demoId)
    }

    setIsProcessing(false)

    if (successIds.length > 0) {
      doneIdsRef.current = successIds
      if (demoType === 'self') {
        // Start polling the first uploaded demo to get real team names
        startPolling(successIds[0])
      } else {
        onSuccess?.()
        router.refresh()
      }
    }
  }

  const handleClose = () => {
    if (isProcessing || postUploadPhase === 'saving') return
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setOpen(false)
    setUploads([])
    setOpponentName('')
    setPostUploadPhase('idle')
    setParsedTeamInfo(null)
    setUserTeamChoice('team2')
    doneIdsRef.current = []
    pollCountRef.current = 0
  }

  // ── Derived display values ───────────────────────────────────────────────────

  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const errorCount   = uploads.filter(u => u.status === 'error').length
  const doneCount    = uploads.filter(u => u.status === 'done').length
  const canUpload    = pendingCount > 0 && opponentName.trim().length > 0
  const hasLargeFile = uploads.some(
    u => u.file.size > LARGE_FILE_THRESHOLD && (u.status === 'pending' || u.status === 'uploading')
  )

  const statusLabel = (u: FileUpload) => {
    switch (u.status) {
      case 'presigning':  return 'Preparing…'
      case 'uploading':   return `Uploading… ${u.progress > 5 ? `${u.progress - 5}%` : ''}`
      case 'registering': return 'Saving…'
      case 'done':        return 'Done'
      case 'error':       return u.error ?? 'Failed'
      default:            return 'Ready'
    }
  }

  const modalTitle = () => {
    if (postUploadPhase === 'polling')   return 'Analysing Demo…'
    if (postUploadPhase === 'selecting') return 'Which Team Is Yours?'
    if (postUploadPhase === 'saving')    return 'Saving Selection…'
    if (postUploadPhase === 'confirmed') return 'All Done!'
    return demoType === 'self' ? 'Upload My Team Demo' : 'Upload Opponent Demo'
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <Button variant="neon" onClick={() => setOpen(true)} className="gap-2">
        <Upload size={16} />
        Upload Demo
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">{modalTitle()}</h2>
            {postUploadPhase === 'idle' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                .dem / .zst files · up to 500 MB per file
              </p>
            )}
            {postUploadPhase === 'polling' && parsedTeamInfo === null && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Extracting team names and player data…
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing || postUploadPhase === 'saving'}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Post-parse views (self-demos only) ───────────────────────── */}

        {postUploadPhase === 'polling' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
              <Loader2 size={24} className="text-neon-green animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Parsing your demo</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                We&apos;re extracting team names and player stats. This usually takes 30–60 seconds for large demos.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        {postUploadPhase === 'selecting' && parsedTeamInfo && (
          <div className="p-5 space-y-5">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                We found two teams in this demo
                {parsedTeamInfo.map ? ` on ${parsedTeamInfo.map}` : ''}.
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users size={11} className="shrink-0 text-neon-green" />
                Select the team you were <span className="font-medium text-foreground mx-0.5">playing as</span> so we show only your stats.
              </p>
            </div>

            <div className="space-y-3">
              {(['team1', 'team2'] as const).map(side => {
                const t    = parsedTeamInfo[side]
                const isSelected = userTeamChoice === side
                const isSuggested = side === 'team2'  // CT-Side is the typical GOTV default

                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setUserTeamChoice(side)}
                    className={cn(
                      'w-full text-left rounded-xl border-2 p-4 transition-all',
                      isSelected
                        ? 'border-[#00ff87] bg-[#00ff87]/5'
                        : 'border-border bg-background/50 hover:border-[#00ff87]/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Shield
                            size={13}
                            className={isSelected ? 'text-[#00ff87]' : 'text-muted-foreground'}
                          />
                          <span className={cn(
                            'text-sm font-bold truncate',
                            isSelected ? 'text-[#00ff87]' : 'text-foreground'
                          )}>
                            {t.name}
                          </span>
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0',
                            t.startSide === 'T'
                              ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
                              : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
                          )}>
                            {t.startSide === 'T' ? 'T-Side start' : 'CT-Side start'}
                          </span>
                          {isSuggested && !isSelected && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 shrink-0">
                              Suggested
                            </span>
                          )}
                        </div>

                        {t.players.length > 0 ? (
                          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                            {t.players.join(' · ')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                            Player names available after analysis
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={cn(
                          'text-lg font-bold font-mono',
                          isSelected ? 'text-[#00ff87]' : 'text-foreground'
                        )}>
                          {t.score}
                        </p>
                        <p className="text-[10px] text-muted-foreground">rounds won</p>
                        {isSelected && (
                          <CheckCircle2 size={14} className="text-[#00ff87] mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info size={10} className="shrink-0" />
              Not sure? The CT-Side starter is suggested as a common GOTV default. You can always change this on the My Team page.
            </p>

            <div className="flex justify-end pt-1 border-t border-border">
              <Button
                variant="neon"
                size="sm"
                onClick={saveTeamSelection}
                className="gap-2"
              >
                <CheckCircle2 size={14} />
                Save &amp; Close
              </Button>
            </div>
          </div>
        )}

        {(postUploadPhase === 'saving') && (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="text-neon-green animate-spin" />
            <p className="text-sm text-muted-foreground">Saving your team selection…</p>
          </div>
        )}

        {postUploadPhase === 'confirmed' && (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-neon-green" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Team saved successfully</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your stats will now reflect only your team&apos;s players. You can adjust the selection from the demo row on the My Team page.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}

        {/* ── Normal upload flow (shown when postUploadPhase === 'idle') ─── */}

        {postUploadPhase === 'idle' && (
          <div className="p-5 space-y-5">
            {/* Step 1 — Opponent / match context */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 rounded px-1.5 py-0.5">
                  STEP 1
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {demoType === 'self' ? 'Who was your opponent?' : 'Who are you scouting?'}
                </span>
              </div>
              <input
                type="text"
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
                placeholder="e.g. NAVI, Astralis, Team Liquid…"
                disabled={isProcessing}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#00ff87] disabled:opacity-50"
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info size={10} className="shrink-0" />
                {demoType === 'self'
                  ? "This demo will be analysed as your own team's performance — it won't appear in Opponent folders."
                  : "After upload, you'll select which team to scout as the opponent."}
              </p>
            </div>

            {/* Step 2 — Files */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 rounded px-1.5 py-0.5">
                  STEP 2
                </span>
                <span className="text-xs font-semibold text-foreground">Add demo files</span>
              </div>

              {hasLargeFile && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                  <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-yellow-300">
                    CS2 demos are typically 200–500 MB. Large files upload directly to cloud storage — keep this tab open.
                  </p>
                </div>
              )}

              {demoType === 'self' && (
                <div className="flex items-start gap-2 rounded-md border border-neon-green/20 bg-neon-green/5 px-3 py-2">
                  <Users size={12} className="text-neon-green shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neon-green/80">
                    After upload, we&apos;ll extract the real team names and let you pick which side was yours.
                  </p>
                </div>
              )}

              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-7 text-center cursor-pointer transition-all duration-200',
                  isDragActive
                    ? 'border-[#00ff87] bg-[#00ff87]/5'
                    : 'border-border hover:border-[#00ff87]/50 hover:bg-accent/30'
                )}
              >
                <input {...getInputProps()} />
                <Upload
                  size={26}
                  className={cn('mx-auto mb-2.5 transition-colors', isDragActive ? 'text-[#00ff87]' : 'text-muted-foreground')}
                />
                {isDragActive ? (
                  <p className="text-sm font-medium text-[#00ff87]">Drop .dem files here…</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Drag & drop demo files here</p>
                    <p className="text-xs text-muted-foreground mt-1">.dem or .zst · up to 500 MB · click to browse</p>
                  </>
                )}
              </div>

              {uploads.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {uploads.map((upload, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-3 rounded-md border bg-background/50 px-3 py-2',
                        upload.status === 'error' ? 'border-red-500/40' : 'border-border'
                      )}
                    >
                      <FileVideo
                        size={16}
                        className={cn(
                          'shrink-0',
                          upload.status === 'done'  ? 'text-[#00ff87]'
                          : upload.status === 'error' ? 'text-red-400'
                          : 'text-muted-foreground'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{upload.file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatFileSize(upload.file.size)}
                          </span>
                          {upload.status === 'uploading' || upload.status === 'presigning' || upload.status === 'registering' ? (
                            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#00ff87] rounded-full transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                          ) : (
                            <span className={cn(
                              'text-[10px] font-medium truncate',
                              upload.status === 'done'  ? 'text-[#00ff87]'
                              : upload.status === 'error' ? 'text-red-400'
                              : 'text-muted-foreground'
                            )}>
                              {statusLabel(upload)}
                            </span>
                          )}
                        </div>
                        {(upload.status === 'uploading' || upload.status === 'presigning') && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{statusLabel(upload)}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {upload.status === 'done'    ? <CheckCircle2 size={14} className="text-[#00ff87]" />
                        : upload.status === 'error'  ? <AlertCircle  size={14} className="text-red-400" />
                        : upload.status !== 'pending' ? <Loader2     size={14} className="text-[#00ff87] animate-spin" />
                        : (
                          <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {uploads.length === 0
                  ? 'No files selected'
                  : doneCount > 0 && errorCount === 0
                  ? `${doneCount}/${uploads.length} uploaded`
                  : doneCount > 0
                  ? `${doneCount} done · ${errorCount} failed`
                  : `${uploads.length} file${uploads.length !== 1 ? 's' : ''} selected`}
              </span>
              <div className="flex gap-2">
                {errorCount > 0 && !isProcessing && (
                  <Button variant="outline" size="sm" onClick={retryFailed} className="gap-1.5">
                    <RefreshCw size={12} />
                    Retry {errorCount} failed
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isProcessing}
                >
                  {doneCount > 0 && pendingCount === 0 && errorCount === 0 ? 'Close' : 'Cancel'}
                </Button>
                {pendingCount > 0 && (
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={uploadAll}
                    disabled={isProcessing || !canUpload}
                    className="gap-2"
                    title={!opponentName.trim() ? 'Enter opponent name first' : undefined}
                  >
                    {isProcessing ? (
                      <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload size={14} /> Upload {pendingCount > 1 ? `${pendingCount} files` : 'demo'}</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
