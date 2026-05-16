'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024 // 300 MB

interface DemoUploadButtonProps {
  teamId: string
  teamName?: string
  onSuccess?: () => void
}

interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'presigning' | 'uploading' | 'registering' | 'done' | 'error'
  error?: string
  demoId?: string
}

function isValidDemoFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.dem') || lower.endsWith('.dem.zst')
}

export default function DemoUploadButton({ teamId, teamName, onSuccess }: DemoUploadButtonProps) {
  const [open, setOpen] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [opponentName, setOpponentName] = useState('')

  const updateUpload = (index: number, update: Partial<FileUpload>) =>
    setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u)))

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const valid = acceptedFiles.filter(f => isValidDemoFile(f.name))
    setUploads(prev => [
      ...prev,
      ...valid.map(file => ({ file, progress: 0, status: 'pending' as const })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Accept .dem and .dem.zst — both are raw binary blobs
    accept: { 'application/octet-stream': ['.dem', '.zst'] },
    multiple: true,
  })

  const removeFile = (index: number) =>
    setUploads(prev => prev.filter((_, i) => i !== index))

  const uploadAll = async () => {
    if (!opponentName.trim()) return
    setIsProcessing(true)
    let successCount = 0

    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status !== 'pending') continue

      try {
        // Step 1: Get a presigned upload URL.
        // teamId is the user's OWN team — never the opponent's.
        updateUpload(i, { status: 'presigning', progress: 10 })

        const presignRes = await fetch('/api/demos/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            filename: uploads[i].file.name,
            fileSize: uploads[i].file.size,
          }),
        })

        if (!presignRes.ok) {
          const err = await presignRes.json()
          throw new Error(err.error ?? 'Failed to get upload URL')
        }

        const { signedUrl, path } = await presignRes.json()

        // Step 2: Upload directly to Supabase Storage (browser → storage, no server proxy).
        updateUpload(i, { status: 'uploading', progress: 20 })

        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: uploads[i].file,
        })

        if (!uploadRes.ok) throw new Error('Upload to storage failed')

        updateUpload(i, { progress: 80, status: 'registering' })

        // Step 3: Register the demo in the database and auto-create the opponent folder.
        const registerRes = await fetch('/api/demos/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            storagePath: path,
            opponentName: opponentName.trim(),
            map: 'unknown',
            fileSize: uploads[i].file.size,
          }),
        })

        if (!registerRes.ok) {
          const err = await registerRes.json()
          throw new Error(err.error ?? 'Failed to register demo')
        }

        const demo = await registerRes.json()
        updateUpload(i, { status: 'done', progress: 100, demoId: demo.id })
        successCount++
      } catch (err) {
        updateUpload(i, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
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
  const doneCount = uploads.filter(u => u.status === 'done').length
  const canUpload = pendingCount > 0 && opponentName.trim().length > 0
  const hasLargeFile = uploads.some(u => u.file.size > LARGE_FILE_THRESHOLD && u.status === 'pending')

  const statusLabel = (u: FileUpload) => {
    if (u.status === 'presigning') return 'Getting upload URL…'
    if (u.status === 'uploading') return 'Uploading…'
    if (u.status === 'registering') return 'Registering…'
    if (u.status === 'done') return 'Done'
    if (u.status === 'error') return u.error
    return 'Ready'
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
              Accepts .dem and .dem.zst — up to 512 MB per file
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
              Opponent does not need to exist in Rivalize — a scouting folder is created automatically.
            </p>
          </div>

          {/* Large file notice */}
          {hasLargeFile && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
              <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-300">
                Large file detected. CS2 demos typically range from 200–500 MB — this is normal. Upload may take a few minutes.
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
              className={cn(
                'mx-auto mb-3 transition-colors',
                isDragActive ? 'text-[#00ff87]' : 'text-muted-foreground'
              )}
            />
            {isDragActive ? (
              <p className="text-sm font-medium text-[#00ff87]">Drop .dem or .dem.zst files here…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Drag & drop opponent demo files here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  .dem or .dem.zst · click to browse
                </p>
              </>
            )}
          </div>

          {/* File list */}
          {uploads.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {uploads.map((upload, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2"
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
                    <p className="text-xs font-medium text-foreground truncate">
                      {upload.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(upload.file.size)}
                      </span>
                      {(upload.status === 'uploading' || upload.status === 'presigning' || upload.status === 'registering') ? (
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00ff87] rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      ) : (
                        <span className={cn(
                          'text-[10px] font-medium',
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
                      <button
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
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
                : doneCount > 0
                ? `${doneCount}/${uploads.length} uploaded`
                : `${uploads.length} file${uploads.length !== 1 ? 's' : ''} selected`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isProcessing}>
                {doneCount > 0 ? 'Close' : 'Cancel'}
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
