export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Crosshair, Layers, Target, Shield, Activity, Brain, Sparkles, BookOpen, Swords } from 'lucide-react'
import type { AggregatedStats, TeamFolder } from '@/types/database'
import PrepHeroSection from '@/components/prep/PrepHeroSection'

const BRIEF_ITEMS = [
  { icon: Layers,    color: 'var(--ct)',     title: 'Map Control:',      text: 'Prioritize mid-control early and deny enemy rotations.' },
  { icon: Target,    color: 'var(--signal)', title: 'Entry Fragger:',    text: 'Watch for aggressive lurker plays in connector and underpass.' },
  { icon: Crosshair, color: 'var(--pink)',   title: 'AWP Positioning:',  text: 'Their AWPer holds passive long angles on T-side post-plant.' },
  { icon: Activity,  color: 'var(--tside)',  title: 'High Threat:',       text: 'Strong utility usage on T-side execute attempts.' },
  { icon: Shield,    color: 'var(--win)',    title: 'Counter-Strat:',     text: 'Focus on defensive stacks and fast rotations based on info.' },
]

const MAP_POOL_WIN = [
  { name: 'Mirage', win: 67 }, { name: 'Inferno', win: 45 }, { name: 'Nuke', win: 72 },
  { name: 'Ancient', win: 58 }, { name: 'Overpass', win: 50 }, { name: 'Anubis', win: 63 }, { name: 'Vertigo', win: 55 },
]

export default async function PrepPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map(m => m.team_id).filter(Boolean)

  const { data: folders } = teamIds.length
    ? await admin
        .from('team_folders')
        .select('id, opponent_display_name, opponent_slug, aggregated_stats')
        .in('user_team_id', teamIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  type FolderRow = TeamFolder
  const typedFolders = (folders ?? []) as FolderRow[]
  const nextOpponent = typedFolders[0] ?? null

  return (
    <div className="p-5 md:p-7 flex flex-col gap-4 max-w-7xl">

      {/* Hero */}
      <PrepHeroSection
        allOpponents={typedFolders}
        defaultOpponent={nextOpponent}
        mapPoolWin={MAP_POOL_WIN}
      />

      {/* AI Brief */}
      <div style={{ padding: '18px 20px 16px', position: 'relative', borderRadius: 'var(--radius)', border: '1px solid color-mix(in srgb, var(--signal) 24%, transparent)', background: 'radial-gradient(480px 250px at 8% -24%, color-mix(in srgb, var(--signal) 11%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--signal) 2.5%, var(--card)), var(--card))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>AI Brief</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6, background: 'rgba(34,211,238,.1)', border: '1px solid rgba(34,211,238,.3)', fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--signal)', letterSpacing: '0.06em' }}>✦ AI INSIGHT</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {BRIEF_ITEMS.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 10, background: 'var(--card-2)', border: '1px solid var(--border)' }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${b.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${b.color} 35%, transparent)` }}>
                <b.icon size={13} style={{ color: b.color }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>{b.title}</span>{' '}
                  <span style={{ color: 'var(--muted)' }}>{b.text}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, fontFamily: 'var(--font-mono)' }}>Last updated 2 hours ago</p>
      </div>

      {/* Bottom 3-col: Map Strategy, Veto Plan, Tools */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* Map strategy */}
        <div className="rv-panel" style={{ padding: '18px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Map Strategy</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            <span style={{ color: 'var(--ct)' }}>CT</span>
            <span style={{ color: 'var(--tside)' }}>T</span>
          </div>
          <div style={{ height: 6, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 18 }}>
            <div style={{ width: '52%', background: 'linear-gradient(90deg, #4d83e6, var(--ct))' }} />
            <div style={{ flex: 1, background: 'linear-gradient(90deg, var(--tside), #e09a2e)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { map: 'Mirage', text: 'Favors A-site executes with early mid control.' },
              { map: 'Inferno', text: 'Passive CT anchors. Fast banana control opens the map.' },
              { map: 'Nuke', text: 'Strong retakes. Focus on outside control denial.' },
            ].map((n, i) => (
              <div key={i}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--signal)', marginBottom: 4 }}>{n.map}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Veto plan */}
        <div className="rv-panel" style={{ padding: '18px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Veto Plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { kind: 'Ban',  title: 'Ban: Nuke',     sub: '71% loss rate', color: 'var(--loss)', text: 'Remove it early to protect the series.' },
              { kind: 'Ban',  title: 'Ban: Overpass',  sub: 'weak T-side',  color: 'var(--loss)', text: 'Our T-side conversion is low here.' },
              { kind: 'Pick', title: 'Pick: Mirage',   sub: '67% win rate', color: 'var(--win)',  text: 'Our strongest map — pick to set tempo.' },
            ].map((v, i) => (
              <div key={i} style={{ padding: '11px 13px', borderRadius: 10, background: `linear-gradient(180deg, color-mix(in srgb, ${v.color} 8%, var(--card-2)), var(--card-2))`, border: `1px solid color-mix(in srgb, ${v.color} 30%, transparent)`, borderLeft: `3px solid ${v.color}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{v.title} <span style={{ color: v.color, fontWeight: 600, fontSize: 11 }}>({v.sub})</span></p>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 4 }}>{v.text}</p>
              </div>
            ))}
          </div>
          <Link href="/veto">
            <button style={{ marginTop: 14, width: '100%', padding: '9px', borderRadius: 9, background: 'var(--card-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Open Veto Simulator <ArrowRight size={13} />
            </button>
          </Link>
        </div>

        {/* Quick tools */}
        <div className="rv-panel" style={{ padding: '18px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Prep Tools</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/ai-coach', Icon: Brain,    color: 'var(--signal)',  label: 'AI Scout',         desc: 'Ask about your opponent' },
              { href: '/veto',     Icon: Swords,   color: 'var(--accent)',  label: 'Veto Simulator',   desc: 'Practice map vetoing' },
              { href: '/playbook', Icon: BookOpen, color: 'var(--tside)',   label: 'Playbook',         desc: 'Review your strategies' },
              { href: '/lineups',  Icon: Sparkles, color: 'var(--ct)',      label: 'Lineups',          desc: 'Utility lineup library' },
            ].map(({ href, Icon, color, label, desc }) => (
              <Link key={href} href={href}>
                <div className="rv-row" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</p>
                  </div>
                  <ArrowRight size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
