'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { loadMapImage } from '@/lib/map-config'
import {
  Pen, Minus, ArrowRight, Circle, Square, Type,
  Eraser, Trash2, Undo2, Download, ZoomIn, ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Tool = 'pen' | 'line' | 'arrow' | 'circle' | 'rect' | 'text' | 'eraser'

interface DrawAction {
  tool: Tool
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  text?: string
  x?: number
  y?: number
  x2?: number
  y2?: number
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

function redraw(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement | null,
  actions: DrawAction[],
  size: number,
) {
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#080c18'
  ctx.fillRect(0, 0, size, size)

  if (bg) {
    ctx.globalAlpha = 0.45
    ctx.drawImage(bg, 0, 0, size, size)
    ctx.globalAlpha = 1
  }

  for (const action of actions) {
    ctx.strokeStyle = action.color
    ctx.fillStyle = action.color
    ctx.lineWidth = action.lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (action.tool === 'pen' && action.points && action.points.length > 1) {
      ctx.beginPath()
      ctx.moveTo(action.points[0].x, action.points[0].y)
      for (let i = 1; i < action.points.length; i++) {
        ctx.lineTo(action.points[i].x, action.points[i].y)
      }
      ctx.stroke()
    }

    if ((action.tool === 'line' || action.tool === 'arrow') && action.x !== undefined) {
      ctx.beginPath()
      ctx.moveTo(action.x!, action.y!)
      ctx.lineTo(action.x2!, action.y2!)
      ctx.stroke()
      if (action.tool === 'arrow') {
        drawArrowhead(ctx, action.x!, action.y!, action.x2!, action.y2!, action.lineWidth * 3 + 6)
      }
    }

    if (action.tool === 'circle' && action.x !== undefined) {
      const rx = Math.abs(action.x2! - action.x!) / 2
      const ry = Math.abs(action.y2! - action.y!) / 2
      const cx = Math.min(action.x!, action.x2!) + rx
      const cy = Math.min(action.y!, action.y2!) + ry
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (action.tool === 'rect' && action.x !== undefined) {
      ctx.beginPath()
      ctx.strokeRect(
        Math.min(action.x!, action.x2!),
        Math.min(action.y!, action.y2!),
        Math.abs(action.x2! - action.x!),
        Math.abs(action.y2! - action.y!),
      )
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
      for (let i = 1; i < action.points.length; i++) {
        ctx.lineTo(action.points[i].x, action.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }
}

interface StrategyBoardProps {
  mapName: string
}

export default function StrategyBoard({ mapName }: StrategyBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#00ffc8')
  const [lineWidth, setLineWidth] = useState(3)
  const [actions, setActions] = useState<DrawAction[]>([])
  const [drawing, setDrawing] = useState(false)
  const currentAction = useRef<DrawAction | null>(null)
  const [textPrompt, setTextPrompt] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setBgImage(null)
    loadMapImage(mapName).then(img => setBgImage(img))
  }, [mapName])

  // Re-render on bg or actions change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    redraw(ctx, bgImage, actions, CANVAS_SIZE)
  }, [bgImage, actions])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      const pos = getPos(e)
      setTextPos(pos)
      setTextPrompt(true)
      return
    }
    const pos = getPos(e)
    setDrawing(true)
    if (tool === 'pen' || tool === 'eraser') {
      currentAction.current = { tool, color, lineWidth, points: [pos] }
    } else {
      currentAction.current = { tool, color, lineWidth, x: pos.x, y: pos.y, x2: pos.x, y2: pos.y }
    }
  }, [tool, color, lineWidth])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !currentAction.current) return
    const pos = getPos(e)
    const action = currentAction.current

    if (tool === 'pen' || tool === 'eraser') {
      action.points!.push(pos)
    } else {
      action.x2 = pos.x
      action.y2 = pos.y
    }

    // Live preview
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    redraw(ctx, bgImage, actions, CANVAS_SIZE)
    redraw(ctx, null, [action], CANVAS_SIZE)
  }, [drawing, bgImage, actions, tool])

  const handleMouseUp = useCallback(() => {
    if (!drawing || !currentAction.current) return
    setDrawing(false)
    setActions(prev => [...prev, currentAction.current!])
    currentAction.current = null
  }, [drawing])

  function handleUndo() {
    setActions(prev => prev.slice(0, -1))
  }

  function handleClear() {
    setActions([])
  }

  function handleExport() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `strategy-${mapName}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleTextSubmit() {
    if (textInput.trim() && textPos) {
      setActions(prev => [...prev, {
        tool: 'text',
        color,
        lineWidth,
        text: textInput.trim(),
        x: textPos.x,
        y: textPos.y,
      }])
    }
    setTextPrompt(false)
    setTextInput('')
    setTextPos(null)
  }

  const toolDefs: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen',    icon: <Pen size={14} />,        label: 'Pen' },
    { id: 'line',   icon: <Minus size={14} />,      label: 'Line' },
    { id: 'arrow',  icon: <ArrowRight size={14} />, label: 'Arrow' },
    { id: 'circle', icon: <Circle size={14} />,     label: 'Circle' },
    { id: 'rect',   icon: <Square size={14} />,     label: 'Rectangle' },
    { id: 'text',   icon: <Type size={14} />,       label: 'Text' },
    { id: 'eraser', icon: <Eraser size={14} />,     label: 'Eraser' },
  ]

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tools */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {toolDefs.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={cn(
                'p-2 transition-colors',
                tool === t.id
                  ? 'bg-neon-green/20 text-neon-green'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              )}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              className={cn(
                'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                color === c.value ? 'border-white scale-110' : 'border-transparent'
              )}
              style={{ background: c.value }}
            />
          ))}
        </div>

        {/* Line width */}
        <div className="flex items-center gap-1">
          {LINE_WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => setLineWidth(w)}
              className={cn(
                'w-7 h-7 rounded flex items-center justify-center transition-colors',
                lineWidth === w ? 'bg-neon-green/20' : 'hover:bg-accent/30'
              )}
            >
              <div
                className="rounded-full bg-foreground"
                style={{ width: w * 1.5, height: w * 1.5 }}
              />
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleUndo} disabled={actions.length === 0} title="Undo">
            <Undo2 size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClear} disabled={actions.length === 0} title="Clear all">
            <Trash2 size={13} />
          </Button>
          <Button variant="secondary" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport} title="Export PNG">
            <Download size={12} />
            Export
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-border bg-[#080c18]"
        style={{ maxWidth: CANVAS_SIZE, margin: '0 auto' }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block w-full"
          style={{ cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Text input overlay */}
        {textPrompt && textPos && (
          <div
            className="absolute"
            style={{
              left: `${(textPos.x / CANVAS_SIZE) * 100}%`,
              top: `${(textPos.y / CANVAS_SIZE) * 100}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <input
              autoFocus
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTextSubmit()
                if (e.key === 'Escape') { setTextPrompt(false); setTextInput('') }
              }}
              onBlur={handleTextSubmit}
              className="text-sm font-mono bg-black/80 text-white border border-neon-green/60 rounded px-2 py-1 focus:outline-none"
              placeholder="Type label…"
              style={{ color }}
            />
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Draw on the map to plan strategies. Use Export to save as PNG for match prep.
      </p>
    </div>
  )
}
