'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import {
  Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle,
  Info, RefreshCw,
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024 // 300 MB
const MAX_FILE_SIZE        = 500 * 1024 * 1024 // 500 MB

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
          opponentName: demoType === 'self' ? 'My Team' : opponentName.trim(),
          map: 'unknown',
          fileSize: file.size,
          demoType,
          // Self-demos default to team2 (CT-Side) as "my team"; adjust via the demo card selector.
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
    if (demoType !== 'self' && !opponentName.trim()) return
    setIsProcessing(true)

    const pending = uploads
      .map((u, i) => ({ file: u.file, index: i, status: u.status }))
      .filter(u => u.status === 'pending')

    for (const { file, index } of pending) {
      await uploadOne(index, file)
    }

    setIsProcessing(false)
    onSuccess?.()
    router.refresh()
  }

  const handleClose = () => {
    if (isProcessing) return
    setOpen(false)
    setUploads([])
    setOpponentName('')
  }

  // ── Derived display values ───────────────────────────────────────────────────

  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const errorCount   = uploads.filter(u => u.status === 'error').length
  const doneCount    = uploads.filter(u => u.status === 'done').length
  const canUpload    = pendingCount > 0 && (demoType === 'self' || opponentName.trim().length > 0)
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

          {/* File upload area */}
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
                  CS2 demos are typically 200–500 MB. Large files upload directly to cloud storage — keep this tab open.
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
}
