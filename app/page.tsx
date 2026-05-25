import Link from 'next/link'
import {
  Upload, Brain, Users, Map, Target, BarChart3,
  ChevronRight, Shield, Zap, Trophy, ArrowRight,
  Activity, Crosshair, TrendingUp
} from 'lucide-react'

const features = [
  {
    icon: Upload,
    title: 'Opponent Demo Upload',
    description: 'Drag and drop your upcoming opponent\'s .dem files. We parse every round, player action, and economy state to build a scouting profile.',
    badge: 'Core',
  },
  {
    icon: Brain,
    title: 'AI Anti-Strat Generator',
    description: 'Get AI-generated anti-strats, opponent tendency reports, and recommended counters tailored to your next match.',
    badge: 'AI',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Create your team, add upcoming opponents, and keep all your scouting data organised before match day.',
    badge: 'Teams',
  },
  {
    icon: Map,
    title: 'Opponent Heatmaps',
    description: 'Visualize where the opponent positions, holds angles, and dies — so you know exactly what to expect.',
    badge: 'Visual',
  },
  {
    icon: Target,
    title: 'Weak Spot Detection',
    description: 'Automatically identify predictable opponent patterns, slow rotations, and exploitable setups across all their demos.',
    badge: 'Strategy',
  },
  {
    icon: BarChart3,
    title: 'Round Breakdown',
    description: 'Review opponent round-by-round with timeline playback, economy tracking, and key moment highlights.',
    badge: 'Analytics',
  },
]

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Opponent Demos',
    description: 'Get your upcoming opponent\'s .dem files and drop them into Rivalize. We parse every tick, position, and round automatically.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'AI Scouts the Opponent',
    description: 'Our AI builds a full scouting report — tendencies, weak spots, predictable executes, key players — ready before match day.',
  },
  {
    number: '03',
    icon: Trophy,
    title: 'Show Up Prepared',
    description: 'Walk into your match with AI-generated anti-strats, player breakdowns, and map-specific counter-plays already in hand.',
  },
]

const stats = [
  { value: '10K+', label: 'Opponents Scouted' },
  { value: '500+', label: 'Active Teams' },
  { value: '99.9%', label: 'Parse Accuracy' },
  { value: '24/7', label: 'AI Scout Online' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080b0f] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#080b0f]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00ff87] rounded-md flex items-center justify-center flex-shrink-0">
              <span className="text-black font-black text-sm">R</span>
            </div>
            <span className="text-xl font-black tracking-tight">RIVALIZE</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-[#00ff87] text-black px-4 py-2 rounded-md hover:bg-[#00ff87]/90 transition-all neon-glow"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#00ff87]/5 rounded-full blur-3xl" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-blue-500/3 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-[300px] h-[300px] bg-purple-500/3 rounded-full blur-3xl" />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,255,135,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,135,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ff87]/20 bg-[#00ff87]/5 text-[#00ff87] text-xs font-semibold mb-8 tracking-wide uppercase">
            <Activity className="w-3 h-3" />
            AI-Powered CS2 Pre-Match Preparation
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.05]">
            Scout your opponents.{' '}
            <span
              className="text-[#00ff87] neon-text"
              style={{ textShadow: '0 0 40px rgba(0,255,135,0.4), 0 0 80px rgba(0,255,135,0.2)' }}
            >
              Anti-strat
            </span>
            {' '}with{' '}
            <br className="hidden md:block" />
            <span className="text-white/90">AI.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your upcoming opponent&apos;s demos and get instant AI-generated anti-strats,
            scouting reports, and weak-spot breakdowns. Stop guessing. Show up prepared.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 bg-[#00ff87] text-black font-bold px-8 py-4 rounded-md hover:bg-[#00ff87]/90 transition-all text-base neon-glow"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-white/10 bg-white/5 text-white/80 font-medium px-8 py-4 rounded-md hover:bg-white/10 hover:border-white/20 hover:text-white transition-all text-base"
            >
              Sign In
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Hero visual — mock dashboard card */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00ff87]/20 via-transparent to-[#00ff87]/10 rounded-xl blur-xl" />
            <div className="relative glass-card rounded-xl overflow-hidden border border-white/10">
              {/* Mock toolbar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-[#00ff87]/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="text-xs text-white/30 font-mono">rivalize.pro/dashboard</div>
                </div>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/80">Recent Analysis</span>
                    <span className="text-xs text-[#00ff87] font-medium">Live</span>
                  </div>
                  {[
                    { map: 'de_dust2', rating: 87, result: 'W', kills: 24, deaths: 14 },
                    { map: 'de_mirage', rating: 72, result: 'L', kills: 17, deaths: 19 },
                    { map: 'de_inferno', rating: 91, result: 'W', kills: 28, deaths: 12 },
                  ].map((match, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <span className={`text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${match.result === 'W' ? 'bg-[#00ff87]/20 text-[#00ff87]' : 'bg-red-500/20 text-red-400'}`}>
                        {match.result}
                      </span>
                      <span className="text-sm font-mono text-white/70 flex-1">{match.map}</span>
                      <span className="text-xs text-white/40">{match.kills}/{match.deaths}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00ff87] rounded-full" style={{ width: `${match.rating}%` }} />
                        </div>
                        <span className="text-xs text-[#00ff87] font-mono w-8">{match.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#00ff87]/5 border border-[#00ff87]/10">
                    <div className="text-xs text-white/40 mb-1">AI Rating</div>
                    <div className="text-2xl font-black text-[#00ff87]">83.4</div>
                    <div className="text-xs text-white/30 mt-1">+4.2 this week</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs text-white/40 mb-1">HLTV Rating</div>
                    <div className="text-xl font-black text-white">1.24</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs text-white/40 mb-1">HS%</div>
                    <div className="text-xl font-black text-white">54%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs text-white/40 mb-2">AI Tip</div>
                    <div className="text-xs text-white/60 leading-relaxed">Improve utility usage on B site — Flash before crossing.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section id="stats" className="py-12 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-[#00ff87] mb-1 neon-text">
                  {stat.value}
                </div>
                <div className="text-sm text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ff87]/20 bg-[#00ff87]/5 text-[#00ff87] text-xs font-semibold mb-4 tracking-wide uppercase">
              <Zap className="w-3 h-3" />
              Platform Features
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Everything you need to prepare
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              From raw opponent demo files to match-ready anti-strats. Every tool a coachless team needs to outplay the competition.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={i}
                  className="group relative p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#00ff87]/20 transition-all duration-300 cursor-default"
                >
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,255,135,0.04) 0%, transparent 60%)' }}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[#00ff87]/10 border border-[#00ff87]/20 flex items-center justify-center group-hover:bg-[#00ff87]/15 transition-colors">
                        <Icon className="w-5 h-5 text-[#00ff87]" />
                      </div>
                      <span className="text-xs font-semibold text-white/30 border border-white/10 px-2 py-0.5 rounded-full">
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-white group-hover:text-[#00ff87] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ff87]/20 bg-[#00ff87]/5 text-[#00ff87] text-xs font-semibold mb-4 tracking-wide uppercase">
              <Shield className="w-3 h-3" />
              How It Works
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Three steps to match-day edge
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Upload, scout, and show up prepared — in minutes.
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connector lines (desktop) */}
            <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-[#00ff87]/30 via-[#00ff87]/10 to-[#00ff87]/30" />

            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="relative text-center group">
                  <div className="relative inline-flex mb-6">
                    <div className="w-24 h-24 rounded-full border-2 border-[#00ff87]/20 bg-[#00ff87]/5 flex flex-col items-center justify-center group-hover:border-[#00ff87]/50 group-hover:bg-[#00ff87]/10 transition-all duration-300">
                      <Icon className="w-8 h-8 text-[#00ff87] mb-1" />
                      <span className="text-xs font-black text-[#00ff87]/60">{step.number}</span>
                    </div>
                    <div className="absolute -inset-2 rounded-full bg-[#00ff87]/5 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-300" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">{step.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Feature Highlight — AI Coach */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ff87]/20 bg-[#00ff87]/5 text-[#00ff87] text-xs font-semibold mb-6 tracking-wide uppercase">
                <Brain className="w-3 h-3" />
                AI Coach
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                Your{' '}
                <span className="text-[#00ff87] neon-text">AI scout</span>,
                {' '}ready before every match
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Rivalize's AI digs through opponent demos — analysing tendencies, flagging weak spots,
                and generating anti-strats — so your team walks in with a real game plan.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Opponent T-side and CT-side tendencies by map",
                  'Predictable execute patterns and timing tells',
                  'Key player profiles — habits, angles, and how to counter them',
                  'Recommended map bans based on opponent performance',
                  'AI-generated anti-strats and counter-setups',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                    <div className="w-5 h-5 rounded-full bg-[#00ff87]/15 border border-[#00ff87]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff87]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[#00ff87] text-black font-bold px-6 py-3 rounded-md hover:bg-[#00ff87]/90 transition-all neon-glow"
              >
                Start Scouting Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* AI Chat mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-[#00ff87]/5 rounded-2xl blur-2xl" />
              <div className="relative glass-card rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="w-6 h-6 rounded-full bg-[#00ff87]/20 border border-[#00ff87]/30 flex items-center justify-center">
                    <Brain className="w-3 h-3 text-[#00ff87]" />
                  </div>
                  <span className="text-sm font-semibold text-white">Rivalize AI</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse" />
                    <span className="text-xs text-[#00ff87]">Online</span>
                  </div>
                </div>
                <div className="p-4 space-y-4 min-h-[320px]">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00ff87]/15 border border-[#00ff87]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg rounded-tl-none bg-white/5 border border-white/5 text-sm text-white/70 leading-relaxed">
                      Analysis complete for <strong className="text-white">de_inferno — Round 14</strong>. I found 3 critical positioning errors that cost you the round.
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00ff87]/15 border border-[#00ff87]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg rounded-tl-none bg-white/5 border border-white/5 text-sm text-white/70 leading-relaxed">
                      <span className="text-[#00ff87] font-semibold">Positioning:</span> At 1:42, you peeked banana without a flash. The CT had a pre-aim on that angle — a blind throw would have won the duel.
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="flex-1 max-w-[80%] p-3 rounded-lg rounded-tr-none bg-[#00ff87]/10 border border-[#00ff87]/20 text-sm text-white/80 leading-relaxed">
                      What flash should I have used there?
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Crosshair className="w-3.5 h-3.5 text-white/50" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00ff87]/15 border border-[#00ff87]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg rounded-tl-none bg-white/5 border border-white/5 text-sm text-white/70 leading-relaxed">
                      A <strong className="text-white">one-way popflash</strong> from the left side of CT steps — it blinds the banana angle for 2.8s without blinding you. I'll show you the exact throw in the heatmap view.
                    </div>
                  </div>
                  {/* Typing indicator */}
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#00ff87]/15 border border-[#00ff87]/20 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-3.5 h-3.5 text-[#00ff87]" />
                    </div>
                    <div className="p-3 rounded-lg rounded-tl-none bg-white/5 border border-white/5">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary Feature Highlight — Team Management */}
      <section className="py-24 px-6 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Team stats mockup */}
            <div className="relative order-2 md:order-1">
              <div className="absolute -inset-4 bg-blue-500/5 rounded-2xl blur-2xl" />
              <div className="relative glass-card rounded-xl border border-white/10 overflow-hidden p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-lg font-bold text-white">Team NaVi Rivals</div>
                    <div className="text-sm text-white/40">5 members · Active</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-[#00ff87]">78.3</div>
                    <div className="text-xs text-white/40">Team Rating</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 's1mple_fan', role: 'IGL', rating: 1.31, ratingPct: 88, trend: '+0.08' },
                    { name: 'perfectAim99', role: 'AWP', rating: 1.28, ratingPct: 84, trend: '+0.12' },
                    { name: 'util_king', role: 'Support', rating: 1.14, ratingPct: 72, trend: '-0.02' },
                    { name: 'entryfragger', role: 'Entry', rating: 1.09, ratingPct: 68, trend: '+0.05' },
                    { name: 'lurk_master', role: 'Lurker', rating: 1.07, ratingPct: 65, trend: '+0.01' },
                  ].map((player, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00ff87]/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {player.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{player.name}</div>
                        <div className="text-xs text-white/40">{player.role}</div>
                      </div>
                      <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00ff87] rounded-full" style={{ width: `${player.ratingPct}%` }} />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-mono text-white">{player.rating}</div>
                        <div className={`text-xs font-mono ${player.trend.startsWith('+') ? 'text-[#00ff87]' : 'text-red-400'}`}>{player.trend}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-400/20 bg-blue-400/5 text-blue-400 text-xs font-semibold mb-6 tracking-wide uppercase">
                <Users className="w-3 h-3" />
                Team Management
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
                One dashboard for all your{' '}
                <span className="text-[#00ff87] neon-text">upcoming opponents</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Organise opponent scouting by team and match. Every opponent gets their own folder — demos, stats, and AI reports — ready whenever you need them.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: TrendingUp, label: 'Opponent Folders', desc: 'Demos grouped per opponent' },
                  { icon: Target, label: 'Role Breakdowns', desc: 'AWP, entry, IGL profiling' },
                  { icon: Shield, label: 'Scouting Reports', desc: 'AI summaries before each match' },
                  { icon: Activity, label: 'Match History', desc: 'All opponents in one place' },
                ].map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="p-4 rounded-lg bg-white/[0.03] border border-white/5">
                      <Icon className="w-4 h-4 text-[#00ff87] mb-2" />
                      <div className="text-sm font-semibold text-white mb-0.5">{item.label}</div>
                      <div className="text-xs text-white/40">{item.desc}</div>
                    </div>
                  )
                })}
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 border border-white/10 bg-white/5 text-white font-semibold px-6 py-3 rounded-md hover:bg-white/10 hover:border-white/20 transition-all"
              >
                Create Your Team
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-8 bg-[#00ff87]/5 rounded-3xl blur-3xl" />
            <div className="relative p-12 rounded-2xl border border-[#00ff87]/15 bg-white/[0.02]"
              style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,135,0.04) 0%, transparent 70%)' }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00ff87]/20 bg-[#00ff87]/5 text-[#00ff87] text-xs font-semibold mb-6 tracking-wide uppercase">
                <Trophy className="w-3 h-3" />
                Start for Free
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                Ready to{' '}
                <span className="text-[#00ff87] neon-text">dominate</span>?
              </h2>
              <p className="text-white/50 text-xl mb-10 max-w-xl mx-auto leading-relaxed">
                Join teams using Rivalize to scout opponents and show up prepared every match.
                No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 bg-[#00ff87] text-black font-bold px-10 py-4 rounded-md hover:bg-[#00ff87]/90 transition-all text-lg neon-glow"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-base font-medium"
                >
                  Already have an account? Sign in
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-6 text-white/30 text-sm">
                Free plan includes 5 opponent demo uploads/month. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#00ff87] rounded flex items-center justify-center">
                <span className="text-black font-black text-xs">R</span>
              </div>
              <span className="font-black tracking-tight text-white">RIVALIZE</span>
              <span className="text-white/20 text-sm ml-2">AI-Powered CS2 Pre-Match Prep</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-white/30">
              <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
              <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
              <span>© 2025 Rivalize. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
