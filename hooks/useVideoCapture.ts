'use client'

import { useRef, useState, useCallback, type RefObject } from 'react'

export type RecordState = 'idle' | 'recording' | 'processing'

export function useVideoCapture(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recordState, setRecordState] = useState<RecordState>('idle')

  const start = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const stream = canvas.captureStream(30)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        setRecordState('processing')
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rivalize-clip-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        setRecordState('idle')
      }
      mediaRecorderRef.current = mr
      mr.start(200)
      setRecordState('recording')
    } catch {
      setRecordState('idle')
    }
  }, [canvasRef])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    if (recordState === 'recording') stop()
    else if (recordState === 'idle') start()
  }, [recordState, start, stop])

  return { recordState, toggle }
}
