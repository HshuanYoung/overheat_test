import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, PlayerState, StackItem, GameState } from '../types/game';
import { CardComponent } from './Card';
import { GameService } from '../services/gameService';
import { Shield, Sword, Zap, Trash2, LogOut, Layers, AlertTriangle, Search, Play } from 'lucide-react';
import { cn } from '../lib/utils';

interface PlayFieldProps {
  player: PlayerState;
  opponent: PlayerState;
  game: GameState;
  onCardClick?: (card: Card, zone: string, index?: number) => void;
  onHoverCard?: (card: Card | null) => void;
  onPlayCard?: (card: Card) => void;
  paymentSelection?: { useFeijing: string[], exhaustIds: string[], erosionFrontIds?: string[] };
  stack: StackItem[];
  myUid: string;
  selectedAttackers?: string[];
}

const CardSlot: React.FC<{
  card: Card | null;
  label?: string;
  onClick?: () => void;
  onHover?: (card: Card | null) => void;
  className?: string;
  isErosion?: boolean;
  isFaceUp?: boolean;
  isExhausted?: boolean;
  isSelectedForPayment?: boolean;
  isDeck?: boolean;
  count?: number;
  showCount?: boolean;
  isAttacking?: boolean;
}> = ({ card, label, onClick, onHover, className, isErosion, isFaceUp = true, isExhausted, isSelectedForPayment, isDeck, count = 0, showCount = true, isAttacking }) => {
  // Calculate thickness layers (max 8 for visual performance)
  const layers = Math.min(Math.floor(count / 3), 8);
  
  return (
    <div className="relative w-full aspect-[3/4]">
      {/* Thickness Layers */}
      {Array.from({ length: layers }).map((_, i) => (
        <div 
          key={i}
          className="absolute inset-0 rounded-md border border-white/10 bg-zinc-900"
          style={{ transform: `translate(${(i + 1) * 1.5}px, -${(i + 1) * 1.5}px)`, zIndex: -i - 1 }}
        />
      ))}
      
      <div
        className={cn(
          "relative h-full w-full rounded-md border-2 border-dashed transition-all flex items-center justify-center group overflow-hidden cursor-pointer",
          (card || isDeck || count > 0) ? "border-[#f27d26]/50 bg-black/40 shadow-lg" : "border-white/10 bg-white/5",
          isExhausted ? "rotate-90 scale-90 opacity-80" : "",
          isSelectedForPayment ? "ring-2 ring-[#f27d26] ring-offset-2 ring-offset-black z-10" : "",
          isAttacking ? "ring-4 ring-red-600 ring-offset-2 ring-offset-black z-10 shadow-[0_0_20px_rgba(220,38,38,0.8)]" : "",
          className
        )}
        onClick={onClick}
        onMouseEnter={() => card && onHover?.(card)}
        onMouseLeave={() => onHover?.(null)}
      >
        {isDeck ? (
          <CardComponent isBack />
        ) : card ? (
          <div className="h-full w-full relative">
            {isFaceUp ? (
              <CardComponent card={card} className="border-0" />
            ) : (
              <CardComponent isBack className="border-0" />
            )}
          </div>
        ) : count > 0 ? (
           <CardComponent isBack />
        ) : (
          <span className="text-[8px] uppercase font-bold opacity-20 tracking-widest text-center px-1">
            {label}
          </span>
        )}

        {/* Count Badge */}
        {showCount && count > 0 && (
          <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] px-1 rounded border border-white/20 z-20">
            {count}
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
}> = ({ title, cards = [], isOpen, onClose }) => {
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
            <div key={i} className="aspect-[3/4]">
              <CardComponent card={card} />
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
  onCardClick?: (card: Card, zone: string, index?: number) => void;
  onHoverCard?: (card: Card | null) => void;
  onPlayCard?: (card: Card) => void;
  paymentSelection?: { useFeijing: string[], exhaustIds: string[], erosionFrontIds?: string[] };
  selectedAttackers?: string[];
}> = ({ player, isOpponent, onCardClick, onHoverCard, onPlayCard, paymentSelection, selectedAttackers }) => {
  const romanNumerals = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
  const [viewingZone, setViewingZone] = useState<{ title: string, cards: Card[] } | null>(null);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  
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
              card={(player.grave?.length || 0) > 0 ? player.grave[player.grave.length - 1] : null} 
              label="GRAVE" count={player.grave?.length || 0} 
              className="border-red-900/30"
              onClick={() => setViewingZone({ title: 'Grave', cards: player.grave || [] })}
              onHover={onHoverCard}
              isFaceUp={true}
            />
            <CardSlot 
              card={(player.exile?.length || 0) > 0 ? player.exile[player.exile.length - 1] : null} 
              label="EXILE" count={player.exile?.length || 0} 
              className="border-purple-900/30"
              onClick={() => setViewingZone({ title: 'Exile', cards: player.exile || [] })}
              onHover={onHoverCard}
              isFaceUp={true}
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
                  label={`ITEM ${i+1}`}
                  onHover={onHoverCard}
                  onClick={() => item && onCardClick?.(item, 'item', i)}
                  isExhausted={item ? item.isExhausted : false}
                  isSelectedForPayment={item ? paymentSelection?.exhaustIds.includes(item.gamecardId) : false}
                  showCount={false}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* CENTER COLUMN: HAND, UNIT, EROSION */}
      <div className="flex flex-col gap-2 h-full min-h-0 justify-center">
        {isOpponent ? (
          <>
            {/* Opponent Hand Area */}
            <div className="flex items-center gap-4">
              <div className="w-20 shrink-0">
                <CardSlot 
                  card={(player.playZone?.length || 0) > 0 ? player.playZone[player.playZone.length - 1] : null}
                  label="PLAY" count={player.playZone?.length || 0}
                  className="border-yellow-500/30"
                  onHover={onHoverCard}
                />
              </div>
              <div className="flex-1 h-24 flex items-center justify-center gap-1 overflow-x-auto px-4 bg-black/20 rounded-xl border border-white/5 custom-scrollbar">
                <div className="text-white/50 text-sm font-bold tracking-widest uppercase">
                  手牌数量: {player.hand?.length || 0}
                </div>
              </div>
            </div>

            {/* Opponent Erosion Zone */}
            <div className="grid grid-cols-10 gap-1">
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
                            onHover={onHoverCard}
                            onClick={() => displayCard.isFaceUp && onCardClick?.(displayCard, 'erosion_front', i)}
                            isSelectedForPayment={displayCard.isFaceUp && paymentSelection?.erosionFrontIds?.includes(displayCard.gamecardId)}
                            className={displayCard.isFaceUp ? "border-red-600" : "border-red-900/50"}
                            showCount={false}
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
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot 
                    key={i}
                    card={unit || null}
                    label={`UNIT ${i+1}`}
                    onHover={onHoverCard}
                    onClick={() => unit && onCardClick?.(unit, 'unit', i)}
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? selectedAttackers?.includes(unit.gamecardId) : false}
                    showCount={false}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Player Unit Zone */}
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const unit = player.unitZone?.[i];
                return (
                  <CardSlot 
                    key={i}
                    card={unit || null}
                    label={`UNIT ${i+1}`}
                    onHover={onHoverCard}
                    onClick={() => unit && onCardClick?.(unit, 'unit', i)}
                    isExhausted={unit ? unit.isExhausted : false}
                    isSelectedForPayment={unit ? paymentSelection?.exhaustIds.includes(unit.gamecardId) : false}
                    isAttacking={unit ? selectedAttackers?.includes(unit.gamecardId) : false}
                    showCount={false}
                  />
                );
              })}
            </div>

            {/* Player Erosion Zone */}
            <div className="grid grid-cols-10 gap-1">
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
                            onHover={onHoverCard}
                            onClick={() => displayCard.isFaceUp && onCardClick?.(displayCard, 'erosion_front', i)}
                            isSelectedForPayment={displayCard.isFaceUp && paymentSelection?.erosionFrontIds?.includes(displayCard.gamecardId)}
                            className={displayCard.isFaceUp ? "border-red-600" : "border-red-900/50"}
                            showCount={false}
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
                  const canPlayCheck = GameService.canPlayCard(player, card);
                  const isSelected = selectedHandCardId === card.gamecardId;
                  const xPos = offset * 80;

                  return (
                    <div 
                      key={card.gamecardId || i} 
                      className="absolute w-16 transition-all duration-300 cursor-pointer"
                      style={{
                        transform: `translateX(${xPos}px) ${isSelected ? 'translateY(-40px) scale(1.5)' : ''}`,
                        zIndex: isSelected ? 100 : i
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedHandCardId(null);
                        } else {
                          setSelectedHandCardId(card.gamecardId || null);
                        }
                      }}
                      onMouseEnter={() => onHoverCard?.(card)}
                      onMouseLeave={() => onHoverCard?.(null)}
                    >
                      <CardComponent 
                        card={card} 
                        disableZoom 
                        className={cn(
                          "shadow-2xl transition-all duration-300",
                          isSelected ? "shadow-[#f27d26]/60 ring-2 ring-[#f27d26]" : "shadow-black/50"
                        )} 
                      />
                      
                      {/* Play Button Overlay */}
                      {isSelected && (
                        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center animate-in fade-in zoom-in duration-200">
                          {canPlayCheck.canPlay ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onPlayCard?.(card);
                                setSelectedHandCardId(null);
                              }}
                              className="bg-[#f27d26] text-black text-[10px] font-black px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(242,125,38,0.6)] hover:scale-110 active:scale-95 transition-all flex items-center gap-2 border-2 border-black/20"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              PLAY
                            </button>
                          ) : (
                            <div className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-xl whitespace-nowrap border-2 border-red-400/50 animate-bounce">
                              {canPlayCheck.reason}
                            </div>
                          )}
                        </div>
                      )}
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
                  onHover={onHoverCard}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-4 h-full min-h-0 justify-center">
        {isOpponent ? (
          // Opponent Right: Item Zone
          <div className="grid grid-cols-2 grid-rows-5 gap-1 h-full">
            {Array.from({ length: 10 }).map((_, i) => {
              const item = player.itemZone?.[i];
              return (
                <CardSlot 
                  key={i}
                  card={item || null}
                  label={`ITEM ${i+1}`}
                  onHover={onHoverCard}
                  onClick={() => item && onCardClick?.(item, 'item', i)}
                  isExhausted={item ? item.isExhausted : false}
                  isSelectedForPayment={item ? paymentSelection?.exhaustIds.includes(item.gamecardId) : false}
                  showCount={false}
                />
              );
            })}
          </div>
        ) : (
          // Player Right: Exile, Grave, Deck
          <div className="flex flex-col gap-2">
            <CardSlot 
              card={(player.exile?.length || 0) > 0 ? player.exile[player.exile.length - 1] : null} 
              label="EXILE" count={player.exile?.length || 0} 
              className="border-purple-900/30"
              onClick={() => setViewingZone({ title: 'Exile', cards: player.exile || [] })}
              onHover={onHoverCard}
              isFaceUp={true}
            />
            <CardSlot 
              card={(player.grave?.length || 0) > 0 ? player.grave[player.grave.length - 1] : null} 
              label="GRAVE" count={player.grave?.length || 0} 
              className="border-red-900/30"
              onClick={() => setViewingZone({ title: 'Grave', cards: player.grave || [] })}
              onHover={onHoverCard}
              isFaceUp={true}
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

export const PlayField: React.FC<PlayFieldProps> = ({ player, opponent, game, onCardClick, onHoverCard, onPlayCard, paymentSelection, stack, myUid, selectedAttackers }) => {
  return (
    <div className="relative w-full h-full max-w-7xl mx-auto bg-[#0a0a0a] border-2 border-[#1a1a1a] rounded-xl shadow-2xl font-mono text-white select-none flex flex-col">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #f27d26 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      {/* Opponent Half */}
      <div className="flex-1 min-h-0">
        <PlayerHalf 
          player={opponent} 
          isOpponent 
          onCardClick={onCardClick}
          onHoverCard={onHoverCard}
        />
      </div>

      {/* STACK AREA */}
      <div className="h-10 shrink-0 border-y border-white/10 bg-white/5 flex items-center justify-center px-6 relative z-10">
        <div className="flex items-center gap-3">
          {stack.length === 0 && <span className="text-[8px] text-white/10 uppercase font-bold italic tracking-widest">Stack Empty</span>}
          {stack.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="w-8 relative group"
              onMouseEnter={() => onHoverCard?.(item.card)}
              onMouseLeave={() => onHoverCard?.(null)}
            >
              <CardComponent card={item.card} disableZoom />
              <div className={cn(
                "absolute -top-1.5 -left-1.5 px-1 py-0.5 rounded text-[6px] font-black uppercase italic shadow-lg",
                item.ownerUid === myUid ? "bg-[#f27d26] text-black" : "bg-red-600 text-white"
              )}>
                {item.ownerUid === myUid ? "Me" : "Opp"}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player Half */}
      <div className="flex-1 min-h-0">
        <PlayerHalf 
          player={player} 
          onCardClick={onCardClick}
          onHoverCard={onHoverCard}
          onPlayCard={onPlayCard}
          paymentSelection={paymentSelection}
          selectedAttackers={selectedAttackers}
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
