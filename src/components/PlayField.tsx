import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, PlayerState, StackItem, GameState, GAME_TIMEOUTS } from '../types/game';
import { CardComponent } from './Card';
import { GameService } from '../services/gameService';
import { Shield, Sword, Zap, Trash2, LogOut, Layers, AlertTriangle, Search, Play } from 'lucide-react';
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
  timer: number;
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
  count?: number;
  showCount?: boolean;
  isAttacking?: boolean;
  isDefending?: boolean;
  isOpponent?: boolean;
  isAllianceInitiator?: boolean;
  displayMode?: 'deck' | 'unit' | 'erosion_item' | 'none';
}> = ({ card, label, onClick, onPreview, className, isFaceUp = true, isExhausted, isSelectedForPayment, isDeck, count = 0, showCount = true, isAttacking, isDefending, isOpponent, isAllianceInitiator, displayMode }) => {
  // Dynamic height scaling for stack areas (Deck, Grave, Exile)
  const isStackArea = isDeck || label === 'GRAVE' || label === 'EXILE';
  const heightScale = isStackArea ? 1 + Math.min(count / 100, 0.2) : 1;
  const isErosion = displayMode === 'erosion_item' && !isStackArea && label?.startsWith('ITEM') === false && label !== 'PLAY';

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
          if (!isFaceUp && card && onPreview) onPreview(card);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (card && onPreview) onPreview(card);
        }}
      >
        {isDeck ? (
          <CardComponent isBack />
        ) : card ? (
          <div className={cn(
            "h-full w-full relative transition-[transform,opacity] duration-500",
            isOpponent && "rotate-180",
            isExhausted && "opacity-80"
          )}>
            {isFaceUp ? (
              <CardComponent card={card} className="border-0" isExhausted={isExhausted} statusBorder={isAttacking ? 'red' : isDefending ? 'blue' : undefined} displayMode={displayMode} />
            ) : (
              <CardComponent isBack className="border-0" isExhausted={isExhausted} />
            )}
          </div>
        ) : count > 0 ? (
          <CardComponent isBack />
        ) : (
          <span className="text-[8px] uppercase font-bold opacity-20 tracking-widest text-center px-1">
            {label}
          </span>
        )}

        {/* Count Badge - Repositioned to center and enlarged */}
        {showCount && count > 0 && (
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
}> = ({ title, cards = [], isOpen, onClose, onPreviewCard }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-bottom border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-[#f27d26]">{title} ({cards?.length || 0})</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 custom-scrollbar">
          {cards?.map((card, i) => (
            <div key={i} className="aspect-[3/4] cursor-pointer" onClick={() => onPreviewCard?.(card)}>
              <CardComponent card={card} disableZoom />
            </div>
          ))}
          {(cards?.length || 0) === 0 && <div className="col-span-full py-20 text-center opacity-20 italic">No cards here</div>}
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
}> = ({ player, isOpponent, onCardClick, onPreviewCard, onPlayCard, paymentSelection, pendingPlayCard, selectedAttackers, selectedDefender, game, allianceInitiator }) => {
  const romanNumerals = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
  const [viewingZone, setViewingZone] = useState<{ title: string, cards: Card[] } | null>(null);
  if (!player) return null;


  return (
    <div className={cn(
      "flex-1 grid grid-cols-[100px_1fr_100px] gap-2 p-2 relative h-full min-h-0",
      isOpponent ? "bg-red-500/5" : "bg-blue-500/5"
    )}>
      <CardListModal
        isOpen={!!viewingZone}
        onClose={() => setViewingZone(null)}
        title={viewingZone?.title || ''}
        cards={viewingZone?.cards || []}
        onPreviewCard={onPreviewCard}
      />

      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-4 h-full min-h-0 justify-center">
        {isOpponent ? (
          // Opponent Left: Deck, Grave, Exile
          <div className="flex flex-col gap-2">
            <CardSlot
              card={null} isDeck label="DECK" count={player.deck?.length || 0}
              className="border-white/20"
            />
            <CardSlot
              card={player.grave?.length > 0 ? player.grave[player.grave.length - 1] : null}
              label="GRAVE" count={player.grave?.length || 0}
              className="border-red-900/30"
              onClick={() => setViewingZone({ title: 'Grave', cards: player.grave || [] })}
              isFaceUp={true}
              isOpponent={isOpponent}
              displayMode="erosion_item"
            />
            <CardSlot
              card={player.exile?.length > 0 ? player.exile[player.exile.length - 1] : null}
              label="EXILE" count={player.exile?.length || 0}
              className="border-purple-900/30"
              onClick={() => setViewingZone({ title: 'Exile', cards: player.exile || [] })}
              isFaceUp={true}
              isOpponent={isOpponent}
              displayMode="erosion_item"
            />
          </div>
        ) : (
          // Player Left: Item Zone
          <div className="grid grid-cols-2 grid-rows-5 gap-1 h-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const item = player.itemZone?.[i];
              return (
                <CardSlot
                  key={i}
                  card={item || null}
                  label={`ITEM ${i + 1}`}
                  onClick={(e) => item && onCardClick?.(item, 'item', i, e)}
                  isExhausted={item ? item.isExhausted : false}
                  isSelectedForPayment={false}
                  showCount={false}
                  displayMode="erosion_item"
                />
              );
            })}
          </div>
        )}
      </div>

      {/* CENTER COLUMN: HAND, UNIT, EROSION */}
      <div className={cn(
        "flex flex-col h-full min-h-0 justify-center",
        isOpponent ? "gap-12" : "gap-6"
      )}>
        {isOpponent ? (
          <>
            {/* Opponent Hand Area */}
            <div className="flex items-center gap-4">
              <div className="w-20 shrink-0">
                <CardSlot
                  card={(player.playZone?.length || 0) > 0 ? player.playZone[player.playZone.length - 1] : null}
                  label="PLAY" count={player.playZone?.length || 0}
                  className="border-yellow-500/30"
                  onPreview={onPreviewCard}
                  isOpponent={isOpponent}
                />
              </div>
              <div className="flex-1 h-24 flex items-center justify-center gap-1 overflow-x-auto px-4 bg-black/20 rounded-xl border border-white/5 custom-scrollbar">
                {player.hand?.map((card, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-12 aspect-[3/4] -ml-8 first:ml-0 shadow-lg drop-shadow-md transition-all",
                      !!player.isHandPublic ? "cursor-pointer hover:scale-110 hover:-translate-y-2 z-10" : "",
                      isOpponent && "rotate-180"
                    )}
                    onClick={() => !!player.isHandPublic && onPreviewCard?.(card)}
                  >
                    {!!player.isHandPublic ? (
                      <CardComponent card={card} disableZoom displayMode="hand" />
                    ) : (
                      <CardComponent isBack />
                    )}
                  </div>
                ))}
                {(player.hand?.length || 0) === 0 && (
                  <div className="text-white/50 text-sm font-bold tracking-widest uppercase">
                    手牌数量: 0
                  </div>
                )}
              </div>
            </div>

            {/* Opponent Erosion Zone */}
            <div className="grid grid-cols-10 gap-1 h-16 scale-90 origin-bottom mb-8">
              {(() => {
                const backCards = player.erosionBack?.filter(c => c !== null) || [];
                const frontCards = player.erosionFront?.filter(c => c !== null) || [];
                const allCards = [
                  ...backCards.map(c => ({ ...c, isFaceUp: false })),
                  ...frontCards.map(c => ({ ...c, isFaceUp: true }))
                ];

                return romanNumerals.map((num, i) => {
                  const displayCard = allCards[i];
                  return (
                    <div key={i} className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-black text-white/30">{num}</span>
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
                            showCount={false}
                            isOpponent={isOpponent}
                            displayMode="erosion_item"
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
            <div className="grid grid-cols-6 gap-2 min-h-[200px] items-center relative z-10 mt-6">
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot
                    key={i}
                    card={unit || null}
                    label={`UNIT ${i + 1}`}
                    onPreview={onPreviewCard}
                    onClick={(e) => unit && onCardClick?.(unit, 'unit', i, e)}
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? (selectedAttackers?.includes(unit.gamecardId) || game?.battleState?.attackers.includes(unit.gamecardId)) : false}
                    isDefending={unit ? (selectedDefender === unit.gamecardId || game?.battleState?.defender === unit.gamecardId) : false}
                    showCount={false}
                    isOpponent={isOpponent}
                    displayMode="unit"
                  />
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Player Unit Zone */}
            <div className="grid grid-cols-6 gap-2 min-h-[200px] items-center relative z-10 mb-8">
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot
                    key={i}
                    card={unit || null}
                    label={`UNIT ${i + 1}`}
                    onPreview={onPreviewCard}
                    onClick={(e) => unit && onCardClick?.(unit, 'unit', i, e)}
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? (selectedAttackers?.includes(unit.gamecardId) || game?.battleState?.attackers.includes(unit.gamecardId)) : false}
                    isDefending={unit ? (selectedDefender === unit.gamecardId || game?.battleState?.defender === unit.gamecardId) : false}
                    isAllianceInitiator={unit && allianceInitiator === unit.gamecardId}
                    showCount={false}
                    displayMode="unit"
                  />
                );
              })}
            </div>

            {/* Player Erosion Zone */}
            <div className="grid grid-cols-10 gap-1 h-16 scale-90 origin-top mt-1 mb-10">
              {(() => {
                const backCards = player.erosionBack?.filter(c => c !== null) || [];
                const frontCards = player.erosionFront?.filter(c => c !== null) || [];
                const allCards = [
                  ...backCards.map(c => ({ ...c, isFaceUp: false })),
                  ...frontCards.map(c => ({ ...c, isFaceUp: true }))
                ];

                return romanNumerals.map((num, i) => {
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
                            showCount={false}
                            displayMode="erosion_item"
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

            {/* Player Hand Area */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative min-h-[150px] flex items-center justify-center bg-black/20 rounded-xl border border-white/5">
                {player.hand?.map((card, i) => {
                  const total = player.hand.length;
                  const middle = (total - 1) / 2;
                  const offset = i - middle;
                  const xPos = offset * 80;
                  const isFeijingSelected = paymentSelection?.useFeijing?.includes(card.gamecardId);

                  return (
                    <div
                      key={card.gamecardId || i}
                      className="absolute w-16 transition-all duration-300 cursor-pointer"
                      style={{
                        transform: `translateX(${xPos}px) ${isFeijingSelected ? 'translateY(-40px) scale(1.5)' : ''}`,
                        zIndex: isFeijingSelected ? 100 : i
                      }}
                      onClick={(e) => {
                        onCardClick?.(card, 'hand', i, e);
                      }}
                    >
                      <CardComponent
                        card={card}
                        disableZoom
                        displayMode="hand"
                        className={cn(
                          "shadow-2xl transition-all duration-300 shadow-black/50",
                          isFeijingSelected && "shadow-[#f27d26]/60 ring-2 ring-[#f27d26]"
                        )}
                      />
                    </div>
                  );
                })}

                {(player.hand?.length || 0) === 0 && <span className="text-[10px] text-white/20 uppercase font-bold italic absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">Empty Hand</span>}
              </div>
              <div className="w-16 shrink-0">
                <CardSlot
                  card={(player.playZone?.length || 0) > 0 ? player.playZone[player.playZone.length - 1] : null}
                  label="PLAY" count={player.playZone?.length || 0}
                  className="border-yellow-500/30"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-4 h-full min-h-0 justify-center">
        {isOpponent ? (
          // Opponent Right: Item Zone - Centered layout
          <div className="grid grid-cols-2 grid-rows-5 gap-1 h-full">
            {[4, 5, 2, 3, 6, 7, 0, 1, 8, 9].map((idx) => {
              const item = player.itemZone?.[idx];
              return (
                <CardSlot
                  key={idx}
                  card={item || null}
                  label={`ITEM ${idx + 1}`}
                  onClick={(e) => item && onCardClick?.(item, 'item', idx, e)}
                  isExhausted={item ? item.isExhausted : false}
                  isSelectedForPayment={false}
                  showCount={false}
                  displayMode="erosion_item"
                  isOpponent={isOpponent}
                />
              );
            })}
          </div>
        ) : (
          // Player Right: Exile, Grave, Deck
          <div className="flex flex-col gap-2">
            <CardSlot
              card={player.exile?.length > 0 ? player.exile[player.exile.length - 1] : null}
              label="EXILE" count={player.exile?.length || 0}
              className="border-purple-900/30"
              onClick={() => setViewingZone({ title: 'Exile', cards: player.exile || [] })}
              isFaceUp={true}
              displayMode="erosion_item"
            />
            <CardSlot
              card={player.grave?.length > 0 ? player.grave[player.grave.length - 1] : null}
              label="GRAVE" count={player.grave?.length || 0}
              className="border-red-900/30"
              onClick={() => setViewingZone({ title: 'Grave', cards: player.grave || [] })}
              isFaceUp={true}
              displayMode="erosion_item"
            />
            <CardSlot
              card={null} isDeck label="DECK" count={player.deck?.length || 0}
              className="border-white/20"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const PlayField: React.FC<PlayFieldProps> = ({ player, opponent, game, onCardClick, onPreviewCard, onPlayCard, paymentSelection, pendingPlayCard, stack, myUid, selectedAttackers, selectedDefender, allianceInitiator, timer }) => {
  return (
    <div className="relative w-full h-full max-w-7xl mx-auto bg-[#0a0a0a] border-2 border-[#1a1a1a] rounded-xl shadow-2xl font-mono text-white select-none flex flex-col">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      {/* Personalized Timer Display */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        <div className={cn(
          "bg-black/60 backdrop-blur-md border px-4 py-2 rounded-xl flex items-center gap-3 shadow-2xl transition-all",
          timer < 30 ? "border-red-500/50 animate-pulse" : "border-[#f27d26]/30"
        )}>
          <div className="flex flex-col">
            <span className="text-[8px] text-zinc-500 uppercase font-black leading-none mb-1">My Remaining Time</span>
            <span className={cn(
              "text-xl font-black tabular-nums leading-none",
              timer < 30 ? "text-red-500" : "text-white"
            )}>
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

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
        />
      </div>


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
