import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { GameState, PlayerState, Card, StackItem, CardEffect, TriggerLocation } from '../types/game';
import { socket, getAuthUser } from '../socket';
import { GameService, cleanForFirestore } from '../services/gameService';
import { CardComponent } from './Card';
import { PlayField } from './PlayField';
import { Rulebook } from './Rulebook';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Shield, Zap, LogOut, BookOpen, Send, Loader2, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const BattleField: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState | null>(null);
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [selectedMulligan, setSelectedMulligan] = useState<string[]>([]);
  const [isMulliganSubmitting, setIsMulliganSubmitting] = useState(false);
  const [paymentSelection, setPaymentSelection] = useState<{ useFeijing: string[], exhaustIds: string[], erosionFrontIds: string[] }>({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
  const [pendingPlayCard, setPendingPlayCard] = useState<Card | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const [isAlliance, setIsAlliance] = useState(false);
  const [selectedDefender, setSelectedDefender] = useState<string | null>(null);
  const [discardSelection, setDiscardSelection] = useState<string[]>([]);
  const [counterTimer, setCounterTimer] = useState<number>(30);
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [selectedErosionCardId, setSelectedErosionCardId] = useState<string | null>(null);
  const [erosionChoice, setErosionChoice] = useState<'A' | 'B' | 'C' | null>(null);
  
  const [cardMenu, setCardMenu] = useState<{
    card: Card;
    zone: string;
    index?: number;
    x: number;
    y: number;
  } | null>(null);
  const [allianceTargetSelection, setAllianceTargetSelection] = useState<string | null>(null);
  const [effectConfirmation, setEffectConfirmation] = useState<{
    card: Card;
    effect: CardEffect;
    effectIndex: number;
    triggerLocation: TriggerLocation;
  } | null>(null);
  const [effectSelection, setEffectSelection] = useState<{
    card: Card;
    effects: { effect: CardEffect; index: number }[];
    triggerLocation: TriggerLocation;
  } | null>(null);

  // Handle 30s response timeout
  useEffect(() => {
    if (!gameId || !game || !getAuthUser() || game.isCountering === 0 || game.counterStack.length === 0) return;

    const myUid = getAuthUser().uid;
    const stackItem = game.counterStack[game.counterStack.length - 1];
    if (!stackItem || !stackItem.timestamp) return;

    const checkTimeout = () => {
      const now = Date.now();
      const elapsed = now - stackItem.timestamp;
      if (elapsed >= 30000) {
        // Timeout reached, resolve automatically
        // Only the player who played the card should trigger this to avoid conflicts.
        if (myUid === stackItem.ownerUid) {
           socket.emit('gameAction', { gameId, action: 'RESOLVE_PLAY' });
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
    socket.emit('joinGame', gameId);
socket.on('gameStateUpdate', (newState) => { setGame(newState); });
return () => { socket.off('gameStateUpdate'); };
  }, [gameId]);

  // Counter Timer Logic
  useEffect(() => {
    if (!game || !gameId || !getAuthUser()) return;
    
    const myUid = getAuthUser().uid;
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

  // Bot Logic
  useEffect(() => {
    if (!game || !gameId) return;
    const bot = game.players['BOT_PLAYER'];
    if (!bot) return;

    const isBotTurn = bot.isTurn;
    const isBotCountering = game.phase === 'COUNTERING' && game.counterStack.length > 0 && game.counterStack[game.counterStack.length - 1].ownerUid !== 'BOT_PLAYER';
    const isBotDefending = game.phase === 'DEFENSE_DECLARATION' && !isBotTurn;
    const isBotResolvingDamage = game.phase === 'DAMAGE_CALCULATION';

    if (isBotTurn || isBotCountering || isBotDefending || isBotResolvingDamage) {
      const timer = setTimeout(() => {
        // Bot moves must be moved to backend entirely based on game state loops, or emitted
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [game, gameId]);

  // Effect Selection Keyboard Shortcuts
  useEffect(() => {
    if (!effectSelection) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num > 0 && num <= effectSelection.effects.length) {
        const selected = effectSelection.effects[num - 1];
        setEffectConfirmation({
          card: effectSelection.card,
          effect: selected.effect,
          effectIndex: selected.index,
          triggerLocation: effectSelection.triggerLocation
        });
        setEffectSelection(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectSelection]);

  if (!game || !getAuthUser()) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-[#f27d26] border-t-transparent rounded-full"
      />
    </div>
  );

  const myUid = getAuthUser().uid;
  const opponentUid = Object.keys(game.players).find(uid => uid !== myUid);
  
  const me = game.players[myUid];
  const opponent = opponentUid ? game.players[opponentUid] : null;

  const canUnitAttack = (card: Card) => {
    if (!card || card.isExhausted || card.canAttack === false) return false;
    const isRush = !!card.isrush;
    const wasPlayedThisTurn = card.playedTurn === game.turnCount;
    return isRush || !wasPlayedThisTurn;
  };

  const getAvailableAttackers = () => {
    return me.unitZone.filter(c => c !== null && canUnitAttack(c)) as Card[];
  };

  const getAvailableDefenders = () => {
    return me.unitZone.filter(c => c !== null && !c.isExhausted) as Card[];
  };

  const handleDeclareAttack = async (attackers: string[] = selectedAttackers, alliance: boolean = isAlliance) => {
    if (!gameId || attackers.length === 0) return;
    try {
      await socket.emit('gameAction', { gameId, action: 'DECLARE_ATTACK', payload: { attackerIds: myUid, isAlliance: attackers, alliance } });
      setSelectedAttackers([]);
      setIsAlliance(false);
      setShowAttackModal(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeclareDefense = async (defenderId?: string) => {
    if (!gameId) return;
    try {
      await socket.emit('gameAction', { gameId, action: 'DECLARE_DEFENSE', payload: { defenderId: defenderId || myUid } });
      setSelectedDefender(null);
      setShowDefenseModal(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEndBattleFree = async () => {
    if (!gameId) return;
    try {
      // Transition to damage calculation
      socket.emit('gameAction', { gameId, action: 'ADVANCE_PHASE', payload: { action: 'PROPOSE_DAMAGE_CALCULATION' } });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleResolveDamage = async () => {
    if (!gameId) return;
    try {
      await socket.emit('gameAction', { gameId, action: 'RESOLVE_DAMAGE' });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDiscardCard = async (cardId: string) => {
    if (!gameId) return;
    try {
      await GameService.discardCard(gameId, myUid, cardId);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEndTurn = async () => {
    if (gameId) {
      await socket.emit('gameAction', { gameId, action: 'ADVANCE_PHASE', payload: { action: 'DECLARE_END' } });
    }
  };

  const handleCardClick = (card: Card, zone: string, index?: number, e?: React.MouseEvent) => {
    // Handle discarding cards
    if (game.phase === 'DISCARD' && zone === 'hand') {
      if (me.uid === getAuthUser()?.uid) {
        handleDiscardCard(card.gamecardId);
      }
      return;
    }

    if (!me.isTurn && game.phase !== 'DEFENSE_DECLARATION') {
      if (e) {
        e.stopPropagation();
        setCardMenu({ card, zone, index, x: e.clientX, y: e.clientY });
      }
      return;
    }

    // Handle selecting defender in Defense Phase
    if (game.phase === 'DEFENSE_DECLARATION' && zone === 'unit') {
      // If it's my turn to defend (opponent is attacking)
      if (opponent?.isTurn && me.unitZone.some(c => c?.gamecardId === card.gamecardId) && !card.isExhausted) {
        setSelectedDefender(prev => prev === card.gamecardId ? null : card.gamecardId);
      }
      return;
    }

    // Handle selecting alliance target
    if (allianceTargetSelection) {
      if (zone === 'unit' && me.unitZone.some(c => c?.gamecardId === card.gamecardId) && canUnitAttack(card) && card.gamecardId !== allianceTargetSelection) {
        handleDeclareAttack([allianceTargetSelection, card.gamecardId], true);
        setAllianceTargetSelection(null);
      }
      return;
    }

    if (!me.isTurn) return;

    // Handle exhausting cards for payment
    if (pendingPlayCard) {
      if (zone === 'unit') {
        if (card.isExhausted) return; // Cannot exhaust already exhausted card
        togglePaymentExhaust(card.gamecardId);
      } else if (zone === 'hand' && card.feijingMark) {
        if (card.gamecardId === pendingPlayCard.gamecardId) {
          alert('不能使用正在打出的卡牌作为菲晶卡支付费用');
          return;
        }
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
    if (game.phase === 'BATTLE_DECLARATION' && zone === 'unit') {
      const isMyCard = me.unitZone.some(c => c?.gamecardId === card.gamecardId);
      if (isMyCard && canUnitAttack(card)) {
        setSelectedAttackers(prev => {
          if (prev.includes(card.gamecardId)) return prev.filter(id => id !== card.gamecardId);
          if (isAlliance) {
            if (prev.length >= 2) return [prev[1], card.gamecardId];
            return [...prev, card.gamecardId];
          } else {
            return [card.gamecardId];
          }
        });
      }
      return;
    }

    // If no specific selection mode is active, show the card menu
    if (e) {
      e.stopPropagation();
      setCardMenu({ card, zone, index, x: e.clientX, y: e.clientY });
    }
  };

  const activateAbility = async (card: Card, effect: CardEffect, effectIndex: number, triggerLocation?: TriggerLocation) => {
    if (!gameId) return;

    if (card.canActivateEffect === false) {
      alert("此卡牌目前无法发动效果！");
      return;
    }

    if (!GameService.checkEffectLimitsAndReqs(game, myUid, card, effect, triggerLocation)) {
      alert("不满足发动条件或已达到使用次数限制！");
      return;
    }

    // Check and pay cost if defined
    if (effect.cost) {
      const canPay = effect.cost(game, me, card);
      if (!canPay) {
        alert("无法支付发动效果的费用！");
        return;
      }
    }
    
    const newStackItem: StackItem = {
      card: card,
      ownerUid: myUid,
      type: 'EFFECT',
      effectIndex: effectIndex,
      timestamp: Date.now()
    };

    game.counterStack.push(newStackItem);
    game.phase = 'COUNTERING';
    game.isCountering = 1;
    GameService.recordEffectUsage(game, myUid, card, effect);
    game.logs.push(`${me.displayName} 发动了 [${card.fullName}] 的 [启] 能力: ${effect.description}`);

    try {
    socket.emit('gameAction', { gameId, action: 'ACTIVATE_EFFECT', payload: { cardId: card.gamecardId, effectIndex: effectIndex } });
} catch (error) {
    console.error("Error activating ability:", error);
}
  };

  const playCardFromHand = async (card: Card) => {
    if (!me.isTurn || !gameId || game.phase !== 'MAIN') return;
    
    const playEffect = card.effects?.find(e => e.type === 'ACTIVATE' || e.type === 'TRIGGER' || e.type === 'ALWAYS');
    const cost = card.acValue;

    if (cost === 0) {
      try {
        await socket.emit('gameAction', { gameId, action: 'PLAY_CARD', payload: { cardId: card.gamecardId, paymentSelection: {} } });
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
      await socket.emit('gameAction', { gameId, action: 'RESOLVE_PLAY' });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleConfirmPlay = async () => {
    if (!gameId || !pendingPlayCard) return;
    try {
      await socket.emit('gameAction', { gameId, action: 'PLAY_CARD', payload: { cardId: pendingPlayCard.gamecardId, paymentSelection: {
        feijingCardId: paymentSelection.useFeijing[0], // Assuming only one feijing card can be used
        exhaustUnitIds: paymentSelection.exhaustIds,
        erosionFrontIds: paymentSelection.erosionFrontIds
      } } });
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardMenu({ card, zone: 'hand', index: i, x: e.clientX, y: e.clientY });
                  }}
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
          {previewCard && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
              onClick={() => setPreviewCard(null)}
            >
              <div className="relative max-h-[90vh] aspect-[3/4]">
                <img 
                  src={previewCard.fullImageUrl || previewCard.imageUrl || `https://picsum.photos/seed/${previewCard.id}/400/600`} 
                  alt={previewCard.fullName}
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
    <div 
      className="h-screen bg-[#050505] flex flex-col overflow-hidden select-none font-sans relative"
      onClick={() => setCardMenu(null)}
    >
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
                      {me.hand.some(c => c.feijingMark && c.color === pendingPlayCard.color && c.gamecardId !== pendingPlayCard.gamecardId) && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-blue-400 font-black uppercase italic tracking-widest text-sm">
                            <Zap className="w-4 h-4" />
                            菲晶支付 (Feijing Payment - Cost -3)
                          </div>
                          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {me.hand.filter(c => c.feijingMark && c.color === pendingPlayCard.color && c.gamecardId !== pendingPlayCard.gamecardId).map(card => {
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
                "hover:bg-white/10"
              )}
              onClick={() => {
                if (game.playerIds[game.currentTurnPlayer] === myUid) {
                  if (['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'].includes(game.phase)) {
                    setShowPhaseMenu(true);
                  }
                } else {
                  if (game.phase === 'DEFENSE_DECLARATION') {
                    setShowPhaseMenu(true);
                  }
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
                          进入战斗阶段 (Enter Battle)
                        </button>
                      )}
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'DECLARE_END');
                          setShowPhaseMenu(false);
                        }}
                      >
                        结束回合 (End Turn)
                      </button>
                    </>
                  )}
                  {game.phase === 'BATTLE_DECLARATION' && (
                    <>
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'RETURN_MAIN');
                          setShowPhaseMenu(false);
                        }}
                      >
                        回到主要阶段 (Return to Main)
                      </button>
                    </>
                  )}
                  {game.phase === 'DEFENSE_DECLARATION' && (
                    <>
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          handleDeclareDefense(undefined);
                          setShowPhaseMenu(false);
                        }}
                      >
                        不防御 (Do Not Defend)
                      </button>
                    </>
                  )}
                  {game.phase === 'BATTLE_FREE' && (
                    <>
                      <button 
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest transition-all"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'PROPOSE_DAMAGE_CALCULATION');
                          setShowPhaseMenu(false);
                        }}
                      >
                        进入伤害判定阶段 (Damage Calculation)
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
                  onPreviewCard={setPreviewCard}
                  onPlayCard={playCardFromHand}
                  paymentSelection={paymentSelection}
                  pendingPlayCard={pendingPlayCard}
                  stack={game.counterStack || []}
                  myUid={myUid}
                  selectedAttackers={selectedAttackers}
                  selectedDefender={selectedDefender || undefined}
                />
              )}
            </div>
          </div>
        </div>

        {/* Defense Declaration Modal */}
        <AnimatePresence>
          {showDefenseModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
            >
              <div className="max-w-5xl w-full flex flex-col items-center gap-8">
                <div className="text-center">
                  <h2 className="text-4xl font-black italic text-blue-500 mb-2 uppercase tracking-tighter">防御宣告 (Defense Declaration)</h2>
                  <p className="text-zinc-400 uppercase tracking-[0.3em] text-sm">请选择防御单位，或选择不防御</p>
                </div>

                <div className="flex flex-col items-center gap-6 w-full">
                  <div className="flex gap-6 overflow-x-auto p-8 max-w-full custom-scrollbar">
                    {getAvailableDefenders().map(card => {
                      const isSelected = selectedDefender === card.gamecardId;
                      return (
                        <motion.div
                          key={card.gamecardId}
                          whileHover={{ y: -10 }}
                          onClick={() => setSelectedDefender(prev => prev === card.gamecardId ? null : card.gamecardId)}
                          className={cn(
                            "w-40 shrink-0 cursor-pointer transition-all rounded-xl overflow-hidden border-2",
                            isSelected ? "border-blue-500 scale-105 shadow-[0_0_30px_rgba(37,99,235,0.4)]" : "border-transparent opacity-60"
                          )}
                        >
                          <CardComponent card={card} disableZoom={true} />
                        </motion.div>
                      );
                    })}
                    {getAvailableDefenders().length === 0 && (
                      <div className="text-white/20 italic text-xl py-20">没有可以防御的单位</div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleDeclareDefense(selectedDefender || undefined)}
                      disabled={!selectedDefender}
                      className="px-16 py-4 bg-blue-600 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-blue-500 transition-all disabled:opacity-30 shadow-xl shadow-blue-600/20"
                    >
                      确认防御
                    </button>
                    <button 
                      onClick={() => handleDeclareDefense(undefined)}
                      className="px-16 py-4 bg-zinc-800 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-all"
                    >
                      不防御
                    </button>
                    <button 
                      onClick={() => {
                        setShowDefenseModal(false);
                        setSelectedDefender(null);
                      }}
                      className="px-16 py-4 bg-zinc-900 border border-white/10 text-white/50 font-black italic uppercase tracking-widest rounded-xl hover:bg-white/5 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Battle Controls Overlay */}
        {game.phase === 'BATTLE_DECLARATION' && me.isTurn && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50">
            <div className="flex gap-4">
              {getAvailableAttackers().length > 0 && (
                <button 
                  onClick={() => setShowAttackModal(true)}
                  className="px-12 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-red-400/50"
                >
                  宣告攻击
                </button>
              )}
              <button 
                onClick={() => GameService.advancePhase(gameId!, 'RETURN_MAIN')}
                className="px-12 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase italic tracking-widest rounded-xl shadow-xl border border-white/20"
              >
                回到主要阶段
              </button>
            </div>
          </div>
        )}

        {game.phase === 'DEFENSE_DECLARATION' && !me.isTurn && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-8 pointer-events-auto">
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-zinc-900 border-2 border-blue-600/50 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(37,99,235,0.3)]"
              >
                <h2 className="text-4xl font-black italic text-blue-500 uppercase tracking-widest">防御宣告 (DEFENSE)</h2>
                <div className="flex gap-6">
                  <button 
                    onClick={() => setShowDefenseModal(true)}
                    className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase italic tracking-widest rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400/50 transition-all hover:scale-105 active:scale-95"
                  >
                    进行防御
                  </button>
                  <button 
                    onClick={() => handleDeclareDefense(undefined)}
                    className="px-12 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase italic tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl border border-white/20"
                  >
                    不防御
                  </button>
                </div>
                <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-bold">点击“进行防御”以在弹出窗口中选择防御单位</p>
              </motion.div>
            </div>
          </div>
        )}

        {game.phase === 'BATTLE_FREE' && me.isTurn && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50">
            <button 
              onClick={handleEndBattleFree}
              className="px-16 py-4 bg-red-600/90 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-red-400/50 backdrop-blur-md"
            >
              结束战斗自由阶段
            </button>
            <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] bg-black/50 px-4 py-1 rounded-full backdrop-blur-sm">你可以使用故事卡或发动【启】能力</p>
          </div>
        )}

        {/* Main Phase Buttons */}
        {game.phase === 'MAIN' && me.isTurn && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-50 pointer-events-none">
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => GameService.advancePhase(gameId!, 'DECLARE_BATTLE')}
              className="pointer-events-auto px-8 py-3 bg-red-600/90 backdrop-blur-md hover:bg-red-500 rounded-xl text-lg font-black uppercase italic tracking-widest transition-all shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-red-400/50 text-white"
            >
              进入战斗阶段
            </motion.button>
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => GameService.advancePhase(gameId!, 'DECLARE_END')}
              className="pointer-events-auto mt-2 px-6 py-2 bg-zinc-800/90 backdrop-blur-md hover:bg-zinc-700 rounded-lg text-sm font-black uppercase italic tracking-widest transition-all border border-white/10 text-white/70 hover:text-white"
            >
              结束回合
            </motion.button>
          </div>
        )}

        {game.phase === 'DAMAGE_CALCULATION' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border-2 border-red-600/30 p-12 rounded-3xl flex flex-col items-center gap-8 shadow-2xl"
            >
              <h2 className="text-5xl font-black italic text-red-500 uppercase tracking-tighter">伤害判定 (DAMAGE)</h2>
              <button 
                onClick={handleResolveDamage}
                className="px-20 py-5 bg-red-600 hover:bg-red-500 text-white font-black uppercase italic tracking-widest rounded-2xl shadow-xl shadow-red-600/40 transition-all hover:scale-105"
              >
                确认判定
              </button>
            </motion.div>
          </div>
        )}

        {game.phase === 'DISCARD' && me.uid === getAuthUser()?.uid && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-8">
              <h2 className="text-4xl font-black italic text-[#f27d26] uppercase tracking-widest">弃置卡牌</h2>
              <p className="text-white/60 text-lg">你的手牌超过 6 张，请选择卡牌弃置 (当前: {me.hand.length})</p>
              <div className="flex gap-4 overflow-x-auto max-w-5xl p-8 custom-scrollbar">
                {me.hand.map(card => (
                  <motion.div 
                    key={card.gamecardId}
                    whileHover={{ y: -20, scale: 1.1 }}
                    onClick={() => handleDiscardCard(card.gamecardId)}
                    className="w-32 cursor-pointer transition-all hover:shadow-[0_0_30px_rgba(242,125,38,0.4)]"
                  >
                    <CardComponent card={card} disableZoom />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rulebook Overlay */}
      <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} />

      {/* Card Action Menu */}
      <AnimatePresence>
        {cardMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[150] bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col min-w-[160px]"
            style={{ 
              left: Math.min(cardMenu.x, window.innerWidth - 160), 
              top: Math.min(cardMenu.y, window.innerHeight - 200) 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 bg-black/50 border-b border-white/10 text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {cardMenu.card.fullName}
            </div>
            
            {/* Play Action */}
            {(() => {
              const canPlay = cardMenu.zone === 'hand' && game.phase === 'MAIN' && me.isTurn && GameService.canPlayCard(me, cardMenu.card).canPlay;
              if (!canPlay) return null;
              return (
                <button
                  className="px-4 py-3 text-left text-sm font-bold text-black bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center gap-2"
                  onClick={() => {
                    playCardFromHand(cardMenu.card);
                    setCardMenu(null);
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-black/50" />
                  打出卡牌 (Play)
                </button>
              );
            })()}

            {/* Activate Action */}
            {(game.phase === 'MAIN' || game.phase === 'BATTLE_FREE') && me.isTurn && (
              (() => {
                const isMyCard = [...me.unitZone, ...me.itemZone, ...me.erosionFront, ...me.hand].some(c => c?.gamecardId === cardMenu.card.gamecardId);
                if (!isMyCard) return null;

                const activateEffects = cardMenu.card.effects?.map((effect, index) => ({ effect, index }))
                  .filter(e => e.effect.type === 'ACTIVATE' || e.effect.type === 'ACTIVATED') || [];

                const validEffects = activateEffects.filter(e => {
                  if (!e.effect.triggerLocation || e.effect.triggerLocation.length === 0) {
                    return cardMenu.zone === 'unit' || cardMenu.zone === 'item';
                  }
                  const zoneMap: Record<string, string> = {
                    'unit': 'UNIT_ZONE',
                    'item': 'ITEM_ZONE',
                    'erosion_front': 'EROSION_FRONT',
                    'hand': 'HAND'
                  };
                  return e.effect.triggerLocation.includes(zoneMap[cardMenu.zone] as any);
                });

                if (validEffects.length > 0) {
                  return (
                    <button
                      className="px-4 py-3 text-left text-sm font-bold text-white bg-green-600 hover:bg-green-500 transition-colors flex items-center gap-2"
                      onClick={() => {
                        const zoneMap: Record<string, string> = {
                          'unit': 'UNIT',
                          'item': 'ITEM',
                          'erosion_front': 'EROSION_FRONT',
                          'hand': 'HAND'
                        };
                        const triggerLocation = zoneMap[cardMenu.zone] as TriggerLocation;
                        
                        if (validEffects.length === 1) {
                          setEffectConfirmation({
                            card: cardMenu.card,
                            effect: validEffects[0].effect,
                            effectIndex: validEffects[0].index,
                            triggerLocation
                          });
                        } else {
                          setEffectSelection({
                            card: cardMenu.card,
                            effects: validEffects,
                            triggerLocation
                          });
                        }
                        setCardMenu(null);
                      }}
                    >
                      <div className="w-2 h-2 rounded-full bg-white/50" />
                      发动效果 (Activate)
                    </button>
                  );
                }
                return null;
              })()
            )}

            {/* Attack Actions */}
            {game.phase === 'BATTLE_DECLARATION' && me.isTurn && cardMenu.zone === 'unit' && (
              (() => {
                const isMyCard = me.unitZone.some(c => c?.gamecardId === cardMenu.card.gamecardId);
                if (isMyCard && canUnitAttack(cardMenu.card)) {
                  return (
                    <>
                      <button
                        className="px-4 py-3 text-left text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-2 border-b border-white/10"
                        onClick={() => {
                          handleDeclareAttack([cardMenu.card.gamecardId], false);
                          setCardMenu(null);
                        }}
                      >
                        <Sword className="w-4 h-4 text-white/70" />
                        单体攻击 (Attack)
                      </button>
                      <button
                        className="px-4 py-3 text-left text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setAllianceTargetSelection(cardMenu.card.gamecardId);
                          setCardMenu(null);
                        }}
                      >
                        <Sword className="w-4 h-4 text-white/70" />
                        联军攻击 (Alliance)
                      </button>
                    </>
                  );
                }
                return null;
              })()
            )}

            {/* Defend Action */}
            {game.phase === 'DEFENSE_DECLARATION' && opponent?.isTurn && cardMenu.zone === 'unit' && (
              (() => {
                const isMyCard = me.unitZone.some(c => c?.gamecardId === cardMenu.card.gamecardId);
                if (isMyCard && !cardMenu.card.isExhausted) {
                  return (
                    <button
                      className="px-4 py-3 text-left text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2"
                      onClick={() => {
                        handleDeclareDefense(cardMenu.card.gamecardId);
                        setCardMenu(null);
                      }}
                    >
                      <Shield className="w-4 h-4 text-white/70" />
                      防御 (Defend)
                    </button>
                  );
                }
                return null;
              })()
            )}

            {/* Detail Action */}
            <button
              className="px-4 py-3 text-left text-sm font-bold text-black bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2"
              onClick={() => {
                setPreviewCard(cardMenu.card);
                setCardMenu(null);
              }}
            >
              <BookOpen className="w-4 h-4 text-black/70" />
              查看详情 (Detail)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alliance Target Selection Overlay */}
      <AnimatePresence>
        {allianceTargetSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="bg-zinc-900/90 border border-orange-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.3)]">
              <p className="text-orange-400 font-bold tracking-widest uppercase flex items-center gap-3">
                <Sword className="w-5 h-5" />
                请选择另一个未横置的单位组成联军
              </p>
            </div>
            <button
              onClick={() => setAllianceTargetSelection(null)}
              className="absolute top-8 right-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold tracking-widest pointer-events-auto transition-colors"
            >
              取消 (Cancel)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effect Selection Modal */}
      <AnimatePresence>
        {effectSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
            onClick={() => setEffectSelection(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black italic text-red-500 mb-6 uppercase tracking-tighter">选择要发动的效果</h3>
              <div className="space-y-4">
                {effectSelection.effects.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setEffectConfirmation({
                        card: effectSelection.card,
                        effect: e.effect,
                        effectIndex: e.index,
                        triggerLocation: effectSelection.triggerLocation
                      });
                      setEffectSelection(null);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-white/10 bg-black/40 hover:bg-white/5 hover:border-red-500/50 transition-all group flex items-start gap-4"
                  >
                    <div className="shrink-0 w-8 h-8 bg-white/10 text-white rounded flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-red-600">
                          {e.effect.type}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed group-hover:text-white transition-colors">
                        {e.effect.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setEffectSelection(null)}
                  className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Effect Confirmation Modal */}
      <AnimatePresence>
        {effectConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
            onClick={() => setEffectConfirmation(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-red-500/30 rounded-2xl max-w-xl w-full p-8 shadow-[0_0_50px_rgba(220,38,38,0.15)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black italic text-red-500 mb-6 uppercase tracking-tighter flex items-center gap-3">
                <Zap className="w-6 h-6" />
                确认发动效果
              </h3>
              
              <div className="bg-black/50 p-6 rounded-xl border border-white/5 mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-red-600">
                    {effectConfirmation.effect.type}
                  </span>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    {effectConfirmation.card.fullName}
                  </span>
                </div>
                <p className="text-base text-zinc-200 leading-relaxed">
                  {effectConfirmation.effect.description}
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setEffectConfirmation(null)}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    activateAbility(
                      effectConfirmation.card, 
                      effectConfirmation.effect, 
                      effectConfirmation.effectIndex, 
                      effectConfirmation.triggerLocation
                    );
                    setEffectConfirmation(null);
                  }}
                  className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all hover:scale-105"
                >
                  确认发动
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confrontation Overlay */}
      <AnimatePresence>
        {game.phase === 'BATTLE_FREE' && game.battleState?.askConfront === 'ASKING_OPPONENT' && !me.isTurn && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="bg-zinc-900 border-2 border-[#f27d26]/50 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(242,125,38,0.3)]">
               <h2 className="text-3xl font-black italic text-[#f27d26] uppercase tracking-widest">确认对抗</h2>
               <p className="text-white/80">对手准备进入伤害判定阶段。你是否要在这之前进行对抗？</p>
               <div className="flex gap-4">
                 <button onClick={() => GameService.advancePhase(gameId!, 'CONFIRM_CONFRONTATION')} className="px-8 py-3 bg-[#f27d26] text-black font-black uppercase rounded-lg hover:bg-orange-400">进行对抗</button>
                 <button onClick={() => GameService.advancePhase(gameId!, 'DECLINE_CONFRONTATION')} className="px-8 py-3 bg-zinc-700 text-white font-black uppercase rounded-lg hover:bg-zinc-600">不进行对抗</button>
               </div>
            </div>
          </motion.div>
        )}
        
        {game.phase === 'BATTLE_FREE' && game.battleState?.askConfront === 'ASKING_TURN_PLAYER' && me.isTurn && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="bg-zinc-900 border-2 border-[#f27d26]/50 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(242,125,38,0.3)]">
               <h2 className="text-3xl font-black italic text-[#f27d26] uppercase tracking-widest">确认对抗</h2>
               <p className="text-white/80">对手拒绝了对抗。你是否要进行对抗？(选择否则直接进入伤害判定)</p>
               <div className="flex gap-4">
                 <button onClick={() => GameService.advancePhase(gameId!, 'CONFIRM_CONFRONTATION')} className="px-8 py-3 bg-[#f27d26] text-black font-black uppercase rounded-lg hover:bg-orange-400">进行对抗</button>
                 <button onClick={() => GameService.advancePhase(gameId!, 'DECLINE_CONFRONTATION')} className="px-8 py-3 bg-zinc-700 text-white font-black uppercase rounded-lg hover:bg-zinc-600">不对抗，进入伤害判定</button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Window / Preview Card Modal */}
      <AnimatePresence>
        {previewCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-12 custom-scrollbar"
            onClick={() => setPreviewCard(null)}
          >
            <div className="flex gap-16 max-w-7xl max-h-screen items-center" onClick={e => e.stopPropagation()}>
              <div className="w-[400px] shrink-0 h-auto">
                <img 
                  src={previewCard.fullImageUrl || previewCard.imageUrl || `https://picsum.photos/seed/${previewCard.id}/400/600`} 
                  alt={previewCard.fullName}
                  className="w-full object-contain rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] border-2 border-white/10"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col gap-6 text-white max-w-lg bg-zinc-900/50 p-8 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-[#f27d26] mb-1">{previewCard.fullName}</h2>
                    <span className="text-sm font-bold tracking-widest text-zinc-500 uppercase">{previewCard.type} | {previewCard.color} | {previewCard.rarity}</span>
                  </div>
                  <button onClick={() => setPreviewCard(null)} className="p-3 bg-white/5 hover:bg-red-500 rounded-full transition-colors group">
                     <X className="w-6 h-6 text-white group-hover:text-black" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">Affected By Effects:</h3>
                  {previewCard.influencingEffects && previewCard.influencingEffects.length > 0 ? (
                    <div className="space-y-4">
                      {previewCard.influencingEffects.map((eff, idx) => (
                        <div key={idx} className="flex gap-4 items-start bg-black/40 p-4 rounded-xl border border-white/5">
                          <span className="bg-[#f27d26] text-black font-black rounded w-6 h-6 flex items-center justify-center shrink-0">{idx + 1}</span>
                          <div className="flex flex-col">
                            <span className="text-white font-bold opacity-80">{eff.description}</span>
                            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">By {eff.sourceCardName}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-zinc-500 italic text-sm">No active effects applied to this card.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(242,125,38,0.05)_0%,_transparent_50%)]" />
      </div>

      {/* Full Image Overlay */}
      <AnimatePresence>
        {previewCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 cursor-pointer"
            onClick={() => setPreviewCard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-w-4xl w-full max-h-full flex flex-col md:flex-row gap-8 items-center md:items-stretch"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Full Image */}
              <div className="relative aspect-[3/4] h-[60vh] md:h-[80vh] rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
                <img 
                  src={previewCard.fullImageUrl || previewCard.imageUrl || `https://picsum.photos/seed/${previewCard.id}/400/600`} 
                  alt={previewCard.fullName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Close Button Mobile */}
                <button 
                  onClick={() => setPreviewCard(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 rounded-full md:hidden"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Card Details Side */}
              <div className="flex-1 bg-zinc-900/50 backdrop-blur-md p-6 rounded-2xl border border-white/10 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-white">{previewCard.fullName}</h2>
                    <p className="text-zinc-400 font-bold">{previewCard.faction} • {previewCard.rarity}</p>
                  </div>
                  <button 
                    onClick={() => setPreviewCard(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block"
                  >
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Access Cost</p>
                    <p className={cn("text-2xl font-black", previewCard.acValue < 0 ? "text-blue-400" : "text-red-500")}>
                      {previewCard.acValue > 0 ? `+${previewCard.acValue}` : previewCard.acValue}
                    </p>
                  </div>
                  {previewCard.type === 'UNIT' && (
                    <>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                        <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Damage</p>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl font-black text-blue-400">{previewCard.damage}</span>
                          <Sword className="w-5 h-5 text-blue-400" />
                        </div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-center">
                        <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Power</p>
                        <p className="text-2xl font-black text-white">{previewCard.power}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Effects</h4>
                  {previewCard.effects?.map((effect, idx) => (
                    <div key={idx} className="bg-black/40 p-4 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold text-white",
                          effect.type === '永' ? "bg-green-600" : 
                          effect.type === '诱' ? "bg-blue-600" :
                          effect.type === '启' ? "bg-red-600" : "bg-zinc-600"
                        )}>
                          {effect.type}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{effect.description}</p>
                    </div>
                  ))}
                </div>

                {previewCard.flavorText && (
                  <div className="mt-8 pt-8 border-t border-white/5">
                    <p className="text-xs italic text-zinc-500 leading-relaxed">"{previewCard.flavorText}"</p>
                  </div>
                )}
                
                {/* Influencing Effects */}
                {previewCard.influencingEffects && previewCard.influencingEffects.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-white/5">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      当前受到的影响
                    </h4>
                    <div className="space-y-2">
                      {previewCard.influencingEffects.map((effect, idx) => (
                        <div key={idx} className="bg-blue-900/20 p-3 rounded-lg border border-blue-500/20 text-sm text-blue-200">
                          <span className="font-bold text-white mr-2">[{effect.sourceCardName}]</span>
                          {effect.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

