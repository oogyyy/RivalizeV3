"use client";
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import type { ChatMessage } from '@/types/tactical';

interface Props {
  initialSearchContext?: string;
}

const SUGGESTED_PROMPTS = [
  'What is their default mid play on Mirage?',
  'How do they set up A-site executes?',
  'What utility does their AWP player use?',
  'Show force-buy tendencies after pistol loss.',
];

export default function AIScoutView({ initialSearchContext }: Props) {
  const opponent = initialSearchContext || 'Aurora Gaming';

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'm1',
    sender: 'agent',
    text: `Tactical database loaded for **${opponent}**. I have analyzed 24 demo reports covering their last 60 days of play. Ask me about their tendencies, utility usage, anti-strat weaknesses, or round-by-round patterns.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: `Analysis complete across 24 demo reports. Based on tracking: on active force buys **${opponent}** consistently holds double-short on Mirage and pushes A-Ramp with underpass flash cover. Their AWP player averages 1.28 opening duel success rate and prefers aggressive off-angles over passive holds.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col bg-brand-bg text-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-brand-border/60 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">AI Tactical Scout</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Scouting: <span className="text-brand-cyan font-mono">{opponent}</span> · 24 demos indexed
          </p>
        </div>
        <div className="flex items-center gap-2 bg-brand-card border border-brand-border/60 rounded-lg px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
          <span className="text-[11px] font-mono text-brand-cyan uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {SUGGESTED_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-[11px] text-gray-300 bg-brand-card border border-brand-border/60 hover:border-brand-purple/60 hover:text-white rounded-lg px-3 py-1.5 transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
              m.sender === 'agent'
                ? 'bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan'
                : 'bg-brand-purple/20 border border-brand-purple/40 text-brand-purple'
            }`}>
              {m.sender === 'agent' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`max-w-lg rounded-2xl border px-4 py-3 text-xs leading-relaxed ${
              m.sender === 'agent'
                ? 'bg-brand-card border-brand-border/60 text-gray-200'
                : 'bg-brand-purple border-brand-purple text-white'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {m.sender === 'agent' && <Sparkles className="w-3 h-3 text-brand-cyan" />}
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">{m.sender}</span>
                <span className="font-mono text-[9px] opacity-40 ml-auto">{m.time}</span>
              </div>
              {m.text.split('**').map((part, i) =>
                i % 2 === 1
                  ? <strong key={i} className="text-white font-semibold">{part}</strong>
                  : <span key={i}>{part}</span>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg shrink-0 bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-brand-card border border-brand-border/60 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 160, 320].map(d => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-brand-cyan opacity-60 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2 shrink-0">
        <form
          onSubmit={e => { e.preventDefault(); handleSend(input); }}
          className="flex items-center gap-3 bg-[#111322] border border-brand-border rounded-xl p-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about their tendencies, utility setups, or round patterns..."
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-brand-purple hover:bg-brand-purple-hover disabled:opacity-40 rounded-lg text-white transition shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
