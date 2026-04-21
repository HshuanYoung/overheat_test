import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card as CardType, Rarity } from '../types/game';
import { clsx } from 'clsx';
import { Sword, Shield, Zap, Info, Star, X, Plus } from 'lucide-react';
import { cn, getCardImageUrl } from '../lib/utils';

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
  displayMode?: 'deck' | 'unit' | 'erosion_item' | 'hand' | 'none';
  cardBackUrl?: string;
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

export const CardComponent: React.FC<CardProps> = ({ card, onClick, className, count, isBack, disableZoom, statusBorder, isExhausted, displayMode, cardBackUrl }) => {
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
          src={cardBackUrl || "/assets/card_bg/default_card_bg.jpg"}
          alt="卡背"
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
  const exhausted = isExhausted ?? !!card.isExhausted;

  const showStats = displayMode !== 'erosion_item' && displayMode !== 'none';
  const showAC = showStats && (displayMode === 'hand' || displayMode === 'deck' || displayMode === 'erosion_item');
  const showUnitStats = showStats && displayMode === 'unit' && card.type === 'UNIT';
  const isHand = displayMode === 'hand';

  return (
    <>
      <motion.div
        layout
        animate={{ rotate: exhausted ? 90 : 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCardClick}
        className={clsx(
          "relative aspect-[3/4] w-full rounded-xl cursor-pointer group transition-all bg-zinc-900 shadow-xl",
          statusBorder
            ? (statusBorder === 'red'
              ? "border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
              : "border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]")
            : (getRarityClass(card.rarity) + " border-2"),
          className
        )}
      >
        {/* Visual Content Wrapper - Handles clipping of image and overlays */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <img
            src={imageUrl}
            alt={card.fullName || fullImageUrl}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        </div>

        {/* Top Right: Keyword Indicators */}
        <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1 z-10 flex flex-col items-end gap-0.5">
          {card.influencingEffects?.some(effect => effect.description.includes('强制护卫中')) && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-blue-900/85 border border-blue-300/40 flex items-center justify-center shadow-lg" title="强制护卫中">
              <Shield className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-300" />
            </div>
          )}
          {card.influencingEffects?.some(effect => effect.description.includes('强制护卫中')) && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-blue-900/85 border border-blue-300/40 flex items-center justify-center shadow-lg" title="强制护卫中">
              <Shield className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-300" />
            </div>
          )}
          {card.isrush && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-[#4a0d4a] border border-white/20 flex items-center justify-center shadow-lg" title="速攻">
              <span className="text-[8px] md:text-[10px] font-black text-white italic">速</span>
            </div>
          )}
          {card.isAnnihilation && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-[#4a0d4a] border border-white/20 flex items-center justify-center shadow-lg" title="歼灭">
              <span className="text-[8px] md:text-[10px] font-black text-white italic">歼</span>
            </div>
          )}
          {card.isShenyi && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-[#4a0d4a] border border-white/20 flex items-center justify-center shadow-lg" title="神依">
              <span className="text-[8px] md:text-[10px] font-black text-white italic">依</span>
            </div>
          )}
          {card.isHeroic && (
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-md bg-[#4a0d4a] border border-white/20 flex items-center justify-center shadow-lg" title="英勇">
              <span className="text-[8px] md:text-[10px] font-black text-white italic">勇</span>
            </div>
          )}
        </div>

        {/* Top Left: Access Cost (Ac值) */}
        {showAC && (
          <div className="absolute top-0.5 left-0.5 md:top-1 md:left-1 z-10">
            <div className={clsx(
              "w-5 h-5 md:w-7 md:h-7 rounded-full border-1 md:border-1.5 flex flex-col items-center justify-center font-bold shadow-lg",
              isNegativeCost
                ? "bg-blue-600/90 border-blue-200 text-white"
                : "bg-red-600/90 border-red-200 text-white"
            )}>
              <span className="text-[4px] md:text-[6px] leading-none opacity-80 font-black">接</span>
              <span className="text-[10px] md:text-xs leading-none mt-0 md:mt-0.5">
                {isHand ? Math.abs(card.acValue) : (card.acValue >= 0 ? `+${card.acValue}` : card.acValue)}
              </span>
            </div>
          </div>
        )}

        {/* Bottom Stats: Power and Damage */}
        {showUnitStats && (
          <>
            {/* Lower Left: Damage */}
            <div className="absolute bottom-1 right-1/2 translate-x-[-2px] md:bottom-1.5 md:left-1.5 md:translate-x-0">
              <div className="flex items-center gap-0.5 md:gap-1 bg-black/60 backdrop-blur-md border border-red-500/40 rounded-sm md:rounded-md px-1 md:px-1.5 py-0.5 shadow-lg">
                <Sword className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-500" />
                <span className="text-[10px] md:text-xs font-black text-white">{card.damage}</span>
              </div>
            </div>

            {/* Lower Right: Strength (Power) */}
            <div className="absolute bottom-1 left-1/2 translate-x-[2px] md:bottom-1.5 md:right-1.5 md:translate-x-0">
              <div className="flex items-center gap-0.5 md:gap-1 bg-black/60 backdrop-blur-md border border-blue-400/40 rounded-sm md:rounded-md px-1 md:px-1.5 py-0.5 shadow-lg">
                <Shield className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-400" />
                <span className="text-[10px] md:text-xs font-black text-white">{card.power}</span>
              </div>
            </div>
          </>
        )}

        {/* God Mark (神蚀标记) */}
        {card.godMark && (
          <div className="absolute bottom-6 md:bottom-2 left-1/2 -translate-x-1/2">
            <div className="w-5 h-5 md:w-7 md:h-7 rounded-full bg-zinc-950 border-1.5 md:border-2 border-red-500 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.6)]">
              <Zap className="w-3 h-3 md:w-4 md:h-4 text-red-500 fill-red-500" />
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
