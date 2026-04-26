import React from 'react';
import { Card } from '../types/game';
import { getCardKeywords } from '../lib/cardKeywords';
import { cn } from '../lib/utils';

interface KeywordBadgesProps {
  card?: Card | null;
  className?: string;
  variant?: 'compact' | 'detail';
}

export const KeywordBadges: React.FC<KeywordBadgesProps> = ({ card, className, variant = 'compact' }) => {
  const keywords = getCardKeywords(card);

  if (keywords.length === 0) {
    return null;
  }

  const isDetail = variant === 'detail';

  return (
    <div className={cn(isDetail ? 'flex flex-wrap gap-2' : 'flex flex-col items-end gap-0.5', className)}>
      {keywords.map(keyword => (
        <div key={keyword.id} className="group relative">
          <div
            className={cn(
              'border border-white/20 shadow-lg',
              isDetail
                ? 'flex items-center gap-2 rounded-xl bg-[#4a0d4a]/90 px-3 py-2'
                : 'flex h-4 w-4 items-center justify-center rounded-md bg-[#4a0d4a] md:h-5 md:w-5'
            )}
          >
            <span className={cn('font-black italic text-white', isDetail ? 'text-xs' : 'text-[8px] md:text-[10px]')}>
              {keyword.shortLabel}
            </span>
            {isDetail && (
              <span className="text-xs font-black tracking-wide text-white">
                {keyword.label}
              </span>
            )}
          </div>

          {isDetail && (
            <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-64 rounded-xl border border-white/10 bg-black/95 p-3 text-left shadow-2xl group-hover:block">
              <div className="mb-1 text-xs font-black tracking-wide text-white">
                {keyword.label}
              </div>
              <div className="text-[11px] leading-relaxed text-zinc-300">
                {keyword.description}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
