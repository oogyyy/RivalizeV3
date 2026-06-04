'use client'

import { useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { Send, Brain, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReplayState {
  roundIdx: number; time: number; duration: number; mapName: string
  aliveCT: number; aliveT: number; bombStatus: string | null
  recentKills: { killer: string; victim: string; weapon: string; time: number }[]
}

interface Props {
  mode: 'opponent' | 'myteam'
  teamId?: string
  folderId?: string
  mapName?: string
  replayContext?: ReplayState | null
}

const STARTERS: Record<Props['mode'], string[]> = {
  opponent: [
    'What are their most common executes?',
    'Where do they position CT-side on this map?',
    'What are their biggest weaknesses?',
    'Which utility setups do they run most often?',
  ],
  myteam: [
    'What were our biggest weaknesses this match?',
    'Which rounds did we lose due to economy mistakes?',
    'How can we improve our utility usage?',
    'Where are we leaking map control?',
  ],
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (trimmed === '') return <div key={i} className="h-1.5" />
        const isBullet = /^[-•*]\s/.test(trimmed)
        const text = isBullet ? trimmed.replace(/^[-•*]\s/, '') : trimmed
        const parts = text.split(/(\*\*[^*]+\*\*)/)
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        )
        return isBullet
          ? <div key={i} className="flex gap-1.5"><span className="text-neon-green/60 shrink-0 mt-px">•</span><span>{rendered}</span></div>
          : <div key={i}>{rendered}</div>
      })}
    </div>
  )
}

export default function DemoInlineChat({ mode, teamId, folderId, mapName, replayContext }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, setInput, isLoading, error, append, setMessages } = useChat({
    api: '/api/ai/coach',
    onError: (err) => console.error('[DemoInlineChat]', err),
  })

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isLoading])

  const send = (text: string) => {
    if (!text.trim() || isLoading) return
    setInput('')
    append(
      { role: 'user', content: text },
      { body: { teamId, folderId, mode, mapName, replayContext } },
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-[#070a16] overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/40 shrink-0">
        <Brain size={14} className="text-neon-green shrink-0" />
        <span className="text-sm font-semibold text-foreground">AI Coach</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          {mode === 'myteam' ? 'Self-Analysis' : 'Scout'}
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-1"
            title="Clear chat"
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* Live replay context banner */}
      {replayContext && (
        <div className="px-3 py-1.5 bg-neon-green/5 border-b border-neon-green/10 shrink-0">
          <div className="text-[9px] font-mono text-neon-green/60 flex items-center gap-2 flex-wrap">
            <span>R{replayContext.roundIdx + 1}</span>
            <span>·</span>
            <span>{Math.floor(replayContext.time)}s / {Math.floor(replayContext.duration)}s</span>
            <span>·</span>
            <span className="text-blue-400/70">CT {replayContext.aliveCT}v{replayContext.aliveT} T</span>
            {replayContext.bombStatus && (
              <>
                <span>·</span>
                <span className="text-orange-400/80 uppercase">{replayContext.bombStatus}</span>
              </>
            )}
            {replayContext.recentKills.length > 0 && (
              <>
                <span>·</span>
                <span>{replayContext.recentKills.length} kill{replayContext.recentKills.length !== 1 ? 's' : ''} last 10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">

        {messages.length === 0 && !isLoading && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] text-muted-foreground/50 font-mono text-center pb-1 uppercase tracking-wider">
              Ask anything about this match
            </p>
            {STARTERS[mode].map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="w-full text-left text-xs px-3 py-2 rounded-md border border-border/40 bg-card/30 text-muted-foreground hover:border-neon-green/30 hover:text-foreground hover:bg-neon-green/5 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-neon-green/12 border border-neon-green/25 text-foreground'
                : 'bg-card/60 border border-border/40 text-muted-foreground',
            )}>
              {msg.role === 'assistant'
                ? <MessageContent content={msg.content} />
                : <span>{msg.content}</span>
              }
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card/60 border border-border/40 rounded-lg px-3 py-2.5">
              <Loader2 size={12} className="text-neon-green animate-spin" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center px-2">{error.message}</p>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-2.5 py-2 flex items-center gap-2 bg-card/20">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
          }}
          placeholder="Ask the AI Coach…"
          disabled={isLoading}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none disabled:opacity-50 min-w-0"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isLoading}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 disabled:opacity-30 transition-colors shrink-0"
        >
          <Send size={11} />
        </button>
      </div>
    </div>
  )
}
