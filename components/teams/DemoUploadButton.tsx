'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, X, FileVideo, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/utils'

interface DemoUploadButtonProps {
  teamId: string
  onSuccess?: () => void
}

interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'creating' | 'done' | 'error'
  error?: string
  demoId?: string
}

export default function DemoUploadButton({ teamId, onSuccess }: DemoUploadButtonProps) {
  const [open, setOpen] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const updateUpload = (index: number, update: Partial<FileUpload>) => {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...update } : u)))
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads: FileUpload[] = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }))
    setUploads((prev) => [...prev, ...newUploads])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dem'] },
    multiple: true,
  })

  const removeFile = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadAll = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setIsProcessing(true)
    const pending = uploads.filter((u) => u.status === 'pending')

    for (let i = 0; i < uploads.length; i++) {
      const upload = uploads[i]
      if (upload.status !== 'pending') continue

      updateUpload(i, { status: 'uploading', progress: 10 })

      try {
        // Upload file to Supabase storage
        const fileName = `${teamId}/${Date.now()}_${upload.file.name}`
        const { error: storageError } = await supabase.storage
          .from('demos')
          .upload(fileName, upload.file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (storageError) throw new Error(storageError.message)

        updateUpload(i, { progress: 60, status: 'creating' })

        // Create demo record
        const { data: demo, error: dbError } = await supabase
          .from('demos')
          .insert({
            team_id: teamId,
            opponent_name: 'Unknown',
            map: 'Unknown',
            raw_file_path: fileName,
            status: 'processing',
            created_by: user.id,
          })
          .select()
          .single()

        if (dbError) throw new Error(dbError.message)

        updateUpload(i, { progress: 80, demoId: demo.id })

        // Trigger parse API
        try {
          await fetch('/api/demos/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demoId: demo.id, filePath: fileName }),
          })
        } catch {
          // Parse trigger is best-effort
        }

        updateUpload(i, { status: 'done', progress: 100 })
      } catch (err) {
        updateUpload(i, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    }

    setIsProcessing(false)

    const allDone = uploads.every((u) => u.status === 'done' || u.status === 'error')
    if (allDone && pending.length > 0) {
      onSuccess?.()
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setOpen(false)
      setUploads([])
    }
  }

  const pendingCount = uploads.filter((u) => u.status === 'pending').length
  const doneCount = uploads.filter((u) => u.status === 'done').length

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
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Upload Demos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drop .dem files to upload and queue for analysis
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
                ? 'border-neon-green bg-neon-green/5'
                : 'border-border hover:border-neon-green/50 hover:bg-accent/30'
            )}
          >
            <input {...getInputProps()} />
            <Upload
              size={28}
              className={cn(
                'mx-auto mb-3 transition-colors',
                isDragActive ? 'text-neon-green' : 'text-muted-foreground'
              )}
            />
            {isDragActive ? (
              <p className="text-sm font-medium text-neon-green">Drop the .dem files here…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drag & drop .dem files here
                </p>
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
                      upload.status === 'done'
                        ? 'text-neon-green'
                        : upload.status === 'error'
                        ? 'text-red-400'
                        : 'text-muted-foreground'
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
                      {upload.status === 'uploading' || upload.status === 'creating' ? (
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neon-green rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      ) : upload.status === 'done' ? (
                        <span className="text-[10px] text-neon-green font-medium">Uploaded</span>
                      ) : upload.status === 'error' ? (
                        <span className="text-[10px] text-red-400">{upload.error}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Ready</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {upload.status === 'done' ? (
                      <CheckCircle2 size={14} className="text-neon-green" />
                    ) : upload.status === 'error' ? (
                      <AlertCircle size={14} className="text-red-400" />
                    ) : upload.status === 'uploading' || upload.status === 'creating' ? (
                      <Loader2 size={14} className="text-neon-green animate-spin" />
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

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {uploads.length === 0
                ? 'No files selected'
                : doneCount > 0
                ? `${doneCount}/${uploads.length} uploaded`
                : `${uploads.length} file${uploads.length !== 1 ? 's' : ''} selected`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isProcessing}
              >
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
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
                    </>
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
