import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, PlayerState, StackItem, GameState, GAME_TIMEOUTS } from '../types/game';
import { CardComponent } from './Card';
import { GameService } from '../services/gameService';
import { Shield, Sword, Zap, Trash2, LogOut, Layers, AlertTriangle, Search, Play, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface PlayFieldProps {
  player: PlayerState;
  opponent: PlayerState;
  game: GameState;
  onCardClick?: (card: Card, zone: string, index?: number, e?: React.MouseEvent) => void;
  onPreviewCard?: (card: Card) => void;
  onPlayCard?: (card: Card) => void;
  paymentSelection?: { useFeijing: string[], exhaustIds: string[], erosionFrontIds?: string[] };
  pendingPlayCard?: Card | null;
  stack: StackItem[];
  myUid: string;
  selectedAttackers?: string[];
  selectedDefender?: string;
  allianceInitiator?: string;
  timer?: number;
  cardBackUrl?: string;
  viewingZone?: { title: string, cards: Card[], type: string, erosionBackIds?: string[], isOpponentZone?: boolean } | null;
  setViewingZone?: (zone: { title: string, cards: Card[], type: string, erosionBackIds?: string[], isOpponentZone?: boolean } | null) => void;
  highlightedCardIds?: Set<string>;
}

const CardSlot: React.FC<{
  card: Card | null;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  onPreview?: (card: Card) => void;
  className?: string;
  isFaceUp?: boolean;
  isExhausted?: boolean;
  isSelectedForPayment?: boolean;
  isDeck?: boolean;
  count?: number | string;
  showCount?: boolean;
  isAttacking?: boolean;
  isDefending?: boolean;
  isOpponent?: boolean;
  isAllianceInitiator?: boolean;
  displayMode?: 'deck' | 'unit' | 'erosion_item' | 'none';
  slotLabel?: string;
  cardBackUrl?: string;
  isHighlighted?: boolean;
}> = ({ card, label, onClick, onPreview, className, isFaceUp = true, isExhausted, isSelectedForPayment, isDeck, count = 0, showCount = true, isAttacking, isDefending, isOpponent, isAllianceInitiator, displayMode, slotLabel, cardBackUrl, isHighlighted }) => {
  // Dynamic height scaling for stack areas (Deck, Grave, Exile)
  const isStackArea = isDeck || label === '墓地' || label === '放逐';
  const numericCount = typeof count === 'number' ? count : 0;
  const heightScale = isStackArea ? 1 + Math.min(numericCount / 100, 0.2) : 1;

  return (
    <div
      className={cn(
        "relative transition-all duration-300",
        displayMode === 'unit' ? "w-full aspect-[3/4] max-w-[130px]" : "w-full aspect-[3/4]"
      )}
      style={{ transform: `scaleY(${heightScale})`, transformOrigin: isOpponent ? 'top' : 'bottom' }}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-md border border-white/10 transition-all flex items-center justify-center group overflow-hidden cursor-pointer",
          (card || isDeck || count > 0) ? "bg-black/40 shadow-lg" : "bg-white/5",
          isSelectedForPayment ? "z-10 shadow-[0_0_20px_rgba(168,85,247,0.8)] ring-1 ring-purple-400" : "",
          isAllianceInitiator ? "z-10 shadow-[0_0_20px_rgba(220,38,38,0.8)] ring-2 ring-red-600" : "",
          (isAttacking || isDefending) ? "z-10" : "",
          className
        )}
        onClick={(e) => {
          if (onClick) onClick(e);
          if (!isFaceUp && card && onPreview && !isOpponent) onPreview(card);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (card && onPreview && (isFaceUp || !isOpponent)) onPreview(card);
        }}
      >
        {isDeck ? (
          <CardComponent isBack cardBackUrl={cardBackUrl} />
        ) : card ? (
          <div className={cn(
            "h-full w-full relative transition-[transform,opacity] duration-500",
            isOpponent && "rotate-180",
            isExhausted && "opacity-80"
          )}>
            {isFaceUp ? (
              <CardComponent card={card} className="border-0" isExhausted={isExhausted} statusBorder={isAttacking ? 'red' : isDefending ? 'blue' : undefined} displayMode={displayMode} cardBackUrl={cardBackUrl} isHighlighted={isHighlighted} />
            ) : (
              <CardComponent isBack className="border-0" isExhausted={isExhausted} cardBackUrl={cardBackUrl} />
            )}
          </div>
        ) : count > 0 ? (
          <CardComponent isBack cardBackUrl={cardBackUrl} />
        ) : (
          <span className="text-[8px] uppercase font-bold opacity-20 tracking-widest text-center px-1">
            {label}
          </span>
        )}

        {slotLabel && (
          <div className={cn(
            "absolute z-20 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[10px] font-black text-white shadow-lg backdrop-blur-sm",
            isOpponent ? "bottom-1 left-1 rotate-180" : "top-1 left-1"
          )}>
            {slotLabel}
          </div>
        )}

        {/* Count Badge - Repositioned to center and enlarged */}
        {showCount && (count > 0 || typeof count === 'string') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="bg-black/60 backdrop-blur-sm text-[16px] font-black px-3 py-1 rounded-full border border-white/30 text-white shadow-2xl">
              {count}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CardListModal: React.FC<{
  title: string;
  cards: Card[];
  isOpen: boolean;
  onClose: () => void;
  onPreviewCard?: (card: Card) => void;
  onCardClick?: (card: Card, zone: string, index?: number, e?: React.MouseEvent) => void;
  cardBackUrl?: string;
  zoneType: string;
  erosionBackIds?: string[];
  isOpponentZone?: boolean;
  highlightedCardIds?: Set<string>;
}> = ({ title, cards = [], isOpen, onClose, onPreviewCard, onCardClick, cardBackUrl, zoneType, erosionBackIds = [], isOpponentZone = false, highlightedCardIds }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-bottom border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-[#f27d26]">{title} ({cards?.length || 0})</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 hover:text-red-500 rounded-full transition-all group">
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 custom-scrollbar">
          {cards?.map((card, i) => {
            const isHiddenErosionBack = zoneType === 'erosion' && erosionBackIds.includes(card.gamecardId);
            const clickZone =
              zoneType === 'erosion'
                ? (isHiddenErosionBack ? 'erosion_back' : 'erosion_front')
                : zoneType;

            return (
              <div
                key={i}
                className="aspect-[3/4] cursor-pointer"
                onClick={(e) => {
                  if (onCardClick) {
                    onCardClick(card, clickZone, i, e);
                  } else {
                    onPreviewCard?.(card);
                  }
                }}
              >
                <CardComponent
                  card={card}
                  disableZoom
                  cardBackUrl={cardBackUrl}
                  isBack={isHiddenErosionBack}
                  isHighlighted={!isHiddenErosionBack && highlightedCardIds?.has(card.gamecardId)}
                />
              </div>
            );
          })}
          {(cards?.length || 0) === 0 && <div className="col-span-full py-20 text-center opacity-20 italic">这里没有卡牌</div>}
        </div>
      </div>
    </div>
  );
};

const PlayerHalf: React.FC<{
  player: PlayerState;
  isOpponent?: boolean;
  onCardClick?: (card: Card, zone: string, index?: number, e?: React.MouseEvent) => void;
  onPreviewCard?: (card: Card) => void;
  onPlayCard?: (card: Card) => void;
  paymentSelection?: { useFeijing: string[], exhaustIds: string[], erosionFrontIds?: string[] };
  pendingPlayCard?: Card | null;
  selectedAttackers?: string[];
  selectedDefender?: string;
  game?: GameState;
  allianceInitiator?: string;
  cardBackUrl?: string;
  viewingZone?: { title: string, cards: Card[], type: string, erosionBackIds?: string[], isOpponentZone?: boolean } | null;
  setViewingZone?: (zone: { title: string, cards: Card[], type: string, erosionBackIds?: string[], isOpponentZone?: boolean } | null) => void;
  highlightedCardIds?: Set<string>;
}> = ({ player, isOpponent, onCardClick, onPreviewCard, onPlayCard, paymentSelection, pendingPlayCard, selectedAttackers, selectedDefender, game, allianceInitiator, cardBackUrl, viewingZone, setViewingZone, highlightedCardIds }) => {
  if (!player) return null;
  const unitZoneOffsetClass = "md:translate-x-20 lg:translate-x-28";
  const getMobileErosionCount = (playerState: PlayerState): number | string => {
    const frontCount = playerState.erosionFront?.filter(Boolean).length || 0;
    const backCount = playerState.erosionBack?.filter(Boolean).length || 0;
    const totalCount = frontCount + backCount;
    return totalCount > 0 ? `${totalCount}(${backCount})` : 0;
  };
  const erosionSlotLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];


  return (
    <div className={cn(
      "flex-1 md:grid md:grid-cols-[100px_1fr_100px] grid grid-cols-5 gap-0.5 md:gap-2 p-0.5 md:p-2 relative h-full min-h-0",
      isOpponent ? "bg-red-500/5 items-start" : "bg-blue-500/5 items-end"
    )}>
      <CardListModal
        isOpen={!!viewingZone}
        onClose={() => setViewingZone?.(null)}
        title={viewingZone?.title || ''}
        cards={viewingZone?.cards || []}
        zoneType={viewingZone?.type || ''}
        onPreviewCard={onPreviewCard}
        onCardClick={onCardClick}
        cardBackUrl={cardBackUrl}
        erosionBackIds={viewingZone?.erosionBackIds}
        isOpponentZone={viewingZone?.isOpponentZone}
        highlightedCardIds={highlightedCardIds}
      />

      {/* SIDEBAR 1: Left Columns */}
      <div className="flex flex-col gap-1 md:gap-4 h-full justify-center">
        {isOpponent ? (
          // Opponent Left: Deck, Grave, Exile
          <>
            <CardSlot
              card={null} isDeck label="牌库" count={player.deck?.length || 0}
              className="border-white/20 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
            />
            <CardSlot
              card={player.grave?.length > 0 ? player.grave[player.grave.length - 1] : null}
              label="墓地" count={player.grave?.length || 0}
              className="border-red-900/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '墓地', cards: player.grave || [], type: 'grave' })}
              isFaceUp={true} isOpponent={isOpponent} displayMode="erosion_item"
            />
            <CardSlot
              card={player.exile?.length > 0 ? player.exile[player.exile.length - 1] : null}
              label="放逐" count={player.exile?.length || 0}
              className="border-purple-900/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '放逐区', cards: player.exile || [], type: 'exile' })}
              isFaceUp={true} isOpponent={isOpponent} displayMode="erosion_item"
            />
          </>
        ) : (
          // Player Left: Item, Erosion, Play
          <>
            <CardSlot
              card={player.itemZone?.filter(Boolean).slice(-1)[0] || null}
              label="道具区" count={player.itemZone?.filter(Boolean).length || 0}
              className="border-blue-500/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '道具区', cards: player.itemZone?.filter(Boolean) as Card[], type: 'item' })}
              isFaceUp={true}
              isExhausted={!!(player.itemZone?.filter(Boolean).slice(-1)[0] as Card | undefined)?.isExhausted}
              isHighlighted={highlightedCardIds?.has((player.itemZone?.filter(Boolean).slice(-1)[0] as Card | undefined)?.gamecardId || '')}
              displayMode="erosion_item"
            />
            <CardSlot
              card={player.erosionFront?.filter(Boolean).slice(-1)[0] || player.erosionBack?.filter(Boolean).slice(-1)[0] || null}
              label="侵蚀区"
              count={getMobileErosionCount(player)}
              className="border-red-500/30 scale-[0.8] md:scale-100 md:hidden" cardBackUrl={cardBackUrl}
              onClick={() => {
                const backCards = player.erosionBack?.filter((c): c is Card => c !== null) || [];
                const frontCards = player.erosionFront?.filter((c): c is Card => c !== null) || [];
                setViewingZone?.({
                  title: '侵蚀区',
                  cards: [...backCards, ...frontCards],
                  type: 'erosion',
                  erosionBackIds: backCards.map(c => c.gamecardId),
                  isOpponentZone: false
                });
              }}
              isFaceUp={player.erosionFront?.some(c => c !== null)}
              isHighlighted={highlightedCardIds?.has((player.erosionFront?.filter(Boolean).slice(-1)[0] || null)?.gamecardId || '')}
              displayMode="erosion_item"
            />
            <CardSlot
              card={(player.playZone?.length || 0) > 0 ? player.playZone[player.playZone.length - 1] : null}
              label="出牌区" count={player.playZone?.length || 0}
              className="border-yellow-500/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
            />
          </>
        )}
      </div>

      {/* CENTER COLUMN (3 COLUMNS ON MOBILE): HAND, UNIT, EROSION */}
      <div className={cn(
        "col-span-3 md:col-span-1 flex flex-col min-h-0",
        isOpponent ? "justify-end gap-1 md:gap-12" : "justify-end gap-1 md:gap-4"
      )}>
        {isOpponent ? (
          <>
            {/* Opponent Hand Area */}
            <div className="flex items-center justify-center px-1 md:px-0 mb-1 md:mb-2">
              <div className="flex-1 h-14 md:h-20 flex items-center justify-center gap-1 overflow-x-auto bg-black/20 rounded-lg border border-white/5 custom-scrollbar">
                {player.hand?.map((card, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-10 md:w-[76.8px] aspect-[3/4] -ml-4 md:-ml-[38.4px] first:ml-0 shadow-lg drop-shadow-md transition-all shrink-0",
                      !!player.isHandPublic ? "cursor-pointer hover:scale-110 z-10" : "",
                      isOpponent && "rotate-180"
                    )}
                    onClick={() => !!player.isHandPublic && onPreviewCard?.(card)}
                  >
                    {!!player.isHandPublic ? (
                      <CardComponent card={card} disableZoom displayMode="hand" cardBackUrl={cardBackUrl} />
                    ) : (
                      <CardComponent isBack cardBackUrl={cardBackUrl} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Opponent Erosion Zone (Desktop) */}
            <div className="hidden md:grid grid-cols-10 gap-1 h-16 scale-90 origin-bottom mb-4">
              {(() => {
                const backCards = player.erosionBack?.filter(c => c !== null) || [];
                const frontCards = player.erosionFront?.filter(c => c !== null) || [];
                const allCards = [
                  ...backCards.map(c => ({ ...c, isFaceUp: false })),
                  ...frontCards.map(c => ({ ...c, isFaceUp: true }))
                ];

                return erosionSlotLabels.map((num, i) => {
                  const displayCard = allCards[i];
                  return (
                    <div key={i} className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-black text-white/30">{num}</span>
                      <div className="relative aspect-[3/4] w-full">
                        {displayCard ? (
                          <CardSlot
                            card={displayCard} isFaceUp={displayCard.isFaceUp} onPreview={displayCard.isFaceUp ? onPreviewCard : undefined}
                            onClick={(e) => onCardClick?.(displayCard, displayCard.isFaceUp ? 'erosion_front' : 'erosion_back', i, e)}
                            isSelectedForPayment={displayCard.isFaceUp && paymentSelection?.erosionFrontIds?.includes(displayCard.gamecardId)}
                            className={displayCard.isFaceUp ? "border-red-600" : "border-red-900/50"}
                            isHighlighted={displayCard.isFaceUp && highlightedCardIds?.has(displayCard.gamecardId)}
                            showCount={false} isOpponent={isOpponent} displayMode="erosion_item" slotLabel={num} cardBackUrl={cardBackUrl}
                          />
                        ) : (
                          <div className="h-full w-full rounded-md border border-dashed border-white/5 bg-white/5 flex items-center justify-center">
                            <span className="text-[8px] opacity-20">{num}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Opponent Unit Zone */}
            <div className={cn("grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2 items-center relative z-10 px-1 md:px-0 md:translate-y-[80px]", unitZoneOffsetClass)}>
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot
                    key={i} card={unit || null} label={`${6 - i}`}
                    onPreview={onPreviewCard} onClick={(e) => unit && onCardClick?.(unit, 'unit', i, e)}
                    className="scale-[0.9] origin-center md:scale-100"
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? (selectedAttackers?.includes(unit.gamecardId) || game?.battleState?.attackers.includes(unit.gamecardId)) : false}
                    isDefending={unit ? (selectedDefender === unit.gamecardId || game?.battleState?.defender === unit.gamecardId) : false}
                    isHighlighted={unit ? highlightedCardIds?.has(unit.gamecardId) : false}
                    showCount={false} isOpponent={isOpponent} displayMode="unit" slotLabel={`${6 - i}`} cardBackUrl={cardBackUrl}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Player Unit Zone */}
            <div className={cn("grid grid-cols-3 md:grid-cols-6 gap-1 md:gap-2 items-center relative z-10 px-1 md:px-0", unitZoneOffsetClass)}>
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot
                    key={i} card={unit || null} label={`${i + 1}`}
                    onPreview={onPreviewCard} onClick={(e) => unit && onCardClick?.(unit, 'unit', i, e)}
                    className="scale-[0.9] origin-center md:scale-100"
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? (selectedAttackers?.includes(unit.gamecardId) || game?.battleState?.attackers.includes(unit.gamecardId)) : false}
                    isDefending={unit ? (selectedDefender === unit.gamecardId || game?.battleState?.defender === unit.gamecardId) : false}
                    isAllianceInitiator={unit && allianceInitiator === unit.gamecardId}
                    isHighlighted={unit ? highlightedCardIds?.has(unit.gamecardId) : false}
                    showCount={false} displayMode="unit" slotLabel={`${i + 1}`} cardBackUrl={cardBackUrl}
                  />
                );
              })}
            </div>

            {/* Player Erosion Zone (Desktop) */}
            <div className="hidden md:grid grid-cols-10 gap-1 h-16 scale-90 origin-top mt-1 mb-10">
              {(() => {
                const backCards = player.erosionBack?.filter(c => c !== null) || [];
                const frontCards = player.erosionFront?.filter(c => c !== null) || [];
                const allCards = [
                  ...backCards.map(c => ({ ...c, isFaceUp: false })),
                  ...frontCards.map(c => ({ ...c, isFaceUp: true }))
                ];

                return erosionSlotLabels.map((num, i) => {
                  const displayCard = allCards[i];
                  return (
                    <div key={i} className="flex flex-col gap-1 items-center">
                      <div className="relative aspect-[3/4] w-full">
                        {displayCard ? (
                          <CardSlot
                            card={displayCard}
                            isFaceUp={displayCard.isFaceUp}
                            onPreview={onPreviewCard}
                            onClick={(e) => {
                              if (displayCard.isFaceUp) {
                                onCardClick?.(displayCard, 'erosion_front', i, e);
                              }
                            }}
                            isSelectedForPayment={displayCard.isFaceUp && paymentSelection?.erosionFrontIds?.includes(displayCard.gamecardId)}
                            className={displayCard.isFaceUp ? "border-red-600" : "border-red-900/50"}
                            isHighlighted={displayCard.isFaceUp && highlightedCardIds?.has(displayCard.gamecardId)}
                            showCount={false}
                            displayMode="erosion_item"
                            slotLabel={num}
                            cardBackUrl={cardBackUrl}
                          />
                        ) : (
                          <div className="h-full w-full rounded-md border border-dashed border-white/5 bg-white/5 flex items-center justify-center">
                            <span className="text-[8px] opacity-20">{num}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-white/30">{num}</span>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="flex items-center justify-center px-1 md:px-0 mt-1 md:mt-2">
              <div className="flex-1 h-14 md:h-48 flex items-center justify-center gap-0.5 overflow-visible bg-black/20 rounded-lg border border-white/5 relative">
                {player.hand?.map((card, i) => {
                  const total = player.hand.length;
                  const middle = (total - 1) / 2;
                  const offset = i - middle;
                  const xPos = offset * (window.innerWidth < 768 ? 36 : 96);
                  const isFeijingSelected = paymentSelection?.useFeijing?.includes(card.gamecardId);

                  return (
                    <div
                      key={card.gamecardId || i}
                      className="absolute w-[38.4px] md:w-[115.2px] transition-all duration-300 cursor-pointer"
                      style={{
                        transform: `translateX(${xPos}px) ${isFeijingSelected ? 'translateY(-10px) md:translateY(-50px) scale(1.1)' : ''}`,
                        zIndex: isFeijingSelected ? 100 : i,
                        bottom: window.innerWidth < 768 ? '5px' : '0px'
                      }}
                      onClick={(e) => onCardClick?.(card, 'hand', i, e)}
                    >
                      <CardComponent
                        card={card} disableZoom displayMode="hand" cardBackUrl={cardBackUrl}
                        isHighlighted={highlightedCardIds?.has(card.gamecardId)}
                        className={cn("shadow-2xl transition-all duration-300", isFeijingSelected && "shadow-[#f27d26]/60 ring-2 ring-[#f27d26]")}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* SIDEBAR 2: Right Columns */}
      <div className={cn(
        "flex flex-col gap-1 md:gap-4 h-full",
        isOpponent ? "justify-center" : "justify-end pb-4"
      )}>
        {isOpponent ? (
          // Opponent Right: Play, Erosion, Item
          <>
            <CardSlot
              card={(player.playZone?.length || 0) > 0 ? player.playZone[player.playZone.length - 1] : null}
              label="出牌区" count={player.playZone?.length || 0}
              className="border-yellow-500/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onPreview={onPreviewCard} isOpponent={isOpponent}
            />
            <CardSlot
              card={player.erosionFront?.filter(Boolean).slice(-1)[0] || player.erosionBack?.filter(Boolean).slice(-1)[0] || null}
              label="侵蚀区"
              count={getMobileErosionCount(player)}
              className="border-red-500/30 scale-[0.8] md:scale-100 md:hidden" cardBackUrl={cardBackUrl}
              onClick={() => {
                const backCards = player.erosionBack?.filter((c): c is Card => c !== null) || [];
                const frontCards = player.erosionFront?.filter((c): c is Card => c !== null) || [];
                setViewingZone?.({
                  title: isOpponent ? '敌方侵蚀区' : '侵蚀区',
                  cards: [...backCards, ...frontCards],
                  type: 'erosion',
                  erosionBackIds: backCards.map(c => c.gamecardId),
                  isOpponentZone: true
                });
              }}
              isFaceUp={player.erosionFront?.some(c => c !== null)}
              isOpponent={isOpponent}
              displayMode="erosion_item"
            />
            <CardSlot
              card={player.itemZone?.filter(Boolean).slice(-1)[0] || null}
              label="道具区" count={player.itemZone?.filter(Boolean).length || 0}
              className="border-blue-500/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '敌方道具区', cards: player.itemZone?.filter(Boolean) as Card[], type: 'item' })}
              isFaceUp={true}
              isExhausted={!!(player.itemZone?.filter(Boolean).slice(-1)[0] as Card | undefined)?.isExhausted}
              isHighlighted={highlightedCardIds?.has((player.itemZone?.filter(Boolean).slice(-1)[0] as Card | undefined)?.gamecardId || '')}
              isOpponent={isOpponent}
              displayMode="erosion_item"
            />
          </>
        ) : (
          // Player Right: Exile, Grave, Deck
          <>
            <CardSlot
              card={player.exile?.length > 0 ? player.exile[player.exile.length - 1] : null}
              label="放逐" count={player.exile?.length || 0}
              className="border-purple-900/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '放逐区', cards: player.exile || [], type: 'exile' })}
              isFaceUp={true} displayMode="erosion_item"
            />
            <CardSlot
              card={player.grave?.length > 0 ? player.grave[player.grave.length - 1] : null}
              label="墓地" count={player.grave?.length || 0}
              className="border-red-900/30 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
              onClick={() => setViewingZone?.({ title: '墓地', cards: player.grave || [], type: 'grave' })}
              isFaceUp={true} displayMode="erosion_item"
            />
            <CardSlot
              card={null} isDeck label="牌库" count={player.deck?.length || 0}
              className="border-white/20 scale-[0.8] md:scale-100" cardBackUrl={cardBackUrl}
            />
          </>
        )}
      </div>
    </div>
  );
};

export const PlayField: React.FC<PlayFieldProps> = ({ player, opponent, game, onCardClick, onPreviewCard, onPlayCard, paymentSelection, pendingPlayCard, stack, myUid, selectedAttackers, selectedDefender, allianceInitiator, timer, cardBackUrl, viewingZone, setViewingZone, highlightedCardIds }) => {
  if (!player || !opponent || !game) return null;
  return (
    <div className="relative w-full h-full max-w-full lg:max-w-7xl mx-auto bg-[#0a0a0a] border-y md:border-2 border-[#1a1a1a] md:rounded-xl shadow-2xl font-sans text-white select-none flex flex-col">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-blue-500/5 pointer-events-none" />


      {/* Opponent Half */}
      <div className="flex-1 min-h-0">
        <PlayerHalf
          player={opponent}
          isOpponent
          onCardClick={onCardClick}
          onPreviewCard={onPreviewCard}
          game={game}
          selectedAttackers={selectedAttackers}
          selectedDefender={selectedDefender}
          paymentSelection={paymentSelection}
          pendingPlayCard={pendingPlayCard}
          allianceInitiator={allianceInitiator}
          timer={timer}
          cardBackUrl={cardBackUrl}
          viewingZone={viewingZone}
          setViewingZone={setViewingZone}
          highlightedCardIds={highlightedCardIds}
        />
      </div>

      <div className="h-0.5 md:h-2 w-full bg-white/5 relative z-10" />

      {/* Player Half */}
      <div className="flex-1 min-h-0">
        <PlayerHalf
          player={player}
          onCardClick={onCardClick}
          onPreviewCard={onPreviewCard}
          onPlayCard={onPlayCard}
          paymentSelection={paymentSelection}
          pendingPlayCard={pendingPlayCard}
          selectedDefender={selectedDefender}
          game={game}
          allianceInitiator={allianceInitiator}
          cardBackUrl={cardBackUrl}
          viewingZone={viewingZone}
          setViewingZone={setViewingZone}
          highlightedCardIds={highlightedCardIds}
        />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(242, 125, 38, 0.2);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
