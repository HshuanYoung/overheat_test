import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GameState, PlayerState, Card, StackItem, CardEffect } from '../types/game';
import { GameService } from '../services/gameService';
import { CardComponent } from './Card';
import { PlayField } from './PlayField';
import { Rulebook } from './Rulebook';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Shield, Zap, LogOut, BookOpen, Send, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export const BattleField: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [selectedMulligan, setSelectedMulligan] = useState<string[]>([]);
  const [isMulliganSubmitting, setIsMulliganSubmitting] = useState(false);
  const [paymentSelection, setPaymentSelection] = useState<{ useFeijing: string[], exhaustIds: string[], erosionFrontIds: string[] }>({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
  const [pendingPlayCard, setPendingPlayCard] = useState<Card | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const [counterTimer, setCounterTimer] = useState<number>(30);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [selectedErosionCardId, setSelectedErosionCardId] = useState<string | null>(null);
  const [erosionChoice, setErosionChoice] = useState<'A' | 'B' | 'C' | null>(null);

  // Handle 30s response timeout
  useEffect(() => {
    if (!gameId || !game || !auth.currentUser || game.isCountering === 0 || game.counterStack.length === 0) return;

    const myUid = auth.currentUser.uid;
    const stackItem = game.counterStack[game.counterStack.length - 1];
    if (!stackItem || !stackItem.timestamp) return;

    const checkTimeout = () => {
      const now = Date.now();
      const elapsed = now - stackItem.timestamp;
      if (elapsed >= 30000) {
        // Timeout reached, resolve automatically
        // Only the player who played the card should trigger this to avoid conflicts.
        if (myUid === stackItem.ownerUid) {
           GameService.resolvePlay(gameId);
        }
      }
    };

    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [game, gameId]);

  useEffect(() => {
    const audio = new Audio('/assets/music_bg.wav');
    audio.loop = true;
    audio.volume = 0.3;
    
    const playAudio = () => {
      audio.play().catch(e => console.log("Audio play blocked by browser", e));
      window.removeEventListener('click', playAudio);
    };
    
    window.addEventListener('click', playAudio);
    
    return () => {
      audio.pause();
      window.removeEventListener('click', playAudio);
    };
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsubscribe = onSnapshot(doc(db, 'games', gameId), (doc) => {
      if (doc.exists()) {
        setGame(doc.data() as GameState);
      }
    });
    return () => unsubscribe();
  }, [gameId]);

  // Counter Timer Logic
  useEffect(() => {
    if (!game || !gameId || !auth.currentUser) return;
    
    const myUid = auth.currentUser.uid;
    const isWaitingForMe = game.counterStack?.length > 0 && game.counterStack[game.counterStack.length - 1]?.ownerUid !== myUid;

    if (isWaitingForMe) {
      setCounterTimer(30);
      const interval = setInterval(() => {
        setCounterTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleResolve(); // Auto resolve when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCounterTimer(30); // Reset timer when not waiting
    }
  }, [game?.counterStack, gameId]);

  // Bot Turn Logic
  useEffect(() => {
    if (!game || !gameId) return;
    const opponentUid = Object.keys(game.players).find(uid => uid !== auth.currentUser?.uid);
    if (opponentUid === 'BOT_PLAYER' && game.players[opponentUid].isTurn) {
      const timer = setTimeout(() => {
        GameService.botMove(gameId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [game, gameId]);

  if (!game || !auth.currentUser) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-[#f27d26] border-t-transparent rounded-full"
      />
    </div>
  );

  const myUid = auth.currentUser.uid;
  const opponentUid = Object.keys(game.players).find(uid => uid !== myUid);
  
  const me = game.players[myUid];
  const opponent = opponentUid ? game.players[opponentUid] : null;

  const handleDeclareAttack = async () => {
    if (!gameId || selectedAttackers.length === 0) return;
    try {
      await GameService.declareAttack(gameId, myUid, selectedAttackers);
      setSelectedAttackers([]);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEndTurn = async () => {
    if (gameId) {
      await GameService.advancePhase(gameId, 'DECLARE_END');
    }
  };

  const handleCardClick = (card: Card, zone: string, index?: number) => {
    if (!me.isTurn) return;

    // Handle exhausting cards for payment
    if (pendingPlayCard) {
      if (zone === 'unit' || zone === 'item') {
        if (card.isExhausted) return; // Cannot exhaust already exhausted card
        togglePaymentExhaust(card.gamecardId);
      } else if (zone === 'hand' && card.feijingMark) {
        if (card.color !== pendingPlayCard.color) {
          alert('菲晶卡颜色与打出的卡牌颜色不匹配');
          return;
        }
        togglePaymentFeijing(card.gamecardId);
      } else if (zone === 'erosion_front') {
        if (card.displayState !== 'FRONT_UPRIGHT') return; // Only face-up cards can be used
        togglePaymentErosionFront(card.gamecardId);
      }
      return;
    }

    // Handle selecting attackers in Battle Phase
    if (game.phase === 'BATTLE' && zone === 'unit') {
      const isMyCard = me.unitZone.some(c => c?.gamecardId === card.gamecardId);
      if (isMyCard && !card.isExhausted) {
        setSelectedAttackers(prev => {
          if (prev.includes(card.gamecardId)) return prev.filter(id => id !== card.gamecardId);
          if (prev.length >= 2) return [prev[1], card.gamecardId]; // Max 2 attackers
          return [...prev, card.gamecardId];
        });
      }
      return;
    }

    // Activate [启] ability during Main Phase
    if (game.phase === 'MAIN' && (zone === 'unit' || zone === 'item')) {
      // Only allow activating abilities of my own cards
      const isMyCard = [...me.unitZone, ...me.itemZone].some(c => c?.gamecardId === card.gamecardId);
      if (isMyCard) {
        const activateEffect = card.effects.find(e => e.type === 'ACTIVATE');
        if (activateEffect) {
          activateAbility(card, activateEffect);
        }
      }
    }
  };

  const activateAbility = async (card: Card, effect: CardEffect) => {
    if (!gameId) return;
    
    const newStackItem: StackItem = {
      card: card,
      ownerUid: myUid,
      type: 'EFFECT',
      timestamp: Date.now()
    };

    const newLogs = [...game.logs, `${me.displayName} 发动了 [${card.fullName}] 的 [启] 能力: ${effect.description}`];

    try {
      await updateDoc(doc(db, 'games', gameId), {
        counterStack: arrayUnion(newStackItem),
        logs: newLogs
      });
    } catch (error) {
      console.error("Error activating ability:", error);
    }
  };

  const playCardFromHand = async (card: Card) => {
    if (!me.isTurn || !gameId || game.phase !== 'MAIN') return;
    
    const playEffect = card.effects.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    const cost = card.acValue;

    if (cost === 0) {
      try {
        await GameService.playCard(gameId, myUid, card.gamecardId, {});
      } catch (error: any) {
        alert(error.message);
      }
    } else {
      setPendingPlayCard(card);
      setPaymentSelection({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
    }
  };

  const handleMulligan = async () => {
    if (!gameId) return;
    setIsMulliganSubmitting(true);
    try {
      await GameService.performMulligan(gameId, selectedMulligan);
    } catch (error) {
      console.error(error);
    } finally {
      setIsMulliganSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!gameId) return;
    try {
      await GameService.resolvePlay(gameId);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleConfirmPlay = async () => {
    if (!gameId || !pendingPlayCard) return;
    try {
      await GameService.playCard(gameId, myUid, pendingPlayCard.gamecardId, {
        feijingCardId: paymentSelection.useFeijing[0], // Assuming only one feijing card can be used
        exhaustUnitIds: paymentSelection.exhaustIds,
        erosionFrontIds: paymentSelection.erosionFrontIds
      });
      setPendingPlayCard(null);
      setPaymentSelection({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleConfirmErosion = async () => {
    if (!gameId || !erosionChoice) return;
    if ((erosionChoice === 'B' || erosionChoice === 'C') && !selectedErosionCardId) {
      alert('请选择一张侵蚀区正面卡');
      return;
    }
    try {
      await GameService.handleErosionChoice(gameId, myUid, erosionChoice, selectedErosionCardId || undefined);
      setErosionChoice(null);
      setSelectedErosionCardId(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const togglePaymentExhaust = (gamecardId: string) => {
    setPaymentSelection(prev => {
      const isExhausted = prev.exhaustIds.includes(gamecardId);
      return {
        ...prev,
        exhaustIds: isExhausted 
          ? prev.exhaustIds.filter(id => id !== gamecardId) 
          : [...prev.exhaustIds, gamecardId]
      };
    });
  };

  const togglePaymentFeijing = (gamecardId: string) => {
    setPaymentSelection(prev => {
      const isUsed = prev.useFeijing.includes(gamecardId);
      return {
        ...prev,
        useFeijing: isUsed 
          ? [] // Only allow one feijing card
          : [gamecardId]
      };
    });
  };

  const togglePaymentErosionFront = (gamecardId: string) => {
    setPaymentSelection(prev => {
      const isUsed = prev.erosionFrontIds.includes(gamecardId);
      return {
        ...prev,
        erosionFrontIds: isUsed 
          ? prev.erosionFrontIds.filter(id => id !== gamecardId) 
          : [...prev.erosionFrontIds, gamecardId]
      };
    });
  };

  if (game.phase === 'MULLIGAN' && !me.mulliganDone) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-8">
        <h2 className="text-4xl font-black italic text-[#f27d26] mb-4 uppercase tracking-tighter">调度阶段 (Mulligan)</h2>
        <p className="text-zinc-400 mb-12 uppercase tracking-[0.3em] text-sm">点击卡牌查看大图，点击下方按钮选择是否更换</p>
        
        <div className="flex gap-6 mb-12">
          {me.hand.map((card, i) => {
            const isSelected = selectedMulligan.includes(card.gamecardId);
            return (
              <div key={`${card.gamecardId}-${i}`} className="flex flex-col items-center gap-4">
                <motion.div
                  whileHover={{ y: -10 }}
                  onClick={() => setHoveredCard(card)}
                  className={cn(
                    "w-40 cursor-pointer transition-all rounded-xl overflow-hidden border-2",
                    isSelected ? "border-[#f27d26] scale-105 shadow-[0_0_30px_rgba(242,125,38,0.3)]" : "border-transparent opacity-60"
                  )}
                >
                  <CardComponent card={card} disableZoom={true} />
                </motion.div>
                <button
                  onClick={() => {
                    setSelectedMulligan(prev => 
                      prev.includes(card.gamecardId) ? prev.filter(id => id !== card.gamecardId) : [...prev, card.gamecardId]
                    );
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                    isSelected ? "bg-[#f27d26] text-black" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isSelected ? "已选择更换" : "保留"}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleMulligan}
          disabled={isMulliganSubmitting}
          className="px-12 py-4 bg-[#f27d26] text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-[#f27d26]/80 transition-all disabled:opacity-50"
        >
          {selectedMulligan.length > 0 ? `更换 ${selectedMulligan.length} 张卡牌` : '接受初始手牌'}
        </button>
        
        {/* Full Image Overlay for Mulligan */}
        <AnimatePresence>
          {hoveredCard && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
              onClick={() => setHoveredCard(null)}
            >
              <div className="relative max-h-[90vh] aspect-[3/4]">
                <img 
                  src={hoveredCard.fullImageUrl || hoveredCard.imageUrl || `https://picsum.photos/seed/${hoveredCard.id}/400/600`} 
                  alt={hoveredCard.fullName}
                  className="w-full h-full object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (game.phase === 'MULLIGAN' && me.mulliganDone) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-[#f27d26] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 uppercase tracking-widest text-sm">等待对手完成调度...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] flex flex-col overflow-hidden select-none font-sans relative">
      {/* Zoomed Card Overlay (Global) */}
      <AnimatePresence>
        {hoveredCard && (
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.8 }}
            className="fixed right-12 top-1/2 -translate-y-1/2 z-[100] w-72 aspect-[3/4] rounded-2xl border-2 border-[#f27d26] shadow-[0_0_50px_rgba(242,125,38,0.4)] overflow-hidden bg-black pointer-events-none"
          >
            <img 
              src={hoveredCard.fullImageUrl} 
              alt={hoveredCard.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-4 border-t border-[#f27d26]/20">
              <div className="text-sm font-black text-[#f27d26] mb-1 uppercase italic tracking-tighter">{hoveredCard.name}</div>
              <div className="text-[10px] text-white/80 leading-relaxed font-mono">
                {hoveredCard.effects.map((e, i) => (
                  <div key={i} className="mb-1.5">
                    <span className="font-bold text-blue-400">[{e.type}]</span> {e.description}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Erosion Phase Overlay */}
      <AnimatePresence>
        {game.phase === 'EROSION' && me.isTurn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="max-w-4xl w-full flex flex-col items-center gap-8">
              <div className="text-center">
                <h2 className="text-4xl font-black italic text-[#f27d26] mb-2 uppercase tracking-tighter">侵蚀阶段 (Erosion Phase)</h2>
                <p className="text-zinc-400 uppercase tracking-[0.3em] text-sm">请选择处理侵蚀区正面卡的方式</p>
              </div>

              <div className="grid grid-cols-3 gap-6 w-full">
                <button 
                  onClick={() => setErosionChoice('A')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center",
                    erosionChoice === 'A' ? "border-[#f27d26] bg-[#f27d26]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">A</div>
                  <div className="font-bold text-white">全部移至墓地</div>
                  <div className="text-xs text-zinc-500">将侵蚀区的所有正面卡移动到墓地区</div>
                </button>

                <button 
                  onClick={() => setErosionChoice('B')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center",
                    erosionChoice === 'B' ? "border-[#f27d26] bg-[#f27d26]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">B</div>
                  <div className="font-bold text-white">保留一张</div>
                  <div className="text-xs text-zinc-500">选择一张保留，其余移动到墓地区</div>
                </button>

                <button 
                  onClick={() => setErosionChoice('C')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center",
                    erosionChoice === 'C' ? "border-[#f27d26] bg-[#f27d26]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">C</div>
                  <div className="font-bold text-white">加入手牌并补充</div>
                  <div className="text-xs text-zinc-500">选择一张加入手牌，其余移至墓地，并从卡组补充一张背面卡</div>
                </button>
              </div>

              {(erosionChoice === 'B' || erosionChoice === 'C') && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <p className="text-[#f27d26] font-bold uppercase tracking-widest text-sm">请点击下方的一张卡牌进行选择</p>
                  <div className="flex gap-4 overflow-x-auto p-4 max-w-full">
                    {me.erosionFront.filter(c => c !== null && c.displayState === 'FRONT_UPRIGHT').map((card, i) => (
                      <motion.div
                        key={card!.gamecardId}
                        whileHover={{ y: -10 }}
                        onClick={() => setSelectedErosionCardId(card!.gamecardId)}
                        className={cn(
                          "w-32 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                          selectedErosionCardId === card!.gamecardId ? "border-[#f27d26] scale-105 shadow-[0_0_20px_rgba(242,125,38,0.4)]" : "border-transparent opacity-60"
                        )}
                      >
                        <CardComponent card={card!} disableZoom={true} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={handleConfirmErosion}
                disabled={!erosionChoice || ((erosionChoice === 'B' || erosionChoice === 'C') && !selectedErosionCardId)}
                className="px-16 py-4 bg-[#f27d26] text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-[#f27d26]/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-[#f27d26]/20"
              >
                确认选择
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Selection Overlay */}
      <AnimatePresence>
        {pendingPlayCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center"
          >
            <div className="max-w-6xl w-full flex flex-col items-center gap-6 p-8 overflow-y-auto max-h-screen">
              <div className="text-center">
                <h3 className="text-4xl font-black italic text-[#f27d26] uppercase tracking-tighter mb-2">支付费用 (PAY COST)</h3>
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Required:</span>
                    <span className={cn(
                      "text-3xl font-black px-4 py-1 rounded-xl",
                      pendingPlayCard.acValue > 0 ? "bg-red-600/20 text-red-500" : "bg-green-600/20 text-green-500"
                    )}>
                      {pendingPlayCard.acValue}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Selected:</span>
                    <span className="text-3xl font-black text-white">
                      {pendingPlayCard.acValue > 0 
                        ? (paymentSelection.useFeijing.length * 3) + paymentSelection.exhaustIds.length 
                        : paymentSelection.erosionFrontIds.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[300px_1fr] gap-12 w-full items-start">
                {/* Left: Card being played */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full aspect-[3/4] rounded-2xl border-2 border-[#f27d26] shadow-[0_0_50px_rgba(242,125,38,0.3)] overflow-hidden">
                    <CardComponent card={pendingPlayCard} disableZoom />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-white uppercase italic tracking-tight">{pendingPlayCard.fullName}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{pendingPlayCard.type} / {pendingPlayCard.color}</div>
                  </div>
                </div>

                {/* Right: Selection Area */}
                <div className="flex flex-col gap-8">
                  {pendingPlayCard.acValue > 0 ? (
                    <>
                      {/* Feijing Section */}
                      {me.hand.some(c => c.feijingMark && c.color === pendingPlayCard.color) && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-blue-400 font-black uppercase italic tracking-widest text-sm">
                            <Zap className="w-4 h-4" />
                            菲晶支付 (Feijing Payment - Cost -3)
                          </div>
                          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {me.hand.filter(c => c.feijingMark && c.color === pendingPlayCard.color).map(card => {
                              const isSelected = paymentSelection.useFeijing.includes(card.gamecardId);
                              return (
                                <motion.div
                                  key={card.gamecardId}
                                  whileHover={{ y: -5 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => togglePaymentFeijing(card.gamecardId)}
                                  className={cn(
                                    "w-28 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                                    isSelected ? "border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]" : "border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                                  )}
                                >
                                  <CardComponent card={card} disableZoom />
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Exhaust Section */}
                      {[...me.unitZone, ...me.itemZone].some(c => c && !c.isExhausted) && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-green-400 font-black uppercase italic tracking-widest text-sm">
                            <Sword className="w-4 h-4" />
                            横置支付 (Exhaust Payment - Cost -1)
                          </div>
                          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {[...me.unitZone, ...me.itemZone].filter(c => c && !c.isExhausted).map(card => {
                              const isSelected = paymentSelection.exhaustIds.includes(card!.gamecardId);
                              return (
                                <motion.div
                                  key={card!.gamecardId}
                                  whileHover={{ y: -5 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => togglePaymentExhaust(card!.gamecardId)}
                                  className={cn(
                                    "w-28 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                                    isSelected ? "border-green-500 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.5)]" : "border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                                  )}
                                >
                                  <CardComponent card={card!} disableZoom />
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Negative Cost Section */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-red-500 font-black uppercase italic tracking-widest text-sm">
                        <Trash2 className="w-4 h-4" />
                        侵蚀支付 (Erosion Payment - Select {Math.abs(pendingPlayCard.acValue)} cards)
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {me.erosionFront.filter(c => c && c.displayState === 'FRONT_UPRIGHT').map(card => {
                          const isSelected = paymentSelection.erosionFrontIds.includes(card!.gamecardId);
                          return (
                            <motion.div
                              key={card!.gamecardId}
                              whileHover={{ y: -5 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => togglePaymentErosionFront(card!.gamecardId)}
                              className={cn(
                                "w-28 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                                isSelected ? "border-red-500 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "border-white/5 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                              )}
                            >
                              <CardComponent card={card!} disableZoom />
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-6 mt-8">
                <button 
                  onClick={handleConfirmPlay}
                  className="px-20 py-4 bg-[#f27d26] text-black font-black italic uppercase tracking-widest rounded-xl hover:bg-[#f27d26]/80 transition-all shadow-2xl shadow-[#f27d26]/20"
                >
                  确认支付并打出
                </button>
                <button 
                  onClick={() => setPendingPlayCard(null)}
                  className="px-20 py-4 bg-zinc-800 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-all border border-white/5"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stack / Countering Overlay */}
      <AnimatePresence>
        {game.counterStack?.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-8">
              <h3 className="text-2xl font-black italic text-white uppercase tracking-widest">
                {game.counterStack[game.counterStack.length - 1]?.ownerUid === myUid ? '等待对手响应...' : '对手打出卡牌'}
              </h3>
              <div className="flex gap-8 items-center">
                {game.counterStack.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0.5, y: 100 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-64 relative"
                  >
                    <CardComponent card={item.card} />
                    <div className="absolute -top-4 -left-4 bg-[#f27d26] text-black px-3 py-1 rounded-full text-[10px] font-black uppercase italic">
                      {game.players[item.ownerUid].displayName}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4">
                {game.counterStack[game.counterStack.length - 1]?.ownerUid !== myUid && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-white/50 font-bold text-sm uppercase tracking-widest">
                      响应倒计时: <span className={cn("text-lg", counterTimer <= 10 ? "text-red-500 animate-pulse" : "text-[#f27d26]")}>{counterTimer}s</span>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        className="px-12 py-3 bg-zinc-800 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-all"
                        onClick={() => {/* Counter logic */}}
                      >
                        进行对抗
                      </button>
                      <button 
                        className="px-12 py-3 bg-white text-black font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all"
                        onClick={handleResolve}
                      >
                        不响应 (结算)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-8 bg-black/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#f27d26] to-red-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black italic tracking-tighter uppercase text-white">神蚀创痕</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase">ID: {gameId?.slice(0, 8)}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsRulebookOpen(true)}
              className="p-2 text-white/40 hover:text-[#f27d26] transition-colors"
              title="查看规则"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            
            {me.isTurn && game.phase === 'MAIN' && (
              <motion.button 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => GameService.advancePhase(gameId, 'DECLARE_BATTLE')}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-black uppercase italic tracking-widest transition-all shadow-lg shadow-red-600/20"
              >
                进入战斗阶段
              </motion.button>
            )}

            {me.isTurn && game.phase === 'BATTLE' && (
              <div className="flex gap-2">
                <motion.button 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDeclareAttack}
                  disabled={selectedAttackers.length === 0}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 rounded-lg text-xs font-black uppercase italic tracking-widest transition-all shadow-lg shadow-red-600/20"
                >
                  {selectedAttackers.length === 2 ? '联军攻击' : '攻击'}
                </motion.button>
                <motion.button 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => GameService.advancePhase(gameId, 'RETURN_MAIN')}
                  className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-black uppercase italic tracking-widest transition-all"
                >
                  返回主要阶段
                </motion.button>
              </div>
            )}

            {me.isTurn && (
              <motion.button 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEndTurn}
                className="px-6 py-2 bg-[#f27d26] hover:bg-[#f27d26]/80 rounded-lg text-xs font-black uppercase italic tracking-widest transition-all shadow-lg shadow-[#f27d26]/20"
              >
                结束回合
              </motion.button>
            )}

            <button 
              onClick={() => navigate('/')} 
              className="p-2 text-white/20 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Arena */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#050505] p-2">
        {/* Top Bar: Phase & Turn */}
        <div className="h-16 flex items-center justify-between px-6 bg-black/40 border-b border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">Turn Count</span>
              <span className="text-2xl font-black italic text-[#f27d26]">ROUND {game.turnCount}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div 
              className={cn(
                "flex flex-col cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors",
                (game.phase === 'MAIN' || game.phase === 'BATTLE') && "hover:bg-white/10"
              )}
              onClick={() => {
                if (game.playerIds[game.currentTurnPlayer] === myUid && (game.phase === 'MAIN' || game.phase === 'BATTLE')) {
                  setShowPhaseMenu(true);
                }
              }}
            >
              <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">Current Phase</span>
              <span className="text-xl font-black italic text-white uppercase tracking-wider">{game.phase}</span>
            </div>
          </div>

          <div className={cn(
             "px-6 py-2 rounded-xl text-sm font-black uppercase italic tracking-[0.2em] shadow-2xl border border-white/10",
             game.playerIds[game.currentTurnPlayer] === myUid 
               ? "bg-[#f27d26] text-black animate-pulse" 
               : "bg-zinc-800 text-white/50"
           )}>
             {game.playerIds[game.currentTurnPlayer] === myUid ? "YOUR ACTION" : "OPPONENT ACTION"}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Phase Menu Overlay */}
          {showPhaseMenu && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPhaseMenu(false)}>
              <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl shadow-2xl min-w-[300px]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black italic text-[#f27d26] mb-4 uppercase tracking-wider">Phase Actions</h3>
                <div className="flex flex-col gap-3">
                  {game.phase === 'MAIN' && (
                    <>
                      {game.turnCount !== 1 && (
                        <button 
                          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                          onClick={() => {
                            GameService.advancePhase(gameId!, 'DECLARE_BATTLE');
                            setShowPhaseMenu(false);
                          }}
                        >
                          Enter Battle Phase
                        </button>
                      )}
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'DECLARE_END');
                          setShowPhaseMenu(false);
                        }}
                      >
                        End Turn
                      </button>
                    </>
                  )}
                  {game.phase === 'BATTLE' && (
                    <>
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'RETURN_MAIN');
                          setShowPhaseMenu(false);
                        }}
                      >
                        End Battle Phase
                      </button>
                    </>
                  )}
                  <button 
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl font-bold uppercase tracking-widest transition-all text-red-400 mt-4"
                    onClick={() => setShowPhaseMenu(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Left Sidebar: Logs */}
          <div className="w-64 flex flex-col border-r border-white/5 bg-black/20 p-4">
            <span className="text-[10px] font-black uppercase italic tracking-widest text-white/40 mb-4 flex items-center gap-2">
              <div className="w-1 h-1 bg-[#f27d26] rounded-full" />
              Battle Logs
            </span>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {game.logs.slice(-30).map((log, i) => (
                <div key={i} className="text-[11px] font-mono text-white/60 leading-relaxed border-l border-white/10 pl-3 hover:text-white/90 transition-colors">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Center: Play Field */}
          <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_rgba(242,125,38,0.03)_0%,_transparent_70%)]">
            <div className="w-[1920px] h-[1080px] shrink-0 shadow-[0_0_80px_rgba(0,0,0,0.9)] rounded-2xl overflow-hidden border-2 border-white/10 relative bg-black">
              {opponent && (
                <PlayField 
                  player={me} 
                  opponent={opponent} 
                  game={game}
                  onCardClick={handleCardClick}
                  onHoverCard={setHoveredCard}
                  onPlayCard={playCardFromHand}
                  paymentSelection={paymentSelection}
                  stack={game.counterStack || []}
                  myUid={myUid}
                  selectedAttackers={selectedAttackers}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rulebook Overlay */}
      <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} />

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(242,125,38,0.05)_0%,_transparent_50%)]" />
      </div>
    </div>
  );
};

