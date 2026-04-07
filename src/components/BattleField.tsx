import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { GameState, PlayerState, Card, StackItem, CardEffect, TriggerLocation } from '../types/game';
import { socket, getAuthUser, onceAuthenticated, isSocketAuthenticated } from '../socket';

import { GameService } from '../services/gameService';

import { CardComponent } from './Card';
import { PlayField } from './PlayField';
import { Rulebook } from './Rulebook';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Shield, Zap, LogOut, BookOpen, Send, Loader2, Trash2, X, Play, Search, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export const BattleField: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const authUser = getAuthUser();
  const myUid = authUser?.uid;

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
  const [showPhaseMenu, setShowPhaseMenu] = useState(false);
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [selectedErosionCardId, setSelectedErosionCardId] = useState<string | null>(null);
  const [erosionChoice, setErosionChoice] = useState<'A' | 'B' | 'C' | null>(null);

  const [timer, setTimer] = useState<number>(30);
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

  // Universal Visual Timer Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (game.phaseTimerStart || now);

      const sharedPhases = ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'];
      const independentPhases = ['EROSION', 'DEFENSE_DECLARATION', 'COUNTERING', 'MULLIGAN'];

      const isWaiting = (game.counterStack && game.counterStack.length > 0) ||
                        (game.battleState && game.battleState.askConfront);
 
       let remaining = 30000;
       if (sharedPhases.includes(game.phase) && !isWaiting) {
         remaining = Math.max(0, (game.mainPhaseTimeRemaining || 300000) - elapsed);
       } else {
         remaining = Math.max(0, 30000 - elapsed);
       }
 
       const newTimerValue = Math.floor(remaining / 1000);
       setTimer(newTimerValue);

      // Auto-resolve for player if timeout during Countering
      if (game.phase === 'COUNTERING' && game.priorityPlayerId === myUid && remaining <= 0) {
        clearInterval(interval);
        handleResolve();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [game?.phase, game?.phaseTimerStart, game?.mainPhaseTimeRemaining, game?.priorityPlayerId, myUid]);

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

  const deckId = location.state?.deckId || localStorage.getItem(`deck_${gameId}`);

  useEffect(() => {
    if (location.state?.deckId) {
      localStorage.setItem(`deck_${gameId}`, location.state.deckId);
    }
  }, [gameId, location.state?.deckId]);

  useEffect(() => {
    if (!gameId || gameId === 'undefined') {
      console.error('[BattleField] Invalid gameId:', gameId);
      navigate('/');
      return;
    }

    const joinAndListen = () => {
      console.log('[BattleField] Joining game:', gameId);
      socket.off('gameStateUpdate').on('gameStateUpdate', (newState: any) => {
        setGame(newState);
      });
      socket.emit('joinGame', { gameId, deckId });
    };

    const token = localStorage.getItem('token');

    if (isSocketAuthenticated()) {
      joinAndListen();
    } else if (token) {
      if (!socket.connected) socket.connect();
      socket.once('authenticated', joinAndListen);
      socket.emit('authenticate', token);
    }

    return () => {
      socket.off('gameStateUpdate');
    };
  }, [gameId, deckId]);




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

  // const authUser = getAuthUser();
  // const myUid = authUser?.uid;
  const me = (game && myUid) ? game.players[myUid] : null;
  const opponentUid = (game && myUid) ? Object.keys(game.players).find(uid => uid !== myUid) : null;
  const opponent = (game && opponentUid) ? game.players[opponentUid] : null;

  if (!game || !myUid || !me) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]">
        <div className="w-12 h-12 border-4 border-[#f27d26] border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-[#f27d26] font-bold text-xl mb-2 tracking-[0.2em] uppercase">SYNCING BATTLEFIELD</h2>
        <p className="text-zinc-500 text-sm max-w-md leading-relaxed">
          Loading game data and establishing connection with server, please wait...
        </p>
      </div>
    );
  }


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
      await GameService.declareAttack(gameId, myUid, attackers, alliance);
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
      await GameService.declareDefense(gameId, myUid, defenderId);
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
      await GameService.advancePhase(gameId, 'PROPOSE_DAMAGE_CALCULATION');
    } catch (error: any) {
      alert(error.message);
    }
  };


  const handleResolveDamage = async () => {
    if (!gameId) return;
    try {
      await GameService.resolveDamage(gameId);
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
      await GameService.advancePhase(gameId, 'DECLARE_END');
    }
  };


  const handleCardClick = (card: Card, zone: string, index?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // High-priority selection modes (multi-step actions)
    if (pendingPlayCard) {
      if (zone === 'unit') {
        if (card.isExhausted) return;
        togglePaymentExhaust(card.gamecardId);
      } else if (zone === 'hand' && card.feijingMark) {
        if (card.gamecardId === pendingPlayCard.gamecardId) return;
        if (card.color !== pendingPlayCard.color) return;
        togglePaymentFeijing(card.gamecardId);
      } else if (zone === 'erosion_front') {
        if (card.displayState !== 'FRONT_UPRIGHT') return;
        togglePaymentErosionFront(card.gamecardId);
      }
      return;
    }

    if (allianceTargetSelection) {
      const isPartnerUnit = me.unitZone.some(c => c?.gamecardId === card.gamecardId) && canUnitAttack(card) && card.gamecardId !== allianceTargetSelection;

      if (zone === 'unit' && isPartnerUnit) {
        // Instead of immediate action, fall through to show the Action Menu with "Attack (Allied Forces)"
      } else {
        return;
      }
    }

    // Direct Defense Selection
    if (game.phase === 'DEFENSE_DECLARATION' && !me.isTurn) {
      if (zone === 'unit' && me.unitZone.some(u => u?.gamecardId === card.gamecardId) && !card.isExhausted) {
        handleDeclareDefense(card.gamecardId);
        return;
      }
    }

    // Default: Show Action Menu
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      setCardMenu({
        card,
        zone,
        index,
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };


  const activateAbility = async (card: Card, effect: CardEffect, effectIndex: number, triggerLocation?: TriggerLocation) => {
    if (!gameId) return;

    try {
      await GameService.activateEffect(gameId, myUid, card.gamecardId, effectIndex);
      setEffectConfirmation(null);
      setEffectSelection(null);
    } catch (error: any) {
      alert(error.message);
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
      if (game.phase === 'COUNTERING') {
        await GameService.passConfrontation(gameId);
      } else {
        await GameService.resolvePlay(gameId);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };


  const handleConfirmPlay = async () => {
    if (!gameId || !pendingPlayCard) return;
    try {
      await GameService.playCard(gameId, myUid, pendingPlayCard.gamecardId, {
        feijingCardId: paymentSelection.useFeijing[0],
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
        <h2 className="text-4xl font-black italic text-[#f27d26] mb-4 uppercase tracking-tighter">MULLIGAN PHASE</h2>
        <p className="text-zinc-400 mb-12 uppercase tracking-[0.3em] text-sm">Click cards to preview. Select cards to redraw.</p>

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
                  {isSelected ? "REDRAW" : "KEEP"}
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
          {selectedMulligan.length > 0 ? `REDRAW ${selectedMulligan.length} CARDS` : 'KEEP INITIAL HAND'}
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
        <p className="text-zinc-400 uppercase tracking-widest text-sm">Waiting for opponent to finish mulligan...</p>
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
        {game.phase === 'EROSION' && me.isTurn && me.erosionFront.some(c => c !== null && c.displayState === 'FRONT_UPRIGHT') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="max-w-4xl w-full flex flex-col items-center gap-8">
              <div className="text-center">
                <h2 className="text-4xl font-black italic text-[#f27d26] mb-2 uppercase tracking-tighter">EROSION PHASE</h2>
                <p className="text-zinc-400 uppercase tracking-[0.3em] text-sm">Choose how to process face-up erosion cards</p>
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
                  <div className="font-bold text-white">MOVE ALL TO GRAVE</div>
                  <div className="text-xs text-zinc-500">Move all face-up cards in the Erosion Zone to the Graveyard</div>
                </button>

                <button
                  onClick={() => setErosionChoice('B')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center",
                    erosionChoice === 'B' ? "border-[#f27d26] bg-[#f27d26]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">B</div>
                  <div className="font-bold text-white">KEEP ONE</div>
                  <div className="text-xs text-zinc-500">Choose one card to keep, move others to the Graveyard</div>
                </button>

                <button
                  onClick={() => setErosionChoice('C')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 text-center",
                    erosionChoice === 'C' ? "border-[#f27d26] bg-[#f27d26]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-bold">C</div>
                  <div className="font-bold text-white">ADD TO HAND</div>
                  <div className="text-xs text-zinc-500">Choose one to add to hand, move others to Grave, replenish one from deck</div>
                </button>
              </div>

              {(erosionChoice === 'B' || erosionChoice === 'C') && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <p className="text-[#f27d26] font-bold uppercase tracking-widest text-sm">Please click a card below to select</p>
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
                CONFIRM CHOICE
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
                  CONFIRM & PLAY
                </button>
                <button
                  onClick={() => setPendingPlayCard(null)}
                  className="px-20 py-4 bg-zinc-800 text-white font-black italic uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-all border border-white/5"
                >
                  CANCEL
                </button>
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
            <span className="text-lg font-black italic tracking-tighter uppercase text-white">OVERHEAT</span>
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
                START BATTLE
              </motion.button>
            )}

            {me.isTurn && (game.phase === 'BATTLE_DECLARATION' || game.phase === 'BATTLE_FREE') && (
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
                  {selectedAttackers.length === 2 ? 'ALLIANCE' : 'ATTACK'}
                </motion.button>
                <motion.button
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => GameService.advancePhase(gameId, 'RETURN_MAIN')}
                  className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-black uppercase italic tracking-widest transition-all"
                >
                  RETURN MAIN
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
                END TURN
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
            <div className="flex flex-col relative group">
              <div
                className={cn(
                  "flex flex-col cursor-pointer hover:bg-white/5 px-4 py-1 rounded transition-all border border-transparent",
                  showPhaseMenu && "bg-white/10 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                )}
                onClick={() => {
                  const isMyTurn = game.playerIds[game.currentTurnPlayer] === myUid;
                  if (isMyTurn && ['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'].includes(game.phase)) {
                    setShowPhaseMenu(!showPhaseMenu);
                  } else if (!isMyTurn && game.phase === 'DEFENSE_DECLARATION') {
                    setShowPhaseMenu(!showPhaseMenu);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/40 uppercase font-black tracking-widest flex items-center gap-2">
                      Current Phase
                      {['MULLIGAN', 'EROSION', 'COUNTERING', 'DEFENSE_DECLARATION', 'BATTLE_FREE'].includes(game.phase) && (
                        <span className="inline-block w-2 h-2 rounded-full animate-pulse bg-orange-500" />
                      )}
                    </span>
                    <span className="text-xl font-black italic text-white uppercase tracking-wider">
                      {game.phase.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="h-10 w-px bg-white/10 mx-2" />
                  <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-white/5 shadow-inner">
                    <Loader2 className={cn("w-4 h-4 animate-spin text-[#f27d26]", timer <= 10 && "text-red-500")} />
                    <span className={cn(
                      "text-2xl font-black italic tabular-nums leading-none",
                      timer > 10 ? "text-white" : "text-red-500 animate-pulse"
                    )}>
                      {['MAIN', 'BATTLE_DECLARATION', 'BATTLE_FREE'].includes(game.phase)
                        ? `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`
                        : `${timer}s`
                      }
                    </span>
                  </div>
                </div>
              </div>


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
          {/* Playground Area */}


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
                  allianceInitiator={allianceTargetSelection || undefined}
                />
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {game.phase === 'COUNTERING' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 top-[15%] z-[140] flex flex-col items-center gap-4 pointer-events-none"
            >
              <div className={cn(
                "bg-zinc-900/90 border border-red-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.3)] backdrop-blur-sm flex items-center gap-6",
                game.priorityPlayerId === myUid && "border-red-500 animate-pulse ring-2 ring-red-500/20"
              )}>
                <div className="flex flex-col items-center">
                  <p className="text-red-500 font-black tracking-widest uppercase flex items-center gap-3 text-lg italic">
                    <ShieldCheck className="w-6 h-6 animate-pulse" />
                    CONFRONTATION PHASE
                  </p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">
                    {game.priorityPlayerId === myUid ? "YOUR TURN TO RESPOND" : `WAITING FOR ${game.players[game.priorityPlayerId!].displayName.toUpperCase()}`}
                  </p>
                </div>

                {game.priorityPlayerId === myUid && (
                  <div className="flex items-center gap-3 pointer-events-auto">
                    <button
                      onClick={handleResolve}
                      className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-black italic uppercase tracking-widest rounded-full transition-all flex items-center gap-2 border border-red-400 group"
                    >
                      <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                      PASS
                    </button>
                    <div className="h-4 w-px bg-white/20" />
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-red-500/30">
                      <span className="text-red-500 font-mono text-xl font-black">{timer}s</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stack Visualization */}
              <div className="flex gap-4 mt-8">
                {game.counterStack.map((item, idx) => (
                  <motion.div
                    key={`${idx}-${item.timestamp}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={cn(
                      "w-32 h-44 rounded-lg overflow-hidden border-2 shadow-2xl relative",
                      idx === game.counterStack.length - 1 ? "border-red-500 scale-110 z-10" : "border-white/10 opacity-50 grayscale"
                    )}
                  >
                    {item.card ? (
                      <CardComponent card={item.card} disableZoom />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-4 text-center">
                        <Sword className="w-8 h-8 text-white/20 mb-2" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 w-5 h-5 bg-black/80 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-black italic text-white shadow-lg">
                      {idx + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Defense Declaration Prompt Overlay (Replacement for Modal) */}
        <AnimatePresence>
          {game.phase === 'DEFENSE_DECLARATION' && !me.isTurn && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 top-[15%] z-[140] flex flex-col items-center gap-4 pointer-events-auto"
            >
              <div className="bg-zinc-900/90 border border-blue-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.3)] backdrop-blur-sm">
                <p className="text-blue-400 font-bold tracking-widest uppercase flex items-center gap-3 text-sm">
                  <Shield className="w-5 h-5" />
                  SELECT DEFENSE UNIT OR PASS
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleDeclareDefense(undefined)}
                  className="px-10 py-2 bg-blue-600/10 hover:bg-blue-600/20 rounded-full text-blue-200 font-black italic tracking-widest transition-all backdrop-blur-md border border-blue-500/20 shadow-lg group"
                >
                  NO DEFENSE <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">(PASS)</span>
                </button>
              </div>
            </motion.div>
          )}

          {game.phase === 'DEFENSE_DECLARATION' && me.isTurn && (
            <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-900/90 border border-blue-500/50 p-12 rounded-2xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(37,99,235,0.2)]"
              >
                <div className="w-16 h-16 relative">
                  <Shield className="w-full h-full text-blue-500 animate-pulse" />
                  <Loader2 className="absolute inset-0 w-full h-full text-blue-400 animate-spin opacity-50" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-black italic text-blue-500 uppercase tracking-widest mb-2">WAITING FOR DEFENSE</h2>
                  <p className="text-blue-200/60 font-medium tracking-wide">Opponent is choosing a unit to block your attack...</p>
                </div>
                <div className="px-6 py-2 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <span className="text-blue-400 font-bold tabular-nums">
                    {timer}s
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {game.phase === 'DISCARD' && me.uid === getAuthUser()?.uid && me.isTurn && me.hand.length > 6 && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md">
              <div className="flex flex-col items-center gap-8">
                <h2 className="text-4xl font-black italic text-[#f27d26] uppercase tracking-widest">DISCARD CARDS</h2>
                <p className="text-white/60 text-lg">Your hand exceeds 6 cards. Please choose cards to discard (Current: {me.hand.length})</p>
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
        </AnimatePresence>



      </div>
      {/* Rulebook Overlay */}
      <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} />

      {/* Card Action Menu */}
      {/* Unified Card Action Menu */}
      <AnimatePresence>
        {cardMenu && (
          <>
            <div className="fixed inset-0 z-[190]" onClick={() => setCardMenu(null)}></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="fixed z-[200] flex flex-col gap-1 w-40"
              style={{
                left: cardMenu.x + 85,
                top: cardMenu.y,
                transform: 'translate(0, -50%)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Action: Play (Yellow) */}
              {cardMenu.zone === 'hand' && me.isTurn && (game.phase === 'MAIN' || (game.phase === 'BATTLE_FREE' && cardMenu.card.type === 'STORY')) && (
                (() => {
                  const check = GameService.canPlayCard(me, cardMenu.card);
                  if (check.canPlay) {
                    return (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className="px-4 py-1.5 text-[10px] font-bold text-black bg-[#facc15] rounded-full shadow-lg border border-white/20 flex items-center justify-center w-full"
                        onClick={() => {
                          playCardFromHand(cardMenu.card);
                          setCardMenu(null);
                        }}
                      >
                        PLAY
                      </motion.button>
                    );
                  }
                  return null;
                })()
              )}

              {/* Action: Activate Effect (Green) */}
              {me.isTurn && (['MAIN', 'BATTLE_FREE'].includes(game.phase)) && (
                (() => {
                  const isMyCard = [...me.unitZone, ...me.itemZone, ...me.erosionFront, ...me.hand].some(c => c?.gamecardId === cardMenu.card.gamecardId);
                  if (!isMyCard) return null;

                  const activateEffects = cardMenu.card.effects?.map((effect, index) => ({ effect, index }))
                    .filter(e => e.effect.type === 'ACTIVATE' || e.effect.type === 'ACTIVATED') || [];

                  const zoneMap: Record<string, string> = {
                    'unit': 'UNIT_ZONE',
                    'item': 'ITEM_ZONE',
                    'erosion_front': 'EROSION_FRONT',
                    'hand': 'HAND'
                  };
                  const triggerZone = zoneMap[cardMenu.zone];

                  const validEffects = activateEffects.filter(e => {
                    if (!e.effect.triggerLocation || e.effect.triggerLocation.length === 0) {
                      return cardMenu.zone === 'unit' || cardMenu.zone === 'item';
                    }
                    return e.effect.triggerLocation.includes(triggerZone as any);
                  });

                  if (validEffects.length > 0) {
                    return (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className="px-4 py-1.5 text-[10px] font-bold text-white bg-[#22c55e] rounded-full shadow-lg border border-white/20 flex items-center justify-center w-full"
                        onClick={() => {
                          const triggerLocation = (cardMenu.zone === 'unit' ? 'UNIT' : cardMenu.zone === 'item' ? 'ITEM' : cardMenu.zone === 'erosion_front' ? 'EROSION_FRONT' : 'HAND') as TriggerLocation;
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
                        ACTIVATE
                      </motion.button>
                    );
                  }
                  return null;
                })()
              )}

              {/* Action: Attack (Red) */}
              {game.phase === 'BATTLE_DECLARATION' && me.isTurn && cardMenu.zone === 'unit' && (
                (() => {
                  const isMyCard = me.unitZone.some(c => c?.gamecardId === cardMenu.card.gamecardId);
                  if (isMyCard && canUnitAttack(cardMenu.card)) {
                    return (
                      <div className="flex flex-col gap-1 items-center">
                        {!cardMenu.card.inAllianceGroup && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            className="px-4 py-1.5 text-[10px] font-bold text-white bg-[#ef4444] rounded-full shadow-lg border border-white/20 flex items-center justify-center w-full"
                            onClick={() => {
                              handleDeclareAttack([cardMenu.card.gamecardId], false);
                              setCardMenu(null);
                            }}
                          >
                            ATTACK
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="px-4 py-1.5 text-[10px] font-bold text-white bg-[#ef4444] rounded-full shadow-lg border border-white/20 flex items-center justify-center min-w-[70px]"
                          onClick={() => {
                            setAllianceTargetSelection(cardMenu.card.gamecardId);
                            setCardMenu(null);
                          }}
                        >
                          ALLIANCE
                        </motion.button>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* Action: Attack (Allied Forces) */}
              {allianceTargetSelection && cardMenu.zone === 'unit' && me.unitZone.some(c => c?.gamecardId === cardMenu.card.gamecardId) && (
                <motion.button
                  whileHover={{ scale: 1.1, x: -3 }}
                  className="px-3 py-1 text-[9px] font-black tracking-tighter text-red-50 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center gap-2 border border-red-400/50"
                  onClick={() => {
                    handleDeclareAttack([allianceTargetSelection, cardMenu.card.gamecardId], true);
                    setAllianceTargetSelection(null);
                    setCardMenu(null);
                  }}
                >
                  <Sword className="w-2.5 h-2.5 fill-current" />
                  ALLIANCE
                </motion.button>
              )}

              {/* Action: Defend (Blue) */}
              {game.phase === 'DEFENSE_DECLARATION' && opponent?.isTurn && cardMenu.zone === 'unit' && (
                (() => {
                  const isMyCard = me.unitZone.some(c => c?.gamecardId === cardMenu.card.gamecardId);
                  if (isMyCard && !cardMenu.card.isExhausted) {
                    return (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className="px-4 py-1.5 text-[10px] font-bold text-white bg-[#3b82f6] rounded-full shadow-lg border border-white/20 flex items-center justify-center min-w-[70px]"
                        onClick={() => {
                          handleDeclareDefense(cardMenu.card.gamecardId);
                          setCardMenu(null);
                        }}
                      >
                        DEFEND
                      </motion.button>
                    );
                  }
                  return null;
                })()
              )}

              {/* Action: Discard (Special Phase) */}
              {game.phase === 'DISCARD' && cardMenu.zone === 'hand' && me.isTurn && (
                <motion.button
                  whileHover={{ scale: 1.1, x: -3 }}
                  className="px-3 py-1 text-[9px] font-black tracking-tighter text-red-50 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center gap-2 border border-red-400/50"
                  onClick={() => {
                    handleDiscardCard(cardMenu.card.gamecardId);
                    setCardMenu(null);
                  }}
                >
                  <Trash2 className="w-2.5 h-2.5 fill-current" />
                  DISCARD
                </motion.button>
              )}

              {/* Action: Details (Purple) */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                className="px-4 py-1.5 text-[10px] font-bold text-white bg-[#9333ea] rounded-full shadow-lg border border-white/20 flex items-center justify-center min-w-[70px]"
                onClick={() => {
                  setPreviewCard(cardMenu.card);
                  setCardMenu(null);
                }}
              >
                DETAILS
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* Alliance Target Selection Overlay */}
      <AnimatePresence>
        {allianceTargetSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-[15%] z-[140] flex flex-col items-center gap-4 pointer-events-none"
          >
            <div className="bg-zinc-900/90 border border-orange-500/50 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-sm">
              <p className="text-orange-400 font-bold tracking-widest uppercase flex items-center gap-3">
                <Sword className="w-5 h-5" />
                SELECT ANOTHER READY UNIT FOR ALLIANCE
              </p>
            </div>
            <button
              onClick={() => setAllianceTargetSelection(null)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold tracking-widest pointer-events-auto transition-colors backdrop-blur-md border border-white/10"
            >
              CANCEL
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
              <div className="absolute top-4 right-6 text-2xl font-black text-red-500 animate-pulse">
                {Math.max(0, Math.ceil((30000 - (Date.now() - (game.phaseTimerStart || Date.now()))) / 1000))}s
              </div>
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
                  CANCEL
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
              <div className="absolute top-4 right-6 text-2xl font-black text-red-500 animate-pulse">
                {Math.max(0, Math.ceil((30000 - (Date.now() - (game.phaseTimerStart || Date.now()))) / 1000))}s
              </div>
              <h3 className="text-2xl font-black italic text-red-500 mb-6 uppercase tracking-tighter flex items-center gap-3">
                <Zap className="w-6 h-6" />
                CONFIRM EFFECT
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
                  CANCEL
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
                  CONFIRM
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
            <div className="bg-zinc-900 border-2 border-[#f27d26]/50 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(242,125,38,0.3)] relative">
              <div className="absolute top-4 right-6 text-2xl font-black text-[#f27d26] animate-pulse">
                {Math.max(0, Math.ceil((30000 - (Date.now() - (game.phaseTimerStart || Date.now()))) / 1000))}s
              </div>
              <h2 className="text-3xl font-black italic text-[#f27d26] uppercase tracking-widest">CONFIRM COUNTER</h2>
              <p className="text-white/80">Your opponent is proposing damage calculation. Would you like to counter first?</p>
              <div className="flex gap-4">
                <button onClick={() => GameService.advancePhase(gameId!, 'CONFIRM_CONFRONTATION')} className="px-8 py-3 bg-[#f27d26] text-black font-black uppercase rounded-lg hover:bg-orange-400">COUNTER</button>
                <button onClick={() => GameService.advancePhase(gameId!, 'DECLINE_CONFRONTATION')} className="px-8 py-3 bg-zinc-700 text-white font-black uppercase rounded-lg hover:bg-zinc-600">PASS</button>
              </div>
            </div>
          </motion.div>
        )}

        {game.phase === 'BATTLE_FREE' && game.battleState?.askConfront === 'ASKING_TURN_PLAYER' && me.isTurn && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="bg-zinc-900 border-2 border-[#f27d26]/50 p-8 rounded-3xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(242,125,38,0.3)] relative">
              <div className="absolute top-4 right-6 text-2xl font-black text-[#f27d26] animate-pulse">
                {Math.max(0, Math.ceil((30000 - (Date.now() - (game.phaseTimerStart || Date.now()))) / 1000))}s
              </div>
              <h2 className="text-3xl font-black italic text-[#f27d26] uppercase tracking-widest">CONFIRM COUNTER</h2>
              <p className="text-white/80">Opponent declined counter. Would you like to counter? (Choosing NO moves to damage calculation)</p>
              <div className="flex gap-4">
                <button onClick={() => GameService.advancePhase(gameId!, 'CONFIRM_CONFRONTATION')} className="px-8 py-3 bg-[#f27d26] text-black font-black uppercase rounded-lg hover:bg-orange-400">COUNTER</button>
                <button onClick={() => GameService.advancePhase(gameId!, 'DECLINE_CONFRONTATION')} className="px-8 py-3 bg-zinc-700 text-white font-black uppercase rounded-lg hover:bg-zinc-600">PASS</button>
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
              className="relative flex items-center justify-center max-h-screen"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Full Image Display Only */}
              <div className="relative aspect-[3/4] h-[85vh] rounded-3xl overflow-hidden border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.9)] group">
                <img
                  src={previewCard.fullImageUrl || previewCard.imageUrl || `https://picsum.photos/seed/${previewCard.id}/400/600`}
                  alt={previewCard.fullName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />

                {/* Floating Elegant Close Button */}
                <button
                  onClick={() => setPreviewCard(null)}
                  className="absolute top-6 right-6 p-3 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/10 hover:scale-105 transition-all shadow-2xl"
                >
                  <X className="w-6 h-6 text-white/80 hover:text-white" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Central Phase Action Menu Modal */}
      <AnimatePresence>
        {showPhaseMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={() => setShowPhaseMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="bg-zinc-900 border border-white/10 p-12 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(242,125,38,0.1)] flex flex-col items-center gap-10 max-w-sm w-full relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Premium Glow effects */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#f27d26]/10 blur-[100px] rounded-full" />
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full" />

              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#f27d26] to-[#ff9d5c] flex items-center justify-center mb-2 shadow-[0_0_40px_rgba(242,125,38,0.5)]">
                  <Loader2 className="w-10 h-10 text-white animate-spin-slow" />
                </div>
                <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter text-center leading-none">
                  Stage Transition
                </h3>
                <div className="px-6 py-1.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
                  <p className="text-[12px] text-[#f27d26] uppercase font-black tracking-[0.3em]">
                    Current: {game.phase}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full relative z-10">
                {game.phase === 'MAIN' && (
                  <>
                    {game.turnCount !== 1 && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full h-18 py-5 px-10 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-5 border-t border-white/20"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'DECLARE_BATTLE');
                          setShowPhaseMenu(false);
                        }}
                      >
                        <Sword className="w-6 h-6" />
                        DECLARE BATTLE
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full h-18 py-5 px-10 bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all border border-white/10 flex items-center justify-center gap-5 shadow-2xl"
                      onClick={() => {
                        GameService.advancePhase(gameId!, 'DECLARE_END');
                        setShowPhaseMenu(false);
                      }}
                    >
                      <LogOut className="w-6 h-6" />
                      END ROUND
                    </motion.button>
                  </>
                )}


                {game.phase === 'BATTLE_DECLARATION' && (
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full h-18 py-5 px-10 bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all border border-white/10 flex items-center justify-center gap-5 shadow-2xl"
                    onClick={() => {
                      GameService.advancePhase(gameId!, 'RETURN_MAIN');
                      setShowPhaseMenu(false);
                    }}
                  >
                    <ChevronRight className="w-6 h-6 rotate-180" />
                    RETURN MAIN
                  </motion.button>
                )}

                {game.phase === 'DEFENSE_DECLARATION' && (
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full h-18 py-5 px-10 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(37,99,235,0.4)] flex items-center justify-center gap-5 border-t border-white/20"
                    onClick={() => {
                      handleDeclareDefense(undefined);
                      setShowPhaseMenu(false);
                    }}
                  >
                    <Shield className="w-6 h-6" />
                    PASS DEFENSE
                  </motion.button>
                )}

                {game.phase === 'BATTLE_FREE' && (
                  <>
                    {me.isTurn && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full h-18 py-5 px-10 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(242,125,38,0.4)] flex items-center justify-center gap-5 border-t border-white/20"
                        onClick={() => {
                          GameService.advancePhase(gameId!, 'PROPOSE_DAMAGE_CALCULATION');
                          setShowPhaseMenu(false);
                        }}
                      >
                        <ShieldCheck className="w-6 h-6" />
                        END FREE BATTLE
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full h-18 py-5 px-10 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-5 border-t border-white/20"
                      onClick={() => {
                        GameService.advancePhase(gameId!, 'PROPOSE_DAMAGE_CALCULATION');
                        setShowPhaseMenu(false);
                      }}
                    >
                      <Zap className="w-6 h-6" />
                      DAMAGE RESOLVE
                    </motion.button>
                  </>
                )}

                {game.phase === 'DAMAGE_CALCULATION' && (
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full h-18 py-5 px-10 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(220,38,38,0.4)] flex items-center justify-center gap-5 border-t border-white/20"
                    onClick={() => {
                      handleResolveDamage();
                      setShowPhaseMenu(false);
                    }}
                  >
                    <Zap className="w-6 h-6" />
                    CONFIRM RESULT
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.1, color: '#f27d26' }}
                  className="w-full h-14 mt-4 px-8 bg-transparent text-white/30 rounded-2xl text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center justify-center"
                  onClick={() => setShowPhaseMenu(false)}
                >
                  CANCEL
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

