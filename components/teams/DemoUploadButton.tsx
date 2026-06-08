'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Upload, Plus, X, FileVideo, Loader2, CheckCircle2, AlertCircle, Info, RefreshCw,
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024
const MAX_FILE_SIZE        = 500 * 1024 * 1024

interface DemoUploadButtonProps {
  teamId: string
  /** 'opponent' (default) → Opponents / scouting. 'self' → My Team analysis. */
  demoType?: 'opponent' | 'self'
  /** Override the trigger button label. Defaults to 'Upload Demo'. */
  label?: string
  onSuccess?: () => void
}

// 'queued'  = uploaded + parse kicked off in background
// 'adopted' = another team had this file already parsed; added instantly
type UploadStatus = 'pending' | 'presigning' | 'uploading' | 'registering' | 'queued' | 'adopted' | 'error'

interface FileUpload {
  file: File
  progress: number
  status: UploadStatus
  error?: string
  demoId?: string
}

function isValidDemoFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.dem') || lower.endsWith('.zst')
}

// Compute SHA-256 of the file bytes using the browser's native Web Crypto API.
// Called as soon as the file is dropped so the hash is usually ready before the
// user clicks Upload. Returns empty string on failure so the upload still proceeds.
async function hashFile(file: File): Promise<string> {
  try {
    const buf    = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return ''
  }
}

// 9 MB chunks — safely under Railway's ~10 MB reverse-proxy body limit.
// R2 multipart upload requires parts ≥ 5 MB except the last one, so 9 MB works.
const CHUNK_SIZE = 9 * 1024 * 1024

async function uploadViaServer(
  file: File,
  params: { teamId: string; opponentName: string; demoType: string; fileHash?: string },
  onProgress: (pct: number) => void,
): Promise<{ id: string; _adopted?: boolean }> {
  const base = new URL('/api/demos/upload', window.location.origin)
  const common = new URLSearchParams({
    teamId:       params.teamId,
    filename:     file.name,
    opponentName: params.opponentName,
    demoType:     params.demoType,
  })

  // 1 — init multipart upload
  const initUrl = new URL(base)
  initUrl.searchParams.set('action', 'init')
  common.forEach((v, k) => initUrl.searchParams.set(k, v))
  if (params.fileHash) initUrl.searchParams.set('fileHash', params.fileHash)

  const initRes = await fetch(initUrl.toString(), { method: 'POST' })
  const initBody = await initRes.json().catch(() => ({})) as {
    uploadId?: string; key?: string
    error?: string; existingDemo?: { created_at?: string }
    adopted?: boolean; demo?: { id: string }
  }
  if (!initRes.ok) {
    if (initRes.status === 409 && initBody.error === 'duplicate') {
      const date = initBody.existingDemo?.created_at
        ? new Date(initBody.existingDemo.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'previously'
      throw new Error(`Already uploaded — this demo was added ${date}`)
    }
    throw new Error(initBody.error ?? `Upload init failed (${initRes.status})`)
  }
  // Another team already parsed this file — demo instantly added, no upload needed.
  if (initBody.adopted && initBody.demo) {
    onProgress(100)
    return { ...initBody.demo, _adopted: true }
  }
  const { uploadId, key } = initBody as { uploadId: string; key: string }

  // 2 — upload chunks
  const numChunks = Math.ceil(file.size / CHUNK_SIZE)
  const parts: Array<{ partNumber: number; etag: string }> = []

  for (let i = 0; i < numChunks; i++) {
    const start = i * CHUNK_SIZE
    const chunk = file.slice(start, start + CHUNK_SIZE)

    const partUrl = new URL(base)
    partUrl.searchParams.set('action', 'part')
    partUrl.searchParams.set('uploadId', uploadId)
    partUrl.searchParams.set('key', key)
    partUrl.searchParams.set('partNumber', String(i + 1))

    const partRes = await fetch(partUrl.toString(), {
      method:  'POST',
      body:    chunk,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    if (!partRes.ok) {
      const body = await partRes.json().catch(() => ({}))
      throw new Error(body.error ?? `Chunk ${i + 1} upload failed (${partRes.status})`)
    }
    const { etag } = await partRes.json() as { etag: string }
    parts.push({ partNumber: i + 1, etag })
    onProgress(Math.round(((i + 1) / numChunks) * 90)) // reserve last 10% for complete step
  }

  // 3 — complete upload and register demo
  const completeUrl = new URL(base)
  completeUrl.searchParams.set('action', 'complete')
  completeUrl.searchParams.set('uploadId', uploadId)
  completeUrl.searchParams.set('key', key)
  completeUrl.searchParams.set('fileSize', String(file.size))
  common.forEach((v, k) => completeUrl.searchParams.set(k, v))
  if (params.fileHash) completeUrl.searchParams.set('fileHash', params.fileHash)

  const completeRes = await fetch(completeUrl.toString(), {
    method:  'POST',
    body:    JSON.stringify({ parts }),
    headers: { 'Content-Type': 'application/json' },
  })
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}))
    const detail = body.error ?? (completeRes.status === 500 ? 'Server error — try again' : `Failed (${completeRes.status})`)
    throw new Error(detail)
  }

  onProgress(100)
  return completeRes.json()
}

export default function DemoUploadButton({ teamId, demoType = 'opponent', label, onSuccess }: DemoUploadButtonProps) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [uploads, setUploads]         = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasStarted, setHasStarted]   = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [mounted, setMounted]         = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Hash computations start immediately when files are dropped.
  // By the time the user clicks Upload the hash is usually already ready.
  const hashPromises = useRef<Map<File, Promise<string>>>(new Map())

  const updateUpload = useCallback(
    (index: number, update: Partial<FileUpload>) =>
      setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u))),
    []
  )

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const valid     = acceptedFiles.filter(f => isValidDemoFile(f.name) && f.size <= MAX_FILE_SIZE)
    const oversized = acceptedFiles.filter(f => f.size > MAX_FILE_SIZE)
    // Kick off hashing immediately so it's ready before the user clicks Upload
    for (const file of valid) {
      hashPromises.current.set(file, hashFile(file))
    }
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

  // ── Per-file upload (server proxy → register + parse in one call) ─────────────

  const uploadOne = async (i: number, file: File): Promise<void> => {
    try {
      updateUpload(i, { status: 'uploading', progress: 0 })

      // Await hash — usually already resolved since hashing started on file drop
      const fileHash = await (hashPromises.current.get(file) ?? hashFile(file))

      const demo = await uploadViaServer(
        file,
        { teamId, opponentName: demoType === 'self' ? 'My Team' : opponentName.trim(), demoType, fileHash },
        pct => updateUpload(i, { progress: pct }),
      )

      const adopted = (demo as { id: string; _adopted?: boolean })._adopted === true

      if (!adopted) updateUpload(i, { progress: 100, status: 'registering' })

      updateUpload(i, { status: adopted ? 'adopted' : 'queued', progress: 100, demoId: demo.id })
    } catch (err) {
      updateUpload(i, {
        status: 'error', progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  // ── Batch upload: max 2 concurrent to avoid overwhelming Railway's proxy ────────

  const uploadAll = async () => {
    if (demoType !== 'self' && !opponentName.trim()) return
    setHasStarted(true)
    setIsProcessing(true)

    const pending = uploads.reduce<Array<{ file: File; index: number }>>((acc, u, i) => {
      if (u.status === 'pending') acc.push({ file: u.file, index: i })
      return acc
    }, [])

    // Run uploads with a concurrency limit of 2
    const CONCURRENCY = 2
    let cursor = 0
    async function runNext(): Promise<void> {
      const item = pending[cursor++]
      if (!item) return
      await uploadOne(item.index, item.file).catch(() => {})
      return runNext()
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, runNext))

    setIsProcessing(false)
    onSuccess?.()
    router.refresh()
  }

  const handleClose = () => {
    if (isProcessing) return
    setOpen(false)
    setUploads([])
    setOpponentName('')
    setHasStarted(false)
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const errorCount   = uploads.filter(u => u.status === 'error').length
  const queuedCount  = uploads.filter(u => u.status === 'queued' || u.status === 'adopted').length
  const activeCount  = uploads.filter(u =>
    u.status === 'presigning' || u.status === 'uploading' || u.status === 'registering'
  ).length
  const canUpload   = pendingCount > 0 && (demoType === 'self' || opponentName.trim().length > 0)
  const allSettled  = hasStarted && uploads.length > 0 && activeCount === 0 && pendingCount === 0
  const hasLargeFile = uploads.some(
    u => u.file.size > LARGE_FILE_THRESHOLD && (u.status === 'pending' || u.status === 'uploading')
  )

  const statusLabel = (u: FileUpload) => {
    switch (u.status) {
      case 'presigning':  return 'Preparing…'
      case 'uploading':   return `Uploading ${u.progress > 0 ? `${u.progress}%` : '…'}`
      case 'registering': return 'Saving…'
      case 'queued':      return 'Queued for parsing'
      case 'adopted':     return 'Already parsed — added instantly'
      case 'error':       return u.error ?? 'Failed'
      default:            return 'Ready'
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!open) {
    const triggerLabel = label ?? 'Upload Demo'
    const TriggerIcon = label ? Plus : Upload
    return (
      <Button
        variant="neon"
        onClick={() => setOpen(true)}
        className="gap-2"
        style={label ? { background: 'var(--accent)', color: '#fff', boxShadow: 'none' } : undefined}
      >
        <TriggerIcon size={15} />
        {triggerLabel}
      </Button>
    )
  }

  const accentStep = (n: number) => (
    <span
      className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
    >
      {n}
    </span>
  )

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="rv-panel relative w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
        <span className="rv-tick rv-tick-tl" />
        <span className="rv-tick rv-tick-br" />

        {/* Gradient top bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 0%, transparent) 80%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)' }}>
              <Upload size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                {demoType === 'self' ? 'Upload Team Demos' : 'Add Opponent'}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">.dem / .zst · up to 500 MB per file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">

          {/* Step 1 — Opponent name */}
          {demoType === 'opponent' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {accentStep(1)}
                <span className="text-xs font-semibold text-foreground">Who are you scouting?</span>
              </div>
              <input
                type="text"
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
                placeholder="e.g. NAVI, Astralis, Team Liquid…"
                disabled={isProcessing}
                className="w-full rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 transition-colors"
                style={{
                  borderColor: opponentName ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)',
                  boxShadow: opponentName ? '0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
                }}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Info size={10} className="shrink-0" />
                You can update the opponent name from the demo row after upload.
              </p>
            </div>
          )}

          {/* Step 2 — Drop zone */}
          <div className="space-y-2">
            {demoType === 'opponent' && (
              <div className="flex items-center gap-2">
                {accentStep(2)}
                <span className="text-xs font-semibold text-foreground">Add demo files</span>
              </div>
            )}

            {hasLargeFile && (
              <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-300 leading-relaxed">
                  Large files upload directly to cloud storage — keep this tab open until complete.
                </p>
              </div>
            )}

            <div
              {...getRootProps()}
              className={cn(
                'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5'
                  : 'border-border/60 hover:border-[color:var(--accent)]/40 hover:bg-white/[0.02]'
              )}
            >
              <input {...getInputProps()} />
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors"
                style={{
                  background: isDragActive ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'color-mix(in srgb, var(--border) 60%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
                }}
              >
                <Upload size={18} style={{ color: isDragActive ? 'var(--accent)' : 'var(--muted-foreground)' }} />
              </div>
              {isDragActive ? (
                <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Drop files here…</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Drag &amp; drop demo files</p>
                  <p className="text-xs text-muted-foreground mt-1">.dem or .zst · up to 500 MB · <span className="underline underline-offset-2">click to browse</span></p>
                </>
              )}
            </div>

            {/* Per-file rows */}
            {uploads.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                {uploads.map((upload, i) => {
                  const inFlight = upload.status === 'presigning' || upload.status === 'uploading' || upload.status === 'registering'
                  const isDone   = upload.status === 'queued' || upload.status === 'adopted'
                  const isErr    = upload.status === 'error'
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: isErr ? 'color-mix(in srgb, var(--loss) 30%, transparent)'
                          : isDone ? 'color-mix(in srgb, var(--win) 25%, transparent)'
                          : 'var(--border)',
                        background: isErr ? 'color-mix(in srgb, var(--loss) 5%, transparent)'
                          : isDone ? 'color-mix(in srgb, var(--win) 4%, transparent)'
                          : 'color-mix(in srgb, var(--card) 60%, transparent)',
                      }}
                    >
                      <FileVideo size={15} className="shrink-0" style={{ color: isDone ? 'var(--win)' : isErr ? 'var(--loss)' : 'var(--muted-foreground)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{upload.file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(upload.file.size)}</span>
                          {inFlight ? (
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }}>
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${upload.progress}%`, background: 'var(--accent)' }} />
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium truncate" style={{ color: isDone ? 'var(--win)' : isErr ? 'var(--loss)' : 'var(--muted-foreground)' }}>
                              {statusLabel(upload)}
                            </span>
                          )}
                        </div>
                        {inFlight && <p className="text-[10px] text-muted-foreground mt-0.5">{statusLabel(upload)}</p>}
                      </div>
                      <div className="shrink-0">
                        {isDone
                          ? <CheckCircle2 size={14} style={{ color: 'var(--win)' }} />
                          : isErr
                          ? <AlertCircle size={14} style={{ color: 'var(--loss)' }} />
                          : inFlight
                          ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                          : (
                            <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <X size={14} />
                            </button>
                          )
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary banner */}
          {allSettled && (() => {
            const uploadedCount = uploads.filter(u => u.status === 'queued').length
            const adoptedCount  = uploads.filter(u => u.status === 'adopted').length
            const summaryParts: string[] = []
            if (uploadedCount > 0) summaryParts.push(`${uploadedCount} queued for parsing`)
            if (adoptedCount  > 0) summaryParts.push(`${adoptedCount} instantly added`)
            const isSuccess = errorCount === 0
            const isPartial = !isSuccess && queuedCount > 0
            return (
              <div
                className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium"
                style={{
                  borderColor: isSuccess ? 'color-mix(in srgb, var(--win) 30%, transparent)' : isPartial ? 'color-mix(in srgb, #facc15 30%, transparent)' : 'color-mix(in srgb, var(--loss) 30%, transparent)',
                  background:  isSuccess ? 'color-mix(in srgb, var(--win) 6%, transparent)' : isPartial ? 'color-mix(in srgb, #facc15 6%, transparent)' : 'color-mix(in srgb, var(--loss) 6%, transparent)',
                  color:       isSuccess ? 'var(--win)' : isPartial ? '#facc15' : 'var(--loss)',
                }}
              >
                {isSuccess ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                {isSuccess ? summaryParts.join(' · ')
                  : isPartial ? `${summaryParts.join(' · ')} · ${errorCount} failed`
                  : 'All uploads failed — check your connection and try again'}
              </div>
            )
          })()}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground">
              {uploads.length === 0 ? 'No files selected'
                : isProcessing ? `Uploading ${activeCount} of ${uploads.length}…`
                : allSettled ? `${queuedCount} queued · ${errorCount} failed`
                : `${uploads.length} file${uploads.length !== 1 ? 's' : ''} selected`}
            </span>
            <div className="flex gap-2">
              {errorCount > 0 && !isProcessing && (
                <Button variant="ghost" size="sm" onClick={retryFailed} className="gap-1.5 text-xs h-8">
                  <RefreshCw size={11} />
                  Retry {errorCount}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={handleClose} disabled={isProcessing} className="h-8 text-xs">
                {allSettled ? 'Done' : 'Cancel'}
              </Button>
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={uploadAll}
                  disabled={isProcessing || !canUpload}
                  className="gap-1.5 h-8 text-xs"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'none' }}
                  title={demoType !== 'self' && !opponentName.trim() ? 'Enter opponent name first' : undefined}
                >
                  {isProcessing
                    ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                    : <><Upload size={13} /> Upload {pendingCount > 1 ? `${pendingCount} files` : 'demo'}</>
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return mounted ? createPortal(modal, document.body) : null
}
