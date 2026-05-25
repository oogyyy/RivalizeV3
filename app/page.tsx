'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  Upload, Brain, Users, Map, Activity, Crosshair, Eye,
  ChevronRight, Star, AlertTriangle, Menu, X,
} from 'lucide-react'

const winRateData = [
  { round: 'R1', wr: 42 }, { round: 'R5', wr: 48 }, { round: 'R10', wr: 55 },
  { round: 'R15', wr: 61 }, { round: 'R20', wr: 58 }, { round: 'R25', wr: 67 },
  { round: 'R30', wr: 72 },
]

const playerData = [
  { name: 's1mple', role: 'AWPer',  rating: 1.38, kd: 1.71, hs: 41, clutch: 68 },
  { name: 'NiKo',   role: 'Rifler', rating: 1.29, kd: 1.54, hs: 55, clutch: 54 },
  { name: 'device', role: 'AWPer',  rating: 1.21, kd: 1.45, hs: 38, clutch: 61 },
  { name: 'ZywOo',  role: 'AWPer',  rating: 1.35, kd: 1.62, hs: 44, clutch: 71 },
  { name: 'sh1ro',  role: 'AWPer',  rating: 1.18, kd: 1.39, hs: 36, clutch: 58 },
]

const siteData = [
  { site: 'A', attacks: 62 },
  { site: 'B', attacks: 38 },
]

const recentAnalyses = [
  { opponent: 'Natus Vincere', map: 'Dust2',   date: '2h ago', rating: 9.2 },
  { opponent: 'Team Vitality', map: 'Mirage',   date: '5h ago', rating: 8.7 },
  { opponent: 'FaZe Clan',     map: 'Inferno',  date: '1d ago', rating: 9.5 },
]

const heatmapGrid = Array.from({ length: 120 }, (_, i) => {
  const seed = (i * 2654435761) % 100
  if (seed > 92) return 'danger'
  if (seed > 82) return 'hot'
  if (seed > 65) return 'warm'
  if (seed > 45) return 'cool'
  return 'empty'
})

const cellColor: Record<string, string> = {
  danger: 'bg-red-500/80', hot: 'bg-orange-400/60',
  warm: 'bg-yellow-400/30', cool: 'bg-primary/10', empty: 'bg-transparent',
}

const features = [
  { icon: Upload, title: 'DEMO PARSING',        desc: 'Upload .dem files and get instant structural analysis. Supports all CS2 competitive demo formats.',                                            tag: 'INGESTION' },
  { icon: Brain,  title: 'AI ANTI-STRATS',      desc: 'GPT-powered playbook generation. Know every execute, retake, and eco rush before round 1.',                                                    tag: 'INTELLIGENCE' },
  { icon: Map,    title: 'POSITIONAL HEATMAPS', desc: 'Visualize where opponents cluster, peek from, and rotate — across every map in the pool.',                                                     tag: 'SPATIAL' },
  { icon: Eye,    title: 'PATTERN DETECTION',   desc: 'Identify repeating setups, timings, and tendencies your opponents default to under pressure.',                                                  tag: 'ANALYSIS' },
  { icon: Users,  title: 'TEAM MANAGEMENT',     desc: 'Organize rosters, assign roles, share scouting reports, and track team-wide performance trends.',                                               tag: 'OPERATIONS' },
  { icon: Activity, title: 'ROUND-BY-ROUND REVIEW', desc: 'Drill into any round. Watch economic decisions, utility usage, and execution paths reconstructed.', tag: 'REVIEW' },
]

const steps = [
  { num: '01', title: 'UPLOAD DEMOS',    desc: 'Drop your opponent\'s .dem files into the platform. We accept single demos or full match archives.' },
  { num: '02', title: 'AI ANALYSIS',     desc: 'Our engine parses every tick — positions, economy, utility, rotations — and builds an intel dossier.' },
  { num: '03', title: 'ENTER PREPARED',  desc: 'Walk into the server with a printed playbook. You know their defaults. They don\'t know you know.' },
]

const mono      = { fontFamily: 'var(--font-mono), JetBrains Mono, monospace' }
const condensed = { fontFamily: 'var(--font-barlow-condensed), Barlow Condensed, sans-serif' }
const barlow    = { fontFamily: 'var(--font-barlow), Barlow, sans-serif' }

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'tside' | 'ctside' | 'players'>('tside')

  return (
    <div className="min-h-screen bg-background text-foreground" style={barlow}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Crosshair className="text-primary w-5 h-5" strokeWidth={1.5} />
            <span className="text-white font-bold tracking-widest text-sm" style={condensed}>RIVALIZE</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs tracking-widest text-muted-foreground font-medium">
            {['FEATURES', 'HOW IT WORKS', 'AI SCOUT', 'PRICING'].map((item) => (
              <a key={item} href="#" className="hover:text-primary transition-colors duration-150">{item}</a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login"    className="text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors px-4 py-2">LOG IN</Link>
            <Link href="/signup"   className="text-xs tracking-widest bg-primary text-primary-foreground font-semibold px-5 py-2 hover:bg-primary/90 transition-colors">GET STARTED</Link>
          </div>
          <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-6 py-4 flex flex-col gap-4">
            {['FEATURES', 'HOW IT WORKS', 'AI SCOUT', 'PRICING'].map((item) => (
              <a key={item} href="#" className="text-xs tracking-widest text-muted-foreground hover:text-primary transition-colors">{item}</a>
            ))}
            <Link href="/signup" className="text-xs tracking-widest bg-primary text-primary-foreground font-semibold px-5 py-2 w-full mt-2 text-center">GET STARTED</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-14 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-primary text-xs tracking-widest font-semibold" style={mono}>AI-POWERED CS2 SCOUTING</span>
            </div>
            <h1 className="text-white leading-none mb-6" style={{ ...condensed, fontSize: 'clamp(3rem, 7vw, 6rem)', fontWeight: 900, letterSpacing: '-0.01em' }}>
              ANALYZE.<br /><span className="text-primary">ADAPT.</span><br />DOMINATE.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-md">
              Upload your opponent&apos;s demos. Get instant AI-generated anti-strats, positional heatmaps, and player tendency reports. Enter every server prepared.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/signup" className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-4 text-sm tracking-widest hover:bg-primary/90 transition-all duration-150 group">
                START FOR FREE <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <button className="flex items-center gap-2 border border-border text-foreground font-medium px-8 py-4 text-sm tracking-widest hover:border-primary/50 hover:text-primary transition-all duration-150">VIEW DEMO</button>
            </div>
            <div className="flex gap-8 mt-12">
              {[{ val: '12K+', label: 'Demos Parsed' }, { val: '600+', label: 'Active Teams' }, { val: '98.4%', label: 'Parse Accuracy' }].map(({ val, label }) => (
                <div key={label}>
                  <div className="text-white font-bold text-2xl" style={condensed}>{val}</div>
                  <div className="text-muted-foreground text-xs tracking-widest mt-0.5" style={mono}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative">
            <div className="border border-border bg-card overflow-hidden shadow-2xl">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/30">
                <span className="text-xs text-muted-foreground tracking-widest" style={mono}>RIVALIZE // ANALYSIS_DASHBOARD</span>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted" />
                  <div className="w-2 h-2 rounded-full bg-muted" />
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-border">
                {[
                  { label: 'ROUNDS ANALYZED', val: '1,240', color: 'text-primary' },
                  { label: 'PATTERNS FOUND',  val: '47',    color: 'text-accent' },
                  { label: 'THREAT LEVEL',    val: 'HIGH',  color: 'text-destructive' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-muted/30 border border-border p-3">
                    <div className="text-muted-foreground text-[9px] tracking-widest mb-1" style={mono}>{label}</div>
                    <div className={`${color} font-bold text-lg`} style={condensed}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-b border-border">
                <div className="text-muted-foreground text-[10px] tracking-widest mb-3" style={mono}>OPPONENT WIN RATE BY ROUND // NATUS VINCERE · DUST2</div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={winRateData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="landingWrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="round" tick={{ fill: '#4a6578', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#4a6578', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} domain={[30, 80]} />
                    <Tooltip contentStyle={{ background: '#0c1219', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 2, fontSize: 10, fontFamily: 'JetBrains Mono', color: '#c8d8e4' }} formatter={(v: number) => [`${v}%`, 'Win Rate']} />
                    <Area type="monotone" dataKey="wr" stroke="#00d4ff" strokeWidth={1.5} fill="url(#landingWrGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-4">
                <div className="text-muted-foreground text-[10px] tracking-widest mb-3" style={mono}>RECENT ANALYSES</div>
                <div className="flex flex-col gap-2">
                  {recentAnalyses.map((a) => (
                    <div key={a.opponent} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        <span className="text-foreground font-medium">{a.opponent}</span>
                        <span className="text-muted-foreground" style={mono}>{a.map}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-[10px]" style={mono}>{a.date}</span>
                        <span className="text-accent font-semibold" style={mono}>{a.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Corner brackets */}
            <div className="absolute -top-2 -left-2 w-4 h-4 border-t border-l border-primary/50" />
            <div className="absolute -top-2 -right-2 w-4 h-4 border-t border-r border-primary/50" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b border-l border-primary/50" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b border-r border-primary/50" />
          </div>
        </div>
      </section>

      {/* ── TICKER ──────────────────────────────────────────────────────────── */}
      <div className="border-y border-border bg-muted/20 py-3 overflow-hidden">
        <div className="flex gap-12 text-[10px] tracking-widest text-muted-foreground whitespace-nowrap" style={mono}>
          {['DEMO PARSING ENGINE V3.1', 'CS2 TICK-128 SUPPORT', 'REAL-TIME ANALYSIS', 'TEAM PLAYBOOK EXPORT', 'INDIVIDUAL PLAYER PROFILES', 'ECONOMY TRACKING', 'UTILITY COVERAGE MAPS', 'ROTATION PREDICTION'].map((item, i) => (
            <span key={`ticker-${i}`} className="flex items-center gap-2">
              <span className="text-primary">▸</span>{item}
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="mb-16">
          <div className="text-primary text-xs tracking-widest mb-4 font-semibold" style={mono}>// CAPABILITIES</div>
          <h2 className="text-white text-5xl font-black leading-none" style={condensed}>EVERY EDGE,<br /><span className="text-muted-foreground font-normal">AUTOMATED.</span></h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {features.map(({ icon: Icon, title, desc, tag }) => (
            <div key={title} className="bg-card p-8 group hover:bg-muted/30 transition-colors duration-200 cursor-default">
              <div className="flex items-start justify-between mb-6">
                <div className="w-10 h-10 border border-primary/20 bg-primary/5 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-200">
                  <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-[9px] tracking-widest text-muted-foreground border border-border px-2 py-0.5" style={mono}>{tag}</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-3 tracking-wide" style={condensed}>{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/10">
        <div className="max-w-7xl mx-auto px-6 py-28">
          <div className="mb-16">
            <div className="text-primary text-xs tracking-widest mb-4 font-semibold" style={mono}>// PROCESS</div>
            <h2 className="text-white text-5xl font-black leading-none" style={condensed}>THREE STEPS.<br /><span className="text-primary">INFINITE EDGE.</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-0 relative">
            <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-border" />
            {steps.map(({ num, title, desc }, i) => (
              <div key={num} className="relative flex flex-col gap-6 p-8 pl-0 md:pr-12">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border border-primary bg-background flex items-center justify-center flex-shrink-0 relative z-10">
                    <span className="text-primary text-xl font-black" style={condensed}>{num}</span>
                  </div>
                  {i < 2 && <div className="md:hidden flex-1 h-px bg-border" />}
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl mb-3 tracking-wide" style={condensed}>{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SCOUT ────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <div className="text-primary text-xs tracking-widest mb-4 font-semibold" style={mono}>// AI INTELLIGENCE ENGINE</div>
            <h2 className="text-white text-5xl font-black leading-none mb-6" style={condensed}>YOUR OPPONENT<br /><span className="text-destructive">HAS NO SECRETS.</span></h2>
            <p className="text-muted-foreground leading-relaxed mb-8">The Rivalize AI engine processes every demo tick to build a complete tactical dossier on your opponents — map tendencies, player psychology, economic patterns, and clutch behavior.</p>
            <div className="flex gap-1 mb-6 border border-border bg-muted/20 p-1">
              {(['tside', 'ctside', 'players'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-xs tracking-widest font-semibold transition-all duration-150 ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} style={mono}>
                  {tab === 'tside' ? 'T-SIDE' : tab === 'ctside' ? 'CT-SIDE' : 'PLAYERS'}
                </button>
              ))}
            </div>

            {activeTab === 'tside' && (
              <div className="space-y-3">
                {[
                  { label: 'A-EXECUTE (BANANA PUSH)', freq: '68%', threat: 'HIGH' },
                  { label: 'B-RUSH FIRST 10s',         freq: '22%', threat: 'MED' },
                  { label: 'MID SPLIT',                 freq: '10%', threat: 'LOW' },
                ].map(({ label, freq, threat }) => (
                  <div key={label} className="border border-border bg-card p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs tracking-widest text-foreground font-semibold mb-1" style={mono}>{label}</div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-32 bg-muted"><div className="h-full bg-primary" style={{ width: freq }} /></div>
                        <span className="text-primary text-xs" style={mono}>{freq}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] tracking-widest px-2 py-1 border font-semibold ${threat === 'HIGH' ? 'border-destructive/40 text-destructive bg-destructive/10' : threat === 'MED' ? 'border-yellow-400/40 text-yellow-400 bg-yellow-400/10' : 'border-muted-foreground/30 text-muted-foreground'}`} style={mono}>{threat}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'ctside' && (
              <div className="space-y-3">
                {[
                  { label: 'AGGRESSIVE B-WINDOW PEEK', freq: '54%', threat: 'HIGH' },
                  { label: 'PASSIVE A-SITE HOLD',       freq: '35%', threat: 'MED' },
                  { label: 'STACK B ON PISTOL',          freq: '11%', threat: 'LOW' },
                ].map(({ label, freq, threat }) => (
                  <div key={label} className="border border-border bg-card p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs tracking-widest text-foreground font-semibold mb-1" style={mono}>{label}</div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-32 bg-muted"><div className="h-full bg-primary" style={{ width: freq }} /></div>
                        <span className="text-primary text-xs" style={mono}>{freq}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] tracking-widest px-2 py-1 border font-semibold ${threat === 'HIGH' ? 'border-destructive/40 text-destructive bg-destructive/10' : threat === 'MED' ? 'border-yellow-400/40 text-yellow-400 bg-yellow-400/10' : 'border-muted-foreground/30 text-muted-foreground'}`} style={mono}>{threat}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'players' && (
              <div className="space-y-3">
                {playerData.slice(0, 3).map((p) => (
                  <div key={p.name} className="border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-white font-bold text-sm" style={condensed}>{p.name}</span>
                        <span className="ml-2 text-muted-foreground text-[10px] tracking-widest" style={mono}>{p.role}</span>
                      </div>
                      <span className="text-accent font-bold text-sm" style={mono}>{p.rating}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'K/D', val: p.kd }, { label: 'HS%', val: `${p.hs}%` }, { label: 'CLUTCH%', val: `${p.clutch}%` }].map(({ label, val }) => (
                        <div key={label}>
                          <div className="text-[9px] tracking-widest text-muted-foreground mb-0.5" style={mono}>{label}</div>
                          <div className="text-foreground text-sm font-semibold">{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Heatmap */}
          <div className="relative">
            <div className="text-muted-foreground text-[10px] tracking-widest mb-3" style={mono}>POSITIONAL HEATMAP // MIRAGE · A-SITE · 47 DEMOS</div>
            <div className="border border-border bg-card p-4 overflow-hidden">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
                {heatmapGrid.map((cell, i) => (
                  <div key={`hm-${i}`} className={`aspect-square ${cellColor[cell]}`} />
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                {[{ label: 'CRITICAL', color: 'bg-red-500/80' }, { label: 'HIGH', color: 'bg-orange-400/60' }, { label: 'MEDIUM', color: 'bg-yellow-400/30' }, { label: 'LOW', color: 'bg-primary/10' }].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 ${color}`} />
                    <span className="text-[9px] tracking-widest text-muted-foreground" style={mono}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-border bg-card p-4 mt-4">
              <div className="text-muted-foreground text-[10px] tracking-widest mb-4" style={mono}>SITE ATTACK DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={siteData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="site" tick={{ fill: '#4a6578', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a6578', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0c1219', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 2, fontSize: 10, fontFamily: 'JetBrains Mono', color: '#c8d8e4' }} />
                  <Bar dataKey="attacks" name="Attacks" radius={0}>
                    {siteData.map((entry, index) => (
                      <Cell key={`landing-site-${entry.site}`} fill={index === 0 ? '#00d4ff' : '#ff3b3b'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROSTER INTELLIGENCE ─────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/10">
        <div className="max-w-7xl mx-auto px-6 py-28">
          <div className="mb-12">
            <div className="text-primary text-xs tracking-widest mb-4 font-semibold" style={mono}>// ROSTER INTELLIGENCE</div>
            <h2 className="text-white text-5xl font-black leading-none" style={condensed}>KNOW THEIR ROSTER<br /><span className="text-muted-foreground font-normal">BETTER THAN THEY DO.</span></h2>
          </div>
          <div className="border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-6 py-3 flex items-center justify-between">
              <span className="text-[10px] tracking-widest text-muted-foreground" style={mono}>PLAYER_INTELLIGENCE // NATUS_VINCERE · DUST2 · 12 DEMOS</span>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] tracking-widest text-yellow-400" style={mono}>3 CRITICAL PATTERNS</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {['PLAYER', 'ROLE', 'RATING', 'K/D', 'HS%', 'CLUTCH%', 'THREAT'].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-[9px] tracking-widest text-muted-foreground font-semibold" style={mono}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playerData.map((p, i) => (
                    <tr key={p.name} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${i === 0 ? 'bg-destructive/5' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {i === 0 && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                          <span className="text-white font-semibold">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-[10px] tracking-widest text-muted-foreground border border-border px-2 py-0.5" style={mono}>{p.role}</span></td>
                      <td className="px-6 py-4"><span className={`font-bold ${p.rating >= 1.3 ? 'text-destructive' : p.rating >= 1.2 ? 'text-yellow-400' : 'text-accent'}`} style={mono}>{p.rating}</span></td>
                      <td className="px-6 py-4 text-foreground font-medium" style={mono}>{p.kd}</td>
                      <td className="px-6 py-4 text-foreground" style={mono}>{p.hs}%</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-20 bg-muted"><div className={`h-full ${p.clutch >= 65 ? 'bg-destructive' : p.clutch >= 55 ? 'bg-yellow-400' : 'bg-accent'}`} style={{ width: `${p.clutch}%` }} /></div>
                          <span className="text-[10px] text-muted-foreground" style={mono}>{p.clutch}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] tracking-widest px-2 py-1 border font-semibold ${i === 0 ? 'border-destructive/40 text-destructive bg-destructive/10' : i <= 2 ? 'border-yellow-400/40 text-yellow-400 bg-yellow-400/10' : 'border-muted-foreground/30 text-muted-foreground'}`} style={mono}>
                          {i === 0 ? 'CRITICAL' : i <= 2 ? 'HIGH' : 'MED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-px bg-border">
          {[
            { quote: "We uploaded NaVi's last 10 demos before ESL. Rivalize found a B-rush pattern they'd used in 7 of them. We held B with 5 that round.", author: 'IGL, Team Falcons', stars: 5 },
            { quote: "The heatmaps are insane. Within 20 minutes of uploading I knew exactly where their AWPer defaulted on CT-side Mirage.",                author: 'Coach, MOUZ',        stars: 5 },
            { quote: "This is the kind of tool tier-1 orgs have had internally for years. Now it's available to everyone. Game changer.",                    author: 'Analyst, OG',         stars: 5 },
          ].map(({ quote, author, stars }) => (
            <div key={author} className="bg-card p-8">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={`star-${author}-${i}`} className="w-3 h-3 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed text-sm mb-6">&ldquo;{quote}&rdquo;</p>
              <span className="text-muted-foreground text-[10px] tracking-widest" style={mono}>— {author}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
        <div className="relative max-w-3xl mx-auto px-6 py-28 text-center">
          <div className="text-primary text-xs tracking-widest mb-6 font-semibold" style={mono}>// READY TO SCOUT</div>
          <h2 className="text-white text-6xl font-black leading-none mb-6" style={condensed}>STOP WALKING IN BLIND.</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">Join 600+ teams using Rivalize to turn opponent demos into competitive advantage. Free for the first 3 analyses.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup" className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-10 py-4 text-sm tracking-widest hover:bg-primary/90 transition-all group">
              CREATE FREE ACCOUNT <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button className="flex items-center gap-2 border border-border text-muted-foreground font-medium px-10 py-4 text-sm tracking-widest hover:border-primary/50 hover:text-primary transition-all">BOOK A DEMO</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Crosshair className="text-primary w-4 h-4" strokeWidth={1.5} />
                <span className="text-white font-bold tracking-widest text-sm" style={condensed}>RIVALIZE</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">AI-powered opponent analysis for competitive CS2 teams. Upload demos, get intel, win matches.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {[
                { heading: 'PRODUCT', links: ['Features', 'How It Works', 'Pricing', 'Changelog'] },
                { heading: 'COMPANY', links: ['About', 'Blog', 'Careers', 'Contact'] },
                { heading: 'LEGAL',   links: ['Privacy', 'Terms', 'Cookies'] },
              ].map(({ heading, links }) => (
                <div key={heading}>
                  <div className="text-[9px] tracking-widest text-muted-foreground font-semibold mb-4" style={mono}>{heading}</div>
                  <ul className="space-y-2">
                    {links.map((l) => (
                      <li key={l}><a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">{l}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-muted-foreground text-[10px] tracking-widest" style={mono}>© 2025 RIVALIZE. ALL RIGHTS RESERVED.</span>
            <span className="text-muted-foreground text-[10px] tracking-widest" style={mono}>NOT AFFILIATED WITH VALVE CORPORATION.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
