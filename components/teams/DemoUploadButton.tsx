'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

interface DemoUploadButtonProps {
  teamId: string
  onSuccess?: () => void
}

interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'presigning' | 'uploading' | 'registering' | 'done' | 'error'
  error?: string
  demoId?: string
}

export default function DemoUploadButton({ teamId, onSuccess }: DemoUploadButtonProps) {
  const [open, setOpen] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const updateUpload = (index: number, update: Partial<FileUpload>) =>
    setUploads(prev => prev.map((u, i) => (i === index ? { ...u, ...update } : u)))

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploads(prev => [
      ...prev,
      ...acceptedFiles.map(file => ({ file, progress: 0, status: 'pending' as const })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dem'] },
    multiple: true,
  })

  const removeFile = (index: number) =>
    setUploads(prev => prev.filter((_, i) => i !== index))

  const uploadAll = async () => {
    setIsProcessing(true)

    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status !== 'pending') continue

      try {
        // Step 1: Request a presigned upload URL from our API.
        // The .dem file bytes never pass through Railway — only tiny JSON.
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

        // Step 2: Upload directly to Supabase Storage using the presigned URL.
        // This is a direct PUT from the browser — no Railway proxy involved.
        updateUpload(i, { status: 'uploading', progress: 20 })

        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: uploads[i].file,
        })

        if (!uploadRes.ok) throw new Error('Direct upload to storage failed')

        updateUpload(i, { progress: 80, status: 'registering' })

        // Step 3: Tell our API the upload succeeded so it can create the DB record.
        const registerRes = await fetch('/api/demos/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            storagePath: path,
            opponentName: 'Unknown',   // TODO: add opponent name input field
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
      } catch (err) {
        updateUpload(i, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    }

    setIsProcessing(false)

    const freshUploads = uploads // closure may be stale; effect is visual-only
    const anyDone = freshUploads.some(u => u.status === 'done')
    if (anyDone) onSuccess?.()
  }

  const handleClose = () => {
    if (isProcessing) return
    setOpen(false)
    setUploads([])
  }

  const pendingCount = uploads.filter(u => u.status === 'pending').length
  const doneCount = uploads.filter(u => u.status === 'done').length

  const statusLabel = (u: FileUpload) => {
    if (u.status === 'presigning') return 'Getting upload URL…'
    if (u.status === 'uploading') return 'Uploading to storage…'
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
            <h2 className="text-lg font-bold text-foreground">Upload Opponent Demos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload .dem files of upcoming opponents to scout them
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
              <p className="text-sm font-medium text-[#00ff87]">Drop opponent .dem files here…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Drag & drop opponent .dem files here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to select files</p>
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
                  disabled={isProcessing}
                  className="gap-2"
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
