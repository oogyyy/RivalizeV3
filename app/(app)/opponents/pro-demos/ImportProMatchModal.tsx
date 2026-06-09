'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import Link from 'next/link'
import { cn, formatFileSize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  X, Upload, Download, ExternalLink, Loader2, CheckCircle2, AlertCircle,
  FileVideo, Link2, Trophy,
} from 'lucide-react'
import { uploadViaServer, isValidDemoFile } from '@/components/teams/DemoUploadButton'
import type { ProMatch } from './ProDemosClient'

const MAX_FILE_SIZE = 500 * 1024 * 1024

type FileState = {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'queued' | 'adopted' | 'error'
  error?: string
  demoId?: string
}

export default function ImportProMatchModal({
  match,
  teamId,
  onClose,
  onImported,
}: {
  match: ProMatch
  teamId: string
  onClose: () => void
  onImported: (demoId: string) => void
}) {
  // Which side is the opponent being scouted — defaults to team2
  const [opponent, setOpponent] = useState<'team1' | 'team2'>('team2')
  const [files, setFiles] = useState<FileState[]>([])
  const [uploading, setUploading] = useState(false)
  const [demoUrl, setDemoUrl] = useState('')
  const [urlStatus, setUrlStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [urlError, setUrlError] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const opponentName = opponent === 'team1' ? match.team1 : match.team2
  const hltvSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `site:hltv.org ${match.team1} vs ${match.team2} ${match.event}`
  )}`

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [
      ...prev,
      ...accepted.map(file => {
        if (!isValidDemoFile(file.name)) {
          return { file, progress: 0, status: 'error' as const, error: 'Only .dem or .zst files are supported' }
        }
        if (file.size > MAX_FILE_SIZE) {
          return { file, progress: 0, status: 'error' as const, error: `Exceeds 500 MB limit (${formatFileSize(file.size)})` }
        }
        return { file, progress: 0, status: 'pending' as const }
      }),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.dem', '.zst'] },
    multiple: true,
  })

  const updateFile = (i: number, patch: Partial<FileState>) =>
    setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  async function uploadAll() {
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        if (files[i].status !== 'pending') continue
        updateFile(i, { status: 'uploading', progress: 0 })
        try {
          const demo = await uploadViaServer(
            files[i].file,
            { teamId, opponentName, demoType: 'opponent' },
            pct => updateFile(i, { progress: pct }),
          )
          const adopted = (demo as { id: string; _adopted?: boolean })._adopted === true
          updateFile(i, { status: adopted ? 'adopted' : 'queued', progress: 100, demoId: demo.id })
          onImported(demo.id)
        } catch (err) {
          updateFile(i, {
            status: 'error',
            progress: 0,
            error: err instanceof Error ? err.message : 'Upload failed',
          })
        }
      }
    } finally {
      setUploading(false)
    }
  }

  async function importFromUrl() {
    if (!demoUrl.trim()) return
    setUrlStatus('importing')
    setUrlError('')
    try {
      const res = await fetch('/api/demos/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          url: demoUrl.trim(),
          opponentName,
          map: match.maps.length === 1 ? match.maps[0] : undefined,
          matchDate: match.date ?? undefined,
          event: match.event,
        }),
      })
      const data = await res.json().catch(() => ({})) as { demoId?: string; error?: string }
      if (!res.ok || !data.demoId) {
        throw new Error(typeof data.error === 'string' ? data.error : `Import failed (${res.status})`)
      }
      setUrlStatus('done')
      onImported(data.demoId)
    } catch (err) {
      setUrlStatus('error')
      setUrlError(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const doneCount = files.filter(f => f.status === 'queued' || f.status === 'adopted').length

  const sectionLabel = (n: number, text: string) => (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
        style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
      >
        {n}
      </span>
      <span className="text-xs font-semibold text-foreground">{text}</span>
    </div>
  )

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="rv-panel relative w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
        <span className="rv-tick rv-tick-tl" />
        <span className="rv-tick rv-tick-br" />
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 0%, transparent) 80%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)' }}>
              <Trophy size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight truncate">
                {match.team1} vs {match.team2}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {match.event}
                {match.date && ` · ${new Date(match.date).toLocaleDateString()}`}
                {match.score && ` · ${match.score}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading || urlStatus === 'importing'}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-40 shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Step 1 — opponent side */}
          <div className="space-y-2">
            {sectionLabel(1, 'Who are you scouting?')}
            <div className="grid grid-cols-2 gap-2">
              {(['team1', 'team2'] as const).map(side => (
                <button
                  key={side}
                  onClick={() => setOpponent(side)}
                  disabled={uploading || urlStatus === 'importing'}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium truncate transition-colors',
                    opponent === side ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={{
                    borderColor: opponent === side ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)',
                    background: opponent === side ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}
                >
                  {side === 'team1' ? match.team1 : match.team2}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              The demo is filed under this opponent in your scouting library.
            </p>
          </div>

          {/* Step 2 — get the demo */}
          <div className="space-y-2">
            {sectionLabel(2, 'Get the demo from HLTV')}
            <a
              href={hltvSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm text-foreground hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download size={14} className="text-muted-foreground" />
                Find this match on HLTV
              </span>
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
            <p className="text-[10px] text-muted-foreground">
              Open the match page, download the demo (extract if it&apos;s a .rar archive), then add the .dem below.
            </p>
          </div>

          {/* Step 3 — upload */}
          <div className="space-y-2">
            {sectionLabel(3, 'Add the demo file')}
            <div
              {...getRootProps()}
              className={cn(
                'rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5'
                  : 'border-border/60 hover:border-[color:var(--accent)]/40 hover:bg-white/[0.02]'
              )}
            >
              <input {...getInputProps()} />
              <Upload size={16} className="mx-auto mb-2" style={{ color: isDragActive ? 'var(--accent)' : 'var(--muted-foreground)' }} />
              <p className="text-xs font-semibold text-foreground">
                {isDragActive ? 'Drop files here…' : 'Drag & drop .dem / .zst files'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">up to 500 MB · click to browse</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {files.map((f, i) => {
                  const inFlight = f.status === 'uploading'
                  const isDone = f.status === 'queued' || f.status === 'adopted'
                  const isErr = f.status === 'error'
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                      <FileVideo size={13} className="shrink-0" style={{ color: isDone ? 'var(--win)' : isErr ? 'var(--loss)' : 'var(--muted-foreground)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{f.file.name}</p>
                        {inFlight ? (
                          <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--border) 80%, transparent)' }}>
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${f.progress}%`, background: 'var(--accent)' }} />
                          </div>
                        ) : (
                          <p className="text-[10px] truncate" style={{ color: isDone ? 'var(--win)' : isErr ? 'var(--loss)' : 'var(--muted-foreground)' }}>
                            {f.status === 'queued' ? 'Queued for parsing'
                              : f.status === 'adopted' ? 'Already parsed — added instantly'
                              : isErr ? (f.error ?? 'Failed')
                              : formatFileSize(f.file.size)}
                          </p>
                        )}
                      </div>
                      {isDone ? <CheckCircle2 size={13} style={{ color: 'var(--win)' }} />
                        : isErr ? <AlertCircle size={13} style={{ color: 'var(--loss)' }} />
                        : inFlight ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        : (
                          <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X size={13} />
                          </button>
                        )}
                    </div>
                  )
                })}
              </div>
            )}

            {pendingCount > 0 && (
              <Button
                size="sm"
                onClick={uploadAll}
                disabled={uploading}
                className="w-full gap-1.5 h-8 text-xs"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'none' }}
              >
                {uploading
                  ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                  : <><Upload size={12} /> Upload {pendingCount > 1 ? `${pendingCount} files` : 'demo'}</>}
              </Button>
            )}
          </div>

          {/* Or paste a URL */}
          <div className="space-y-2 pt-3 border-t border-border/60">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Link2 size={12} className="text-muted-foreground" />
              Or paste a direct demo URL
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={demoUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setDemoUrl(e.target.value); if (urlStatus === 'error') setUrlStatus('idle') }}
                placeholder="https://…/match.dem"
                disabled={urlStatus === 'importing' || urlStatus === 'done'}
                className="flex-1 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50 disabled:opacity-50"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={importFromUrl}
                disabled={!demoUrl.trim() || urlStatus === 'importing' || urlStatus === 'done'}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                {urlStatus === 'importing' ? <><Loader2 size={12} className="animate-spin" /> Importing…</>
                  : urlStatus === 'done' ? <><CheckCircle2 size={12} /> Queued</>
                  : 'Import'}
              </Button>
            </div>
            {urlStatus === 'error' && (
              <p className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--loss)' }}>
                <AlertCircle size={11} className="shrink-0 mt-px" />
                {urlError}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Works with publicly downloadable .dem links. HLTV links usually require a logged-in browser — download the file and use the upload above instead.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground">
              {doneCount > 0 || urlStatus === 'done'
                ? `${doneCount + (urlStatus === 'done' ? 1 : 0)} demo${doneCount + (urlStatus === 'done' ? 1 : 0) !== 1 ? 's' : ''} queued for parsing`
                : 'Demos appear under Opponents once parsed'}
            </span>
            <div className="flex items-center gap-2">
              {(doneCount > 0 || urlStatus === 'done') && (
                <Link href="/opponents" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                  View in Opponents
                </Link>
              )}
              <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading || urlStatus === 'importing'} className="h-8 text-xs">
                {doneCount > 0 || urlStatus === 'done' ? 'Done' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return mounted ? createPortal(modal, document.body) : null
}
