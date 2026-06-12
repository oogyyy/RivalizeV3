'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { Mic, Upload, X, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  demoId: string
  /** Current round time in seconds (from the replay timeline) */
  roundTime: number
  isPlaying: boolean
}

export default function VoiceCommsPlayer({ demoId, roundTime, isPlaying }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [audioKey, setAudioKey] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [error, setError] = useState('')

  // Sync audio playback with demo round time
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    const targetTime = Math.max(0, roundTime + offset)
    if (Math.abs(audio.currentTime - targetTime) > 0.5) {
      audio.currentTime = targetTime
    }
    if (isPlaying && audio.paused) audio.play().catch(() => {})
    else if (!isPlaying && !audio.paused) audio.pause()
  }, [roundTime, isPlaying, audioUrl, offset])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume
  }, [muted, volume])

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const res = await fetch(`/api/demos/${demoId}/voice-comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          offsetSeconds: offset,
        }),
      })
      if (!res.ok) { setError('Failed to get upload URL'); return }
      const { key, uploadUrl } = await res.json()

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      if (!putRes.ok) { setError('Upload failed'); return }

      setAudioKey(key)
      const localUrl = URL.createObjectURL(file)
      setAudioUrl(localUrl)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!audioKey) return
    await fetch(`/api/demos/${demoId}/voice-comms`, { method: 'DELETE' })
    setAudioKey(null)
    setAudioUrl(null)
    setOffset(0)
  }

  async function handleOffsetChange(val: number) {
    setOffset(val)
    await fetch(`/api/demos/${demoId}/voice-comms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offsetSeconds: val }),
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={15} className="text-neon-green" />
          <span className="text-sm font-semibold text-foreground">Voice Comms</span>
        </div>
        {audioUrl && (
          <button
            onClick={() => setMuted((v: boolean) => !v)}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        )}
      </div>

      {!audioUrl ? (
        <div className="flex flex-col items-center justify-center gap-3 py-4 border border-dashed border-border rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Upload a .mp3/.ogg/.wav recording to sync with this demo
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.ogg,.wav,.m4a"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading
              ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
              : <><Upload size={12} /> Upload Audio</>
            }
          </Button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Hidden audio element */}
          <audio ref={audioRef} src={audioUrl} preload="auto" />

          {/* Status bar */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isPlaying ? 'bg-neon-green animate-pulse' : 'bg-muted-foreground'
              )}
            />
            {isPlaying ? 'Playing' : 'Paused'} — synced to replay
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 size={12} className="text-muted-foreground flex-shrink-0" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-neon-green cursor-pointer"
              style={{ accentColor: '#2DE3CE' }}
            />
          </div>

          {/* Offset */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Audio offset</span>
              <span className="font-mono">{offset > 0 ? '+' : ''}{offset.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={-30}
              max={30}
              step={0.5}
              value={offset}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleOffsetChange(parseFloat(e.target.value))}
              className="w-full h-1 cursor-pointer"
              style={{ accentColor: '#818cf8' }}
            />
            <p className="text-[10px] text-muted-foreground">
              Slide to align audio to the round start
            </p>
          </div>

          {/* Remove */}
          <button
            onClick={handleRemove}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
          >
            <X size={11} />
            Remove audio
          </button>
        </div>
      )}
    </div>
  )
}
