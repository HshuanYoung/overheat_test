import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card as CardType, Rarity } from '../types/game';
import { clsx } from 'clsx';
import { Sword, Shield, Zap, Info, Star, X, Plus } from 'lucide-react';
import { getCardImageUrl } from '../lib/utils';

interface CardProps {
  card?: CardType;
  onClick?: () => void;
  className?: string;
  showDetails?: boolean;
  count?: number;
  isBack?: boolean;
  isExhausted?: boolean;
  disableZoom?: boolean;
  statusBorder?: 'red' | 'blue';
}

const getRarityClass = (rarity: Rarity) => {
  switch (rarity) {
    case 'C':
    case 'U': return 'rarity-border-cu';
    case 'R': return 'rarity-border-r';
    case 'SR': return 'rarity-border-sr';
    case 'UR': return 'rarity-border-ur';
    case 'SER': return 'rarity-border-ser';
    case 'PR': return 'rarity-border-pr';
    default: return 'border-zinc-700';
  }
};

export const CardComponent: React.FC<CardProps> = ({ card, onClick, className, count, isBack, disableZoom, statusBorder, isExhausted }) => {
  if (isBack || !card) {
    return (
      <motion.div
        layout
        className={clsx(
          "relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 border-zinc-700 cursor-default bg-zinc-900 shadow-xl",
          className
        )}
      >
        <img
          src="/assets/card_bg.jpg"
          alt="Card Back"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/20" />
      </motion.div>
    );
  }

  const isNegativeCost = card.acValue < 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Zoom logic removed
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  const imageUrl = card.imageUrl || getCardImageUrl(card.id, card.rarity, true);
  const fullImageUrl = card.fullImageUrl || getCardImageUrl(card.id, card.rarity, false);

  return (
    <>
      <motion.div
        layout
        animate={{ rotate: isExhausted ? 90 : 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCardClick}
        className={clsx(
          "relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 cursor-pointer group transition-all bg-zinc-900",
          statusBorder === 'red' ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" :
            statusBorder === 'blue' ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" :
              getRarityClass(card.rarity),
          className
        )}
      >
        {/* Card Image - Always show thumbnail in preview */}
        <img
          src={imageUrl}
          alt={fullImageUrl}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        {/* Top Right: Access Cost (Ac值) */}
        <div className="absolute top-2 right-2">
          <div className={clsx(
            "w-10 h-10 rounded-lg border-2 flex flex-col items-center justify-center font-black text-lg shadow-xl",
            isNegativeCost ? "bg-blue-900/90 border-blue-400 text-blue-100" : "bg-red-900/90 border-red-400 text-red-100"
          )}>
            <span className="text-[8px] leading-none opacity-70 uppercase">Ac</span>
            <span className="leading-none">{card.acValue > 0 ? `+${card.acValue}` : card.acValue}</span>
          </div>
        </div>

        {/* Bottom Stats: Damage and Power (伤害和力量) */}
        {card.type === 'UNIT' && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-blue-900/80 px-2 py-1 rounded border border-blue-400/50 shadow-lg">
              <span className="text-xs font-black text-blue-100">{card.damage}</span>
              <Sword className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="flex items-center gap-1 bg-zinc-900/90 px-2 py-1 rounded border border-white/20 shadow-lg">
              <span className="font-mono text-xs font-bold text-white tracking-tighter">{card.power}</span>
            </div>
          </div>
        )}

        {/* God Mark (神蚀标记) */}
        {card.godMark && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div className="w-7 h-7 rounded-full bg-zinc-950 border-2 border-red-500 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.6)]">
              <Zap className="w-4 h-4 text-red-500 fill-red-500" />
            </div>
          </div>
        )}

        {/* Action Button (e.g. Add to Deck) */}
        {onClick && (
          <button
            onClick={handleActionClick}
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-red-600 border border-white/20 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Count Badge (for deck builder) */}
        {count !== undefined && count > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-xs font-bold z-10 shadow-lg">
            {count}
          </div>
        )}
      </motion.div>
    </>
  );
};
