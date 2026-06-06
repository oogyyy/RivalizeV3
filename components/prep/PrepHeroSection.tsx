'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { TeamFolder } from '@/types/database';
import OpponentSelector from './OpponentSelector';

interface PrepHeroSectionProps {
  allOpponents: TeamFolder[];
  defaultOpponent?: TeamFolder | null;
  mapWinRates: Record<string, number>;
  activeDutyMaps: Array<{ key: string; name: string }>;
}

export default function PrepHeroSection({
  allOpponents,
  defaultOpponent,
  mapWinRates,
  activeDutyMaps,
}: PrepHeroSectionProps) {
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    defaultOpponent?.id ?? null
  );
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);

  const selectedOpponent = allOpponents.find(o => o.id === selectedOpponentId);
  const showRates = selectedOpponent != null;

  return (
    <div className="rv-panel" style={{ position: 'relative', padding: '22px 26px 24px', background: 'radial-gradient(820px 380px at 92% -40%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%), radial-gradient(620px 300px at 4% -30%, color-mix(in srgb, var(--loss) 5%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--card)), var(--card))', borderColor: 'color-mix(in srgb, var(--accent) 18%, var(--border))' }}>
      <span className="rv-tick rv-tick-tl" /><span className="rv-tick rv-tick-br" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>Next Match</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.025em', lineHeight: 1, marginBottom: 8 }}>
            {selectedOpponent ? selectedOpponent.opponent_display_name : 'No opponent selected'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {selectedDateTime
              ? `Scheduled for ${selectedDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : selectedOpponent
                ? 'Match scheduled'
                : 'Select an opponent to begin prep'}
          </p>

          {/* Map Pool */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
              Map Pool{showRates ? ' Win Rates' : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {activeDutyMaps.map(({ key, name }) => {
                const rate = mapWinRates[key]
                const hasRate = showRates && rate !== undefined
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--card-2)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {name}
                    </span>
                    {showRates && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: hasRate ? (rate >= 60 ? 'var(--win)' : rate >= 50 ? 'var(--tside)' : 'var(--loss)') : 'var(--faint)' }}>
                        {hasRate ? `${rate}%` : '—'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Opponent Selector Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OpponentSelector
            opponents={allOpponents}
            selectedOpponentId={selectedOpponentId}
            selectedDateTime={selectedDateTime}
            onOpponentChange={setSelectedOpponentId}
            onDateTimeChange={setSelectedDateTime}
          />
          {selectedOpponent && (
            <Link href="/veto">
              <button style={{ height: 36, width: '100%', padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--card-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
                Open Veto <ArrowRight size={13} />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
