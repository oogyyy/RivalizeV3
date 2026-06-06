'use client';

import { useState } from 'react';
import { ChevronDown, Calendar, Clock, X } from 'lucide-react';
import type { TeamFolder } from '@/types/database';

interface OpponentSelectorProps {
  opponents: TeamFolder[];
  selectedOpponentId?: string | null;
  selectedDateTime?: Date | null;
  onOpponentChange?: (opponentId: string | null) => void;
  onDateTimeChange?: (dateTime: Date | null) => void;
}

export default function OpponentSelector({
  opponents,
  selectedOpponentId,
  selectedDateTime,
  onOpponentChange,
  onDateTimeChange,
}: OpponentSelectorProps) {
  const [isOpponentDropdownOpen, setIsOpponentDropdownOpen] = useState(false);
  const [isDateTimeOpen, setIsDateTimeOpen] = useState(false);
  const [localDateTime, setLocalDateTime] = useState(
    selectedDateTime ? selectedDateTime.toISOString().slice(0, 16) : ''
  );

  const selectedOpponent = opponents.find(o => o.id === selectedOpponentId);

  const handleOpponentSelect = (opponentId: string) => {
    onOpponentChange?.(opponentId);
    setIsOpponentDropdownOpen(false);
  };

  const handleClearOpponent = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpponentChange?.(null);
  };

  const handleDateTimeChange = (dateTimeStr: string) => {
    setLocalDateTime(dateTimeStr);
    if (dateTimeStr) {
      onDateTimeChange?.(new Date(dateTimeStr));
    }
  };

  const handleClearDateTime = () => {
    setLocalDateTime('');
    onDateTimeChange?.(null);
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-3">
      {/* Opponent Selector */}
      <div className="relative">
        <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-2">
          Select Opponent
        </div>
        <button
          onClick={() => setIsOpponentDropdownOpen(!isOpponentDropdownOpen)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-border/60 bg-brand-card hover:border-brand-border text-left transition"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {selectedOpponent ? (
              <>
                <div className="w-8 h-8 rounded-full bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-purple">
                    {selectedOpponent.opponent_display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {selectedOpponent.opponent_display_name}
                  </p>
                </div>
              </>
            ) : (
              <span className="text-sm text-gray-400">No opponent selected</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedOpponent && (
              <button
                onClick={handleClearOpponent}
                className="p-1 hover:bg-white/10 rounded transition"
                title="Clear selection"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition ${
                isOpponentDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Dropdown menu */}
        {isOpponentDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-brand-card border border-brand-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {opponents.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-400">
                No opponents found
              </div>
            ) : (
              opponents.map(opponent => (
                <button
                  key={opponent.id}
                  onClick={() => handleOpponentSelect(opponent.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left border-b border-brand-border/40 hover:bg-white/5 transition ${
                    selectedOpponentId === opponent.id ? 'bg-brand-purple/10' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-purple">
                      {opponent.opponent_display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {opponent.opponent_display_name}
                    </p>
                    {typeof opponent.aggregated_stats === 'object' && opponent.aggregated_stats && 'wins' in opponent.aggregated_stats && (
                      <p className="text-xs text-gray-400">
                        {(opponent.aggregated_stats as any).wins}W – {(opponent.aggregated_stats as any).losses}L
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Date/Time Picker */}
      {selectedOpponent && (
        <div className="relative">
          <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-2">
            Match Time (Optional)
          </div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={localDateTime}
              onChange={e => handleDateTimeChange(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-lg border border-brand-border/60 bg-brand-card text-white text-sm placeholder-gray-500 focus:outline-none focus:border-brand-purple/60 transition"
            />
            {localDateTime && (
              <button
                onClick={handleClearDateTime}
                className="px-3 py-2.5 rounded-lg border border-brand-border/60 bg-brand-card hover:bg-brand-bg text-gray-400 hover:text-gray-300 transition flex items-center justify-center"
                title="Clear date/time"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {selectedDateTime && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Match scheduled for: {formatDateTime(selectedDateTime)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
