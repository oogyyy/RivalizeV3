'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle, Info, RefreshCw } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024 // 300 MB

interface DemoUploadButtonProps {
  teamId: string
  teamName?: string
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
  return name.toLowerCase().endsWith('.dem')
}

export default function DemoUploadButton({ teamId, teamName, onSuccess }: DemoUploadButtonProps) {
  const [open, setOpen] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [opponentName, setOpponentName] = useState('')

  const updateUpload = useCallback((index: number, update: Partial<FileUpload>) =>
    setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u))), [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const valid = acceptedFiles.filter(f => isValidDemoFile(f.name))
    setUploads(prev => [
      ...prev,
      ...valid.map(file => ({ file, progress: 0, status: 'pending' as const })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dem'] },
    multiple: true,
  })

  const removeFile = (index: number) =>
    setUploads(prev => prev.filter((_, i) => i !== index))

  const retryFailed = () =>
    setUploads(prev => prev.map(u =>
      u.status === 'error' ? { ...u, status: 'pending', progress: 0, error: undefined } : u
    ))

  /** Upload a single file. Returns true on success. */
  const uploadOne = async (i: number, file: File): Promise<boolean> => {
    try {
      // Step 1 — get path + token from our API
      updateUpload(i, { status: 'presigning', progress: 5 })

      const presignRes = await fetch('/api/demos/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          filename: file.name,
          fileSize: file.size,
        }),
      })

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Presign failed (${presignRes.status})`)
      }

      const { path, token, contentType } = await presignRes.json()

      // Step 2 — upload directly to Supabase Storage using the SDK method.
      updateUpload(i, { status: 'uploading', progress: 10 })

      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from('demos')
        .uploadToSignedUrl(path, token, file, { contentType })

      if (storageError) {
        const msg = storageError.message ?? ''
        if (msg.toLowerCase().includes('mime') || msg.toLowerCase().includes('not supported')) {
          throw new Error('Storage rejected this file type. Check bucket MIME settings in Supabase Dashboard.')
        }
        throw new Error(msg)
      }

      updateUpload(i, { progress: 88, status: 'registering' })

      // Step 3 — register the demo in the database; opponent folder is auto-created
      const registerRes = await fetch('/api/demos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          storagePath: path,
          opponentName: opponentName.trim(),
          map: 'unknown',
          fileSize: file.size,
        }),
      })

      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}))
        throw new Error(err.error ?? `Register failed (${registerRes.status})`)
      }

      const demo = await registerRes.json()
      updateUpload(i, { status: 'done', progress: 100, demoId: demo.id })
      return true
    } catch (err) {
      updateUpload(i, {
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed',
      })
      return false
    }
  }

  const uploadAll = async () => {
    if (!opponentName.trim()) return
    setIsProcessing(true)

    // Read the pending files synchronously before any await so indices are stable
    const pending = uploads
      .map((u, i) => ({ file: u.file, index: i, status: u.status }))
      .filter(u => u.status === 'pending')

    let successCount = 0
    for (const { file, index } of pending) {
      const ok = await uploadOne(index, file)
      if (ok) successCount++
    }

    setIsProcessing(false)
    if (successCount > 0) onSuccess?.()
  }

  const handleClose = () => {
    if (isProcessing) return
    setOpen(false)
    setUploads([])
    setOpponentName('')
  }

  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const errorCount = uploads.filter(u => u.status === 'error').length
  const doneCount = uploads.filter(u => u.status === 'done').length
  const canUpload = pendingCount > 0 && opponentName.trim().length > 0
  const hasLargeFile = uploads.some(
    u => u.file.size > LARGE_FILE_THRESHOLD && (u.status === 'pending' || u.status === 'uploading')
  )

  const statusLabel = (u: FileUpload) => {
    switch (u.status) {
      case 'presigning': return 'Preparing…'
      case 'uploading': return `Uploading… ${u.progress > 10 ? `${u.progress - 10}%` : ''}`
      case 'registering': return 'Saving…'
      case 'done': return 'Done'
      case 'error': return u.error ?? 'Failed'
      default: return 'Ready'
    }
  }

  if (!open) {
    return (
      <Button variant="neon" onClick={() => setOpen(true)} className="gap-2">
        <Upload size={16} />
        Upload Opponent Demo
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Upload Opponent Demo{teamName ? ` for ${teamName}` : ''}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accepts .dem files — up to 512 MB per file
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

        <div className="p-5 space-y-4">
          {/* Opponent name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Opponent Team Name <span className="text-red-400">*</span>
            </label>
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
              Opponent does not need to exist in Rivalize — scouting folder created automatically.
            </p>
          </div>

          {/* Large file notice */}
          {hasLargeFile && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
              <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-300">
                CS2 demos are typically 200–500 MB. Large files may take 1–3 minutes to upload — keep this tab open.
              </p>
            </div>
          )}

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
              isDragActive
                ? 'border-[#00ff87] bg-[#00ff87]/5'
                : 'border-border hover:border-[#00ff87]/50 hover:bg-accent/30'
            )}
          >
            <input {...getInputProps()} />
            <Upload
              size={28}
              className={cn('mx-auto mb-3 transition-colors', isDragActive ? 'text-[#00ff87]' : 'text-muted-foreground')}
            />
            {isDragActive ? (
              <p className="text-sm font-medium text-[#00ff87]">Drop .dem files here…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Drag & drop opponent demo files here</p>
                <p className="text-xs text-muted-foreground mt-1">.dem files only · click to browse</p>
              </>
            )}
          </div>

          {/* File list */}
          {uploads.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-y-auto">
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
                      upload.status === 'done' ? 'text-[#00ff87]' :
                      upload.status === 'error' ? 'text-red-400' :
                      'text-muted-foreground'
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
                            className="h-full bg-[#00ff87] rounded-full transition-all duration-500"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      ) : (
                        <span className={cn(
                          'text-[10px] font-medium truncate',
                          upload.status === 'done' ? 'text-[#00ff87]' :
                          upload.status === 'error' ? 'text-red-400' :
                          'text-muted-foreground'
                        )}>
                          {statusLabel(upload)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {upload.status === 'done' ? (
                      <CheckCircle2 size={14} className="text-[#00ff87]" />
                    ) : upload.status === 'error' ? (
                      <AlertCircle size={14} className="text-red-400" />
                    ) : upload.status !== 'pending' ? (
                      <Loader2 size={14} className="text-[#00ff87] animate-spin" />
                    ) : (
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
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
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isProcessing}>
                {doneCount > 0 && pendingCount === 0 && errorCount === 0 ? 'Close' : 'Cancel'}
              </Button>
              {pendingCount > 0 && (
                <Button
                  variant="neon"
                  size="sm"
                  onClick={uploadAll}
                  disabled={isProcessing || !canUpload}
                  className="gap-2"
                  title={!opponentName.trim() ? 'Enter opponent team name first' : undefined}
                >
                  {isProcessing ? (
                    <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload size={14} /> Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>
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
