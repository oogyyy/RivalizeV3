'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle, Info, RefreshCw,
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024
const MAX_FILE_SIZE        = 500 * 1024 * 1024

interface DemoUploadButtonProps {
  teamId: string
  /** 'opponent' (default) → Opponents / scouting. 'self' → My Team analysis. */
  demoType?: 'opponent' | 'self'
  onSuccess?: () => void
}

// 'queued' = uploaded + parse kicked off in background (terminal success state)
type UploadStatus = 'pending' | 'presigning' | 'uploading' | 'registering' | 'queued' | 'error'

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

// 9 MB chunks — safely under Railway's ~10 MB reverse-proxy body limit.
// R2 multipart upload requires parts ≥ 5 MB except the last one, so 9 MB works.
const CHUNK_SIZE = 9 * 1024 * 1024

async function uploadViaServer(
  file: File,
  params: { teamId: string; opponentName: string; demoType: string },
  onProgress: (pct: number) => void,
): Promise<{ id: string }> {
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

  const initRes = await fetch(initUrl.toString(), { method: 'POST' })
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}))
    throw new Error(body.error ?? `Upload init failed (${initRes.status})`)
  }
  const { uploadId, key } = await initRes.json() as { uploadId: string; key: string }

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

export default function DemoUploadButton({ teamId, demoType = 'opponent', onSuccess }: DemoUploadButtonProps) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [uploads, setUploads]         = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasStarted, setHasStarted]   = useState(false)
  const [opponentName, setOpponentName] = useState('')
  const [mounted, setMounted]         = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const updateUpload = useCallback(
    (index: number, update: Partial<FileUpload>) =>
      setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u))),
    []
  )

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const valid     = acceptedFiles.filter(f => isValidDemoFile(f.name) && f.size <= MAX_FILE_SIZE)
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

  // ── Per-file upload (server proxy → register + parse in one call) ─────────────

  const uploadOne = async (i: number, file: File): Promise<void> => {
    try {
      updateUpload(i, { status: 'uploading', progress: 0 })

      const demo = await uploadViaServer(
        file,
        { teamId, opponentName: demoType === 'self' ? 'My Team' : opponentName.trim(), demoType },
        pct => updateUpload(i, { progress: pct }),
      )

      updateUpload(i, { progress: 100, status: 'registering' })

      updateUpload(i, { status: 'queued', progress: 100, demoId: demo.id })
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
  const queuedCount  = uploads.filter(u => u.status === 'queued').length
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
      case 'error':       return u.error ?? 'Failed'
      default:            return 'Ready'
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <Button variant="neon" onClick={() => setOpen(true)} className="gap-2">
        <Upload size={16} />
        Upload Demo
      </Button>
    )
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {demoType === 'self' ? 'Upload My Team Demos' : 'Upload Opponent Demo'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              .dem / .zst files · up to 500 MB per file
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1 — Opponent name (opponent flow only) */}
          {demoType === 'opponent' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 rounded px-1.5 py-0.5">
                  STEP 1
                </span>
                <span className="text-xs font-semibold text-foreground">Who are you scouting?</span>
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
                After upload, you can set which team is the opponent from the demo row.
              </p>
            </div>
          )}

          {/* File drop zone */}
          <div className="space-y-2">
            {demoType === 'opponent' && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 rounded px-1.5 py-0.5">
                  STEP 2
                </span>
                <span className="text-xs font-semibold text-foreground">Add demo files</span>
              </div>
            )}

            {hasLargeFile && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-300">
                  Large files upload directly to cloud storage — keep this tab open until all uploads complete.
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

            {/* Per-file status rows */}
            {uploads.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploads.map((upload, i) => {
                  const inFlight = upload.status === 'presigning' || upload.status === 'uploading' || upload.status === 'registering'
                  return (
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
                          upload.status === 'queued' ? 'text-[#00ff87]'
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
                          {inFlight ? (
                            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#00ff87] rounded-full transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                          ) : (
                            <span className={cn(
                              'text-[10px] font-medium truncate',
                              upload.status === 'queued' ? 'text-[#00ff87]'
                              : upload.status === 'error' ? 'text-red-400'
                              : 'text-muted-foreground'
                            )}>
                              {statusLabel(upload)}
                            </span>
                          )}
                        </div>
                        {inFlight && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{statusLabel(upload)}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {upload.status === 'queued'
                          ? <CheckCircle2 size={14} className="text-[#00ff87]" />
                          : upload.status === 'error'
                          ? <AlertCircle size={14} className="text-red-400" />
                          : inFlight
                          ? <Loader2 size={14} className="text-[#00ff87] animate-spin" />
                          : (
                            <button
                              onClick={() => removeFile(i)}
                              className="text-muted-foreground hover:text-red-400 transition-colors"
                            >
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

          {/* Summary banner — shown after all uploads complete */}
          {allSettled && (
            <div className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium',
              errorCount === 0
                ? 'border-[#00ff87]/30 bg-[#00ff87]/5 text-[#00ff87]'
                : queuedCount > 0
                ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300'
                : 'border-red-500/30 bg-red-500/5 text-red-400'
            )}>
              {errorCount === 0 ? (
                <>
                  <CheckCircle2 size={14} className="shrink-0" />
                  {queuedCount} demo{queuedCount !== 1 ? 's' : ''} uploaded — parsing in background
                </>
              ) : queuedCount > 0 ? (
                <>
                  <AlertCircle size={14} className="shrink-0" />
                  {queuedCount} uploaded · {errorCount} failed
                </>
              ) : uploads.every(u => u.error?.includes('already has 5 demos')) ? (
                <>
                  <AlertCircle size={14} className="shrink-0" />
                  Queue full — wait for current demos to finish parsing, then retry
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="shrink-0" />
                  All uploads failed — check your connection and try again
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {uploads.length === 0
                ? 'No files selected'
                : isProcessing
                ? `Uploading ${activeCount} of ${uploads.length} file${uploads.length !== 1 ? 's' : ''}…`
                : allSettled
                ? `${queuedCount} queued · ${errorCount} failed`
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
                {allSettled ? 'Done' : 'Cancel'}
              </Button>
              {pendingCount > 0 && (
                <Button
                  variant="neon"
                  size="sm"
                  onClick={uploadAll}
                  disabled={isProcessing || !canUpload}
                  className="gap-2"
                  title={demoType !== 'self' && !opponentName.trim() ? 'Enter opponent name first' : undefined}
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

      </div>
    </div>
  )

  return mounted ? createPortal(modal, document.body) : null
}
