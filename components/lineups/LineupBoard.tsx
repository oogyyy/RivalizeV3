'use client'

import {
  useEffect, useRef, useState, useCallback,
  type MouseEvent, type KeyboardEvent, type FocusEvent, type ElementType,
} from 'react'
import { cn } from '@/lib/utils'
import { loadMapImage } from '@/lib/map-config'
import {
  Pen, Minus, ArrowRight, Circle, Square, Type,
  Eraser, Trash2, Undo2, Save, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Tool = 'pen' | 'line' | 'arrow' | 'circle' | 'rect' | 'text' | 'eraser'

export interface DrawAction {
  tool: Tool
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  text?: string
  x?: number; y?: number; x2?: number; y2?: number
}

const COLORS = [
  { label: 'Green',  value: '#00ffc8' },
  { label: 'Red',    value: '#ff4466' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Blue',   value: '#38bdf8' },
  { label: 'White',  value: '#f1f5f9' },
  { label: 'Orange', value: '#fb923c' },
  { label: 'Purple', value: '#c084fc' },
]
const LINE_WIDTHS = [2, 4, 7, 11]
const CANVAS_SIZE = 512

function drawArrowhead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size = 12) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 7), y2 - size * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 7), y2 - size * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
}

function applyAction(ctx: CanvasRenderingContext2D, action: DrawAction) {
  ctx.strokeStyle = action.color
  ctx.fillStyle   = action.color
  ctx.lineWidth   = action.lineWidth
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  if ((action.tool === 'pen') && action.points && action.points.length > 1) {
    ctx.beginPath()
    ctx.moveTo(action.points[0].x, action.points[0].y)
    for (let i = 1; i < action.points.length; i++) ctx.lineTo(action.points[i].x, action.points[i].y)
    ctx.stroke()
  }
  if (action.tool === 'line' && action.x !== undefined) {
    ctx.beginPath(); ctx.moveTo(action.x!, action.y!); ctx.lineTo(action.x2!, action.y2!); ctx.stroke()
  }
  if (action.tool === 'arrow' && action.x !== undefined) {
    ctx.beginPath(); ctx.moveTo(action.x!, action.y!); ctx.lineTo(action.x2!, action.y2!); ctx.stroke()
    drawArrowhead(ctx, action.x!, action.y!, action.x2!, action.y2!)
  }
  if (action.tool === 'circle' && action.x !== undefined) {
    const r = Math.hypot(action.x2! - action.x!, action.y2! - action.y!)
    ctx.beginPath(); ctx.arc(action.x!, action.y!, r, 0, Math.PI * 2); ctx.stroke()
  }
  if (action.tool === 'rect' && action.x !== undefined) {
    ctx.beginPath()
    ctx.strokeRect(Math.min(action.x!, action.x2!), Math.min(action.y!, action.y2!), Math.abs(action.x2! - action.x!), Math.abs(action.y2! - action.y!))
  }
  if (action.tool === 'text' && action.text && action.x !== undefined) {
    ctx.font = `bold ${action.lineWidth * 4 + 10}px monospace`
    ctx.fillText(action.text, action.x!, action.y!)
  }
  if (action.tool === 'eraser' && action.points && action.points.length > 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = action.lineWidth * 6
    ctx.beginPath()
    ctx.moveTo(action.points[0].x, action.points[0].y)
    for (let i = 1; i < action.points.length; i++) ctx.lineTo(action.points[i].x, action.points[i].y)
    ctx.stroke()
    ctx.restore()
  }
}

interface Props {
  mapName: string
  initialActions?: DrawAction[]
  onSave: (actions: DrawAction[]) => Promise<void>
  readOnly?: boolean
}

export default function LineupBoard({ mapName, initialActions = [], onSave, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bgRef = useRef<HTMLImageElement | null>(null)
  const [actions, setActions] = useState<DrawAction[]>(initialActions)
  const [tool, setTool]       = useState<Tool>('arrow')
  const [color, setColor]     = useState(COLORS[0].value)
  const [lineWidth, setLineWidth] = useState(4)
  const [drawing, setDrawing] = useState(false)
  const [current, setCurrent] = useState<DrawAction | null>(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const textInputRef = useRef<HTMLInputElement>(null)
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    loadMapImage(mapName).then(img => { bgRef.current = img; redraw(actions) })
  }, [mapName]) // eslint-disable-line react-hooks/exhaustive-deps

  const redraw = useCallback((acts: DrawAction[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fillStyle = '#0d0f1e'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    if (bgRef.current) {
      ctx.globalAlpha = 0.45
      ctx.drawImage(bgRef.current, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.globalAlpha = 0.55
      ctx.fillStyle = '#0d0f1e'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.globalAlpha = 1
    }
    acts.forEach(a => applyAction(ctx, a))
  }, [])

  useEffect(() => { redraw(actions) }, [actions, redraw])

  function getXY(e: MouseEvent<HTMLCanvasElement> | { touches: TouchList; clientX?: number; clientY?: number }): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scale = CANVAS_SIZE / rect.width
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scale, y: (t.clientY - rect.top) * scale }
    }
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
  }

  function onDown(e: MouseEvent<HTMLCanvasElement>) {
    if (readOnly) return
    const { x, y } = getXY(e)
    if (tool === 'text') { setTextPos({ x, y }); setTimeout(() => textInputRef.current?.focus(), 0); return }
    setDrawing(true)
    const act: DrawAction = { tool, color, lineWidth, x, y, x2: x, y2: y, points: [{ x, y }] }
    setCurrent(act)
  }

  function onMove(e: MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !current || readOnly) return
    const { x, y } = getXY(e)
    const updated: DrawAction = { ...current, x2: x, y2: y, points: [...(current.points ?? []), { x, y }] }
    setCurrent(updated)
    redraw([...actions, updated])
  }

  function onUp() {
    if (!drawing || !current || readOnly) return
    setDrawing(false)
    const finalActions = [...actions, current]
    setActions(finalActions)
    setCurrent(null)
  }

  function commitText(text: string) {
    if (!textPos || !text.trim()) { setTextPos(null); return }
    const act: DrawAction = { tool: 'text', color, lineWidth, text: text.trim(), x: textPos.x, y: textPos.y }
    setActions((prev: DrawAction[]) => [...prev, act])
    setTextPos(null)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(actions)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const TOOLS: { id: Tool; Icon: ElementType; title: string }[] = [
    { id: 'pen',    Icon: Pen,        title: 'Freehand' },
    { id: 'line',   Icon: Minus,      title: 'Line' },
    { id: 'arrow',  Icon: ArrowRight, title: 'Arrow' },
    { id: 'circle', Icon: Circle,     title: 'Circle' },
    { id: 'rect',   Icon: Square,     title: 'Rectangle' },
    { id: 'text',   Icon: Type,       title: 'Text' },
    { id: 'eraser', Icon: Eraser,     title: 'Eraser' },
  ]

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Tools */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TOOLS.map(({ id, Icon, title }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={title}
                className={cn(
                  'p-2 transition-colors',
                  tool === id ? 'bg-neon-green/20 text-neon-green' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={cn('w-4 h-4 rounded-full border-2 transition-transform', color === c.value ? 'border-white scale-125' : 'border-transparent')}
                style={{ background: c.value }}
                title={c.label}
              />
            ))}
          </div>

          {/* Line width */}
          <div className="flex items-center gap-1">
            {LINE_WIDTHS.map(w => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors',
                  lineWidth === w ? 'bg-neon-green/20' : 'hover:bg-accent/30')}
              >
                <div className="rounded-full bg-foreground" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => { const next = actions.slice(0, -1); setActions(next) }}
              className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground"
              title="Undo"
              disabled={actions.length === 0}
            >
              <Undo2 size={13} />
            </button>
            <button
              onClick={() => setActions([])}
              className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-red-400"
              title="Clear"
            >
              <Trash2 size={13} />
            </button>
            <Button size="sm" variant="neon" className="h-7 gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg border border-border w-full max-w-[512px]"
          style={{ cursor: readOnly ? 'default' : tool === 'text' ? 'text' : 'crosshair' }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        />
        {/* Text input overlay */}
        {textPos && !readOnly && (
          <input
            ref={textInputRef}
            className="absolute bg-black/80 border border-neon-green/40 text-neon-green text-sm px-1 py-0.5 rounded font-mono z-10"
            style={{
              left: `${(textPos.x / CANVAS_SIZE) * 100}%`,
              top: `${(textPos.y / CANVAS_SIZE) * 100}%`,
              minWidth: 80,
            }}
            placeholder="type…"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') commitText((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setTextPos(null)
            }}
            onBlur={(e: FocusEvent<HTMLInputElement>) => commitText(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}
