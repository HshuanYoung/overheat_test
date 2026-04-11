import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { GameState, PlayerState, Card, StackItem, CardEffect, TriggerLocation, GAME_TIMEOUTS } from '../types/game';
import { socket, getAuthUser, onceAuthenticated, isSocketAuthenticated } from '../socket';

import { GameService } from '../services/gameService';
import { hydrateGameState } from '../services/cardLoader';

import { CardComponent } from './Card';
import { PlayField } from './PlayField';
import { Rulebook } from './Rulebook';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Trophy, Frown, Home, Sword, Shield, Zap, LogOut, BookOpen, Send, Loader2, Trash2, X, Play, Search, ChevronRight, ShieldCheck, Layers, Sparkles, Flame } from 'lucide-react';
import { cn, getCardImageUrl } from '../lib/utils';

export const BattleField: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const authUser = useMemo(() => getAuthUser(), []);
  const myUid = useMemo(() => authUser?.uid, [authUser]);
  const deckId = useMemo(() => location.state?.deckId || localStorage.getItem(`deck_${gameId}`), [gameId, location.state?.deckId]);

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
  const [selectedQueryIds, setSelectedQueryIds] = useState<string[]>([]);

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
  const [allianceConfirmation, setAllianceConfirmation] = useState<{
    attacker1: Card;
    attacker2: Card;
  } | null>(null);

  const lastAutoResolveRef = useRef<string | null>(null);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const gameRef = useRef<GameState | null>(null);
  useEffect(() => { gameRef.current = game; }, [game]);

  // Universal Visual Timer Logic - Stabilized with gameRef
  useEffect(() => {
    if (!gameId || !myUid) return;

    const updateTimer = () => {
      const game = gameRef.current;
      if (!game) return;

      const now = Date.now();
      const elapsed = now - (game.phaseTimerStart || now);

      let activePlayerUid: string | undefined;
      if (game.pendingQuery) {
        activePlayerUid = game.pendingQuery.playerUid;
      } else if (game.priorityPlayerId) {
        activePlayerUid = game.priorityPlayerId;
      } else {
        activePlayerUid = game.playerIds[game.currentTurnPlayer];
      }

      const activePlayer = activePlayerUid ? game.players[activePlayerUid] : null;
      let remaining = activePlayer ? Math.max(0, (activePlayer.timeRemaining || 0) - elapsed) : 0;

      const newTimerValue = Math.ceil(remaining / 1000);
      setTimer(prev => prev !== newTimerValue ? newTimerValue : prev);

      // Auto-resolve for player if timeout during Countering
      if (game.phase === 'COUNTERING' && game.priorityPlayerId === myUid && remaining <= 0) {
        const resolveKey = `${game.phase}-${game.priorityPlayerId}-${game.counterStack.length}`;
        if (lastAutoResolveRef.current !== resolveKey) {
          lastAutoResolveRef.current = resolveKey;
          handleResolve();
        }
      }
    };

    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [gameId, myUid]);

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

  // deckId calculation removed, now memoized above

  useEffect(() => {
    if (location.state?.deckId) {
      localStorage.setItem(`deck_${gameId}`, location.state.deckId);
    }
  }, [gameId, location.state?.deckId]);

  // Listener management effect
  useEffect(() => {
    if (!gameId || gameId === 'undefined') return;

    console.log('[BattleField] Registering socket listeners for game:', gameId);

    const onGameStateUpdate = (newState: any) => {
      if (newState.gameId !== gameId) return;

      hydrateGameState(newState);
      setGame(newState);

      // Robust clearing of query-related state
      if (!newState.pendingQuery) {
        setSelectedQueryIds([]);
        setPaymentSelection({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
      }
    };

    socket.on('gameStateUpdate', onGameStateUpdate);

    return () => {
      console.log('[BattleField] Unregistering socket listeners for game:', gameId);
      socket.off('gameStateUpdate', onGameStateUpdate);
    };
  }, [gameId]);

  // Join game effect
  useEffect(() => {
    if (!gameId || !deckId || gameId === 'undefined') return;

    const performJoin = () => {
      console.log('[BattleField] Emitting joinGame:', gameId);
      socket.emit('joinGame', { gameId, deckId });
    };

    const token = localStorage.getItem('token');
    const authAndJoin = () => {
      if (isSocketAuthenticated()) {
        performJoin();
      } else if (token) {
        if (!socket.connected) socket.connect();
        socket.once('authenticated', performJoin);
        socket.emit('authenticate', token);
      }
    };

    authAndJoin();

    return () => {
      console.log('[BattleField] Emitting leaveGame:', gameId);
      socket.emit('leaveGame', gameId);
    };
  }, [gameId, deckId]);

  // Clear query selection when query changes
  useEffect(() => {
    setSelectedQueryIds([]);
    setPaymentSelection({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
  }, [game?.pendingQuery?.id]);

  // Clear alliance selection if we leave the selection phase
  useEffect(() => {
    if (game?.phase !== 'BATTLE_DECLARATION') {
      setAllianceTargetSelection(null);
      setAllianceConfirmation(null);
    }
  }, [game?.phase]);




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
  }, [
    game?.phase,
    game?.counterStack?.length,
    game?.priorityPlayerId,
    game?.pendingQuery?.id,
    gameId
  ]);

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

  const handleSurrender = async () => {
    if (!gameId) return;
    try {
      socket.emit('gameAction', { gameId, action: 'SURRENDER', payload: {} });
      setShowPhaseMenu(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  useEffect(() => {
    const onSurrender = () => handleSurrender();
    window.addEventListener('game:surrender', onSurrender);
    return () => window.removeEventListener('game:surrender', onSurrender);
  }, [gameId]);

  // const authUser = getAuthUser();
  // const myUid = authUser?.uid;
  const me = useMemo(() => (game && myUid) ? game.players[myUid] : null, [game, myUid]);
  const opponentUid = useMemo(() => (game && myUid) ? Object.keys(game.players).find(uid => uid !== myUid) : null, [game, myUid]);
  const opponent = useMemo(() => (game && opponentUid) ? game.players[opponentUid] : null, [game, opponentUid]);

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
        const attacker1 = me.unitZone.find(c => c?.gamecardId === allianceTargetSelection);
        if (attacker1) {
          setAllianceConfirmation({ attacker1, attacker2: card });
          setAllianceTargetSelection(null);
          return;
        }
      } else if (zone === 'unit' && card.gamecardId === allianceTargetSelection) {
        setAllianceTargetSelection(null);
        return;
      } else {
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
    const isCounteringTurn = game.phase === 'COUNTERING' && game.priorityPlayerId === myUid;
    const isMainTurn = me.isTurn && game.phase === 'MAIN';
    const isBattleFreeTurn = me.isTurn && game.phase === 'BATTLE_FREE' && card.type === 'STORY';

    if (!gameId || (!isMainTurn && !isBattleFreeTurn && !isCounteringTurn)) return;
    if (isCounteringTurn && card.type !== 'STORY') return;

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

  const handleQuerySubmit = async () => {
    if (!gameId || !game?.pendingQuery) return;

    console.log(`[Query] Submitting choice for ${game.pendingQuery.type}:`, {
      id: game.pendingQuery.id,
      selectedIds: selectedQueryIds,
      payment: paymentSelection
    });

    try {
      let selections = selectedQueryIds;
      // Normalize type check to handle potential variations
      const queryType = game.pendingQuery.type.replace(/-/g, '_').toUpperCase();

      if (queryType === 'SELECT_PAYMENT') {
        selections = [JSON.stringify(paymentSelection)];
      }

      await GameService.submitQueryChoice(gameId, game.pendingQuery.id, selections);
      setSelectedQueryIds([]);
      setPaymentSelection({ useFeijing: [], exhaustIds: [], erosionFrontIds: [] });
    } catch (error: any) {
      console.error('[Query] Submission error:', error);
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

  const handleShenyiChoice = async (action: 'CONFIRM_SHENYI' | 'DECLINE_SHENYI') => {
    if (!gameId) return;
    try {
      await GameService.handleShenyiChoice(gameId, action);
    } catch (error: any) {
      alert(error.message);
    }
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
                  src={previewCard.fullImageUrl || getCardImageUrl(previewCard.id, previewCard.rarity, false)}
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
      className="h-screen pt-16 bg-[#050505] flex flex-col overflow-hidden select-none font-sans relative"
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
                      {me.unitZone.some(c => c && !c.isExhausted) && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-green-400 font-black uppercase italic tracking-widest text-sm">
                            <Sword className="w-4 h-4" />
                            横置支付 (Exhaust Payment - Cost -1)
                          </div>
                          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {me.unitZone.filter(c => c && !c.isExhausted).map(card => {
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





      {/* Main Arena */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#050505] p-2">
        {/* Top Bar: Phase & Turn */}
        <div className="h-16 flex items-center justify-between px-6 bg-black/40 border-b border-white/5 backdrop-blur-md relative z-[1100]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase font-black tracking-[0.2em]">Turn Count</span>
              <span className="text-2xl font-black italic text-[#f27d26]">ROUND {game.turnCount}</span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSurrenderConfirm(true)}
              className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Flag className="w-3 h-3" />
              SURRENDER
            </motion.button>

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
                    <span className="text-xl font-black italic text-white uppercase tracking-wider flex items-center gap-3">
                      {game.phase === 'BATTLE_DECLARATION' && <Sword className="w-6 h-6 text-red-500" />}
                      {game.phase === 'BATTLE_FREE' && <Sword className="w-6 h-6 text-orange-500" />}
                      {game.phase === 'END' && <LogOut className="w-6 h-6 text-zinc-400" />}
                      {(game.phase === 'BATTLE_DECLARATION' || game.phase === 'BATTLE_FREE' || game.currentTurnPlayer === (game.playerIds[0] === myUid ? 0 : 1)) && game.battleState?.attackers.length > 0 && <Flame className="w-6 h-6 text-red-500 animate-pulse" />}
                      {game.phase === 'COUNTERING'
                        ? `${game.previousPhase?.replace(/_/g, ' ') || 'MAIN'}|COUNTERING`
                        : game.phase.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>


            </div>

          </div>

          <div className={cn(
            "flex items-center gap-3 px-6 py-2 rounded-xl text-sm font-black uppercase italic tracking-[0.2em] shadow-2xl border border-white/10",
            game.playerIds[game.currentTurnPlayer] === myUid
              ? "bg-[#f27d26] text-black animate-pulse"
              : "bg-zinc-800 text-white/50"
          )}>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20">
              {game.playerIds[game.currentTurnPlayer] === myUid
                ? <img src={authUser?.photoURL || 'assets/icons/myself.JPG'} className="w-full h-full object-cover" />
                : <img src="assets/icons/opponent.JPG" className="w-full h-full object-cover" />
              }
            </div>
            {game.playerIds[game.currentTurnPlayer] === myUid ? "YOUR ACTION" : "OPPONENT ACTION"}
          </div>
        </div>

        {/* Global Stack Display at the Top */}
        <div className="h-20 bg-black/60 border-b border-white/5 flex items-center px-6 gap-4 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#f27d26]" />
            <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Stack / 对抗链</span>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex items-center gap-3 h-full py-2">
            {game.counterStack.map((item, i) => (
              <motion.div
                key={`${i}-${item.timestamp}`}
                initial={{ scale: 0.8, opacity: 0, x: -20 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                className="h-full aspect-[3/4] relative group cursor-pointer"
                onClick={() => setPreviewCard(item.card || null)}
              >
                {item.card ? (
                  <CardComponent card={item.card} disableZoom />
                ) : (
                  <div className="w-full h-full bg-zinc-900 border border-red-500/30 rounded flex items-center justify-center">
                    <Zap className="w-4 h-4 text-red-500/50" />
                  </div>
                )}
                <div className={cn(
                  "absolute -top-1 -left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase italic shadow-lg z-10",
                  item.ownerUid === myUid ? "bg-[#f27d26] text-black" : "bg-red-600 text-white"
                )}>
                  {item.ownerUid === myUid ? "ME" : "OPP"}
                </div>
              </motion.div>
            ))}
            {game.counterStack.length === 0 && (
              <span className="text-[10px] text-white/10 uppercase font-bold italic tracking-widest">No active effects in stack</span>
            )}
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
              {game.logs.slice().map((log, i) => (
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
                  timer={timer}
                />
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {game.currentProcessingItem && (
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="fixed inset-0 z-[600] bg-black/40 flex items-center justify-center pointer-events-none"
            >
              <div className="flex flex-col items-center gap-12">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="flex items-center gap-4 text-red-500">
                    <Zap className="w-8 h-8 animate-pulse" />
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter">
                      RESOLVING EFFECT
                    </h2>
                    <Zap className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="h-1 w-48 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                </motion.div>

                <motion.div
                  initial={{ scale: 0.5, opacity: 0, rotateY: 90 }}
                  animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                  exit={{ scale: 1.5, opacity: 0, filter: "brightness(2)" }}
                  transition={{ type: "spring", damping: 15 }}
                  className="relative"
                >
                  <div className="absolute -inset-8 bg-red-600/20 blur-[60px] rounded-full animate-pulse" />
                  <div className="w-72 relative z-10">
                    {game.currentProcessingItem.card ? (
                      <div className="relative group">
                        <CardComponent card={game.currentProcessingItem.card} disableZoom />
                        <div className="absolute -inset-0.5 bg-gradient-to-t from-red-600/50 to-transparent opacity-50 rounded-2xl" />
                      </div>
                    ) : (
                      <div className="aspect-[3/4] bg-zinc-900 border-2 border-red-500/30 rounded-2xl flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                        <Sword className="w-20 h-20 text-red-500/40 mb-6" />
                        <span className="text-2xl font-black text-white uppercase tracking-widest leading-none">
                          {game.currentProcessingItem.type === 'PHASE_END' ? "PHASE TRANSITION" : game.currentProcessingItem.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Link Badge */}
                  <div className="absolute -top-6 -left-6 w-20 h-20 bg-red-600 rounded-full border-4 border-zinc-900 flex items-center justify-center shadow-2xl z-20">
                    <span className="text-2xl font-black italic text-white uppercase tracking-tighter">LINK</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.5em]">Initiated By</span>
                  <span className={cn(
                    "px-6 py-2 rounded-full border text-xs font-black uppercase tracking-widest italic shadow-lg",
                    game.currentProcessingItem.ownerUid === myUid ? "bg-blue-600/20 border-blue-500/50 text-blue-400" : "bg-red-600/20 border-red-500/50 text-red-400"
                  )}>
                    {game.currentProcessingItem.ownerUid === myUid ? "Friendly Forces / 我方" : "Hostile Forces / 对方"}
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                game.priorityPlayerId === myUid && "border-red-500 animate-pulse ring-2 ring-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.5)]"
              )}>
                <div className="flex flex-col items-center">
                  <p className="text-red-500 font-black tracking-widest uppercase flex items-center gap-3 text-lg italic">
                    <ShieldCheck className="w-6 h-6 animate-pulse" />
                    CONFRONTATION / 对抗阶段
                  </p>
                  <p className="text-white text-[11px] uppercase tracking-[0.2em] font-black">
                    {game.isResolvingStack
                      ? "RESOLVING CHAIN / 正在结算连锁"
                      : game.priorityPlayerId === myUid
                        ? `RESPOND AS LINK ${game.counterStack.length + 1} / 请响应 (Link ${game.counterStack.length + 1})`
                        : `WAITING FOR ${game.players[game.priorityPlayerId!]?.displayName?.toUpperCase() || 'OPPONENT'}`}
                  </p>
                </div>

                {game.priorityPlayerId === myUid && !game.isResolvingStack && (
                  <div className="flex items-center gap-3 pointer-events-auto">
                    <button
                      onClick={handleResolve}
                      className="px-10 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black italic uppercase tracking-widest rounded-full transition-all flex items-center gap-2 border border-red-400 group shadow-lg shadow-red-600/40"
                    >
                      <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                      PASS & SETTLE / 不对抗直接结算
                    </button>
                  </div>
                )}
              </div>

              {/* Stack Visualization */}
              <div className="flex gap-6 mt-8">
                {game.counterStack.map((item, idx) => (
                  <motion.div
                    key={`${idx}-${item.timestamp}`}
                    initial={{ y: 20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: idx === game.counterStack.length - 1 ? 1.15 : 1 }}
                    className={cn(
                      "w-36 h-52 rounded-xl overflow-hidden border-2 shadow-2xl relative transition-all duration-300",
                      idx === game.counterStack.length - 1
                        ? "border-red-500 z-10 ring-4 ring-red-500/20"
                        : "border-white/10 opacity-60 grayscale-[0.5]"
                    )}
                  >
                    {item.card ? (
                      <CardComponent card={item.card} disableZoom />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center p-4 text-center border-t-4 border-red-500/50">
                        <Sword className="w-10 h-10 text-red-500/40 mb-3" />
                        <span className="text-[12px] font-black text-white uppercase tracking-widest leading-tight">
                          {item.type === 'PHASE_END' ? "PHASE END REQUEST" : item.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 rounded-full border border-white/40 flex items-center justify-center text-[11px] font-black italic text-white shadow-xl z-20">
                      LINK {idx + 1}
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

        <AnimatePresence>
          {game.phase === 'SHENYI_CHOICE' && game.pendingShenyi && game.pendingShenyi.playerUid === myUid && (
            <div className="absolute inset-0 z-[160] flex items-center justify-center bg-black/70 backdrop-blur-lg">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-[#1a0f1a] border-2 border-[#4a0d4a] p-10 rounded-3xl flex flex-col items-center gap-8 shadow-[0_0_100px_rgba(74,13,74,0.4)] max-w-2xl"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 bg-[#4a0d4a] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(74,13,74,0.6)] animate-pulse">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-[0.15em] mt-4">女神之辉：神依</h2>
                  <p className="text-zinc-400 text-center text-sm font-medium tracking-wide">
                    你已进入女神化状态。是否触发【神依】效果，将指定单位重置为竖直状态？
                  </p>
                </div>

                <div className="flex gap-4">
                  {game.pendingShenyi.cardIds.map(cid => {
                    const card = me.unitZone.find(u => u?.gamecardId === cid);
                    if (!card) return null;
                    return (
                      <div key={cid} className="w-40 h-56 rounded-xl overflow-hidden border-2 border-[#4a0d4a]/50 shadow-2xl relative group">
                        <CardComponent card={card} disableZoom />
                        <div className="absolute inset-0 bg-purple-500/20 animate-pulse pointer-events-none" />
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-6 w-full">
                  <button
                    onClick={() => handleShenyiChoice('CONFIRM_SHENYI')}
                    className="flex-1 py-5 bg-[#4a0d4a] hover:bg-[#5d115d] text-white font-black italic uppercase tracking-widest rounded-2xl transition-all shadow-2xl hover:scale-[1.02] border border-white/10"
                  >
                    确认触发 (CONFIRM)
                  </button>
                  <button
                    onClick={() => handleShenyiChoice('DECLINE_SHENYI')}
                    className="flex-1 py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black italic uppercase tracking-widest rounded-2xl transition-all border border-white/10"
                  >
                    忽略 (SKIP)
                  </button>
                </div>
              </motion.div>
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
              {(() => {
                const isCounteringTurn = game.phase === 'COUNTERING' && game.priorityPlayerId === myUid;
                const isMainTurn = me.isTurn && game.phase === 'MAIN';
                const isBattleFreeTurn = me.isTurn && game.phase === 'BATTLE_FREE' && cardMenu.card.type === 'STORY';
                const canPlayInPhase = isMainTurn || isBattleFreeTurn || (isCounteringTurn && cardMenu.card.type === 'STORY');

                if (cardMenu.zone === 'hand' && canPlayInPhase) {
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
                }
                return null;
              })()}

              {/* Action: Activate Effect (Green) */}
              {(() => {
                const isCounteringTurn = game.phase === 'COUNTERING' && game.priorityPlayerId === myUid;
                const isActivePhase = ['MAIN', 'BATTLE_FREE'].includes(game.phase);
                const canActivateInPhase = (me.isTurn && isActivePhase) || isCounteringTurn;

                if (!canActivateInPhase) return null;
                const isMyCard = [...me.unitZone, ...me.itemZone, ...me.erosionFront, ...me.hand].some(c => c?.gamecardId === cardMenu.card.gamecardId);
                if (!isMyCard) return null;

                const latestCard = [
                  ...me.unitZone, ...me.itemZone, ...me.erosionFront, ...me.hand,
                  ...(opponent?.unitZone || []), ...(opponent?.itemZone || []), ...(opponent?.erosionFront || [])
                ].find(c => c?.gamecardId === cardMenu.card.gamecardId) || cardMenu.card;

                const activateEffects = latestCard.effects?.map((effect, index) => ({ effect, index }))
                  .filter(e => e.effect.type === 'ACTIVATE' || e.effect.type === 'ACTIVATED') || [];

                const zoneMap: Record<string, string> = {
                  'unit': 'UNIT',
                  'item': 'ITEM',
                  'erosion_front': 'EROSION_FRONT',
                  'hand': 'HAND'
                };
                const validEffects = activateEffects.filter(e => {
                  const triggerLocation = zoneMap[cardMenu.zone] as TriggerLocation;
                  return GameService.checkEffectLimitsAndReqs(game, myUid, latestCard, e.effect, triggerLocation);
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
                            card: latestCard,
                            effect: validEffects[0].effect,
                            effectIndex: validEffects[0].index,
                            triggerLocation
                          });
                        } else {
                          setEffectSelection({
                            card: latestCard,
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
              })()}

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



      {/* Alliance Confirmation Prompt */}
      <AnimatePresence>
        {allianceConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-orange-500/50 p-10 rounded-3xl flex flex-col items-center gap-8 shadow-[0_0_100px_rgba(249,115,22,0.2)] max-w-3xl w-full"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center shadow-inner">
                  <Sword className="w-10 h-10 text-orange-500" />
                </div>
                <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mt-4">确认联军宣告 (CONFIRM ALLIANCE)</h2>
                <p className="text-zinc-400 text-sm font-medium tracking-wide">是否宣告这两个单位进行联军攻击？</p>
              </div>

              <div className="flex gap-8 items-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl">
                    <CardComponent card={allianceConfirmation.attacker1} disableZoom />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Attacker 1</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Zap className="w-6 h-6 text-orange-500 animate-pulse" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl">
                    <CardComponent card={allianceConfirmation.attacker2} disableZoom />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Attacker 2</span>
                </div>
              </div>

              <div className="flex gap-6 w-full">
                <button
                  onClick={() => {
                    handleDeclareAttack([allianceConfirmation.attacker1.gamecardId, allianceConfirmation.attacker2.gamecardId], true);
                    setAllianceConfirmation(null);
                  }}
                  className="flex-1 py-5 bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase tracking-widest rounded-2xl transition-all shadow-xl hover:scale-[1.02] border border-orange-400/50"
                >
                  确认宣告 (CONFIRM ALLIANCE)
                </button>
                <button
                  onClick={() => setAllianceConfirmation(null)}
                  className="flex-1 py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black italic uppercase tracking-widest rounded-2xl transition-all border border-white/10"
                >
                  取消 (CANCEL)
                </button>
              </div>
            </motion.div>
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

      <AnimatePresence>
        {game.pendingQuery && game.pendingQuery.playerUid === myUid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8"
          >
            {/* Background Accent for Discard */}
            {(game.pendingQuery.title.includes('舍弃') || game.pendingQuery.title.includes('Discard')) && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/10 blur-[120px] rounded-full" />
              </div>
            )}

            <div className="max-w-6xl w-full flex flex-col items-center gap-10 relative z-10">
              <div className="text-center flex flex-col items-center">
                <div className={cn(
                  "flex items-center justify-center gap-4 mb-3",
                  (game.pendingQuery.title.includes('舍弃') || game.pendingQuery.title.includes('Discard')) ? "text-red-500" : "text-[#f27d26]"
                )}>
                  {(game.pendingQuery.title.includes('舍弃') || game.pendingQuery.title.includes('Discard')) ? (
                    <Trash2 className="w-10 h-10 animate-bounce" />
                  ) : (
                    <Zap className="w-10 h-10 animate-pulse" />
                  )}
                  <h2 className="text-5xl font-black italic uppercase tracking-tighter">
                    {game.pendingQuery.title}
                  </h2>
                </div>

                <p className="text-zinc-400 uppercase tracking-[0.4em] text-sm max-w-2xl mx-auto leading-relaxed">
                  {game.pendingQuery.description}
                </p>
                {game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_CARD' && (
                  <div className="mt-4 px-6 py-2 bg-white/5 rounded-full border border-white/10 inline-block font-mono text-xs text-zinc-500">
                    SELECTIONS REQUIRED: {game.pendingQuery.minSelections} - {game.pendingQuery.maxSelections}
                  </div>
                )}
                {game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_PAYMENT' && (
                  <div className="mt-4 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Required:</span>
                      <span className="text-3xl font-black text-red-500">{game.pendingQuery.paymentCost}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Selected:</span>
                      <span className="text-3xl font-black text-white">{(paymentSelection.useFeijing.length * 3) + paymentSelection.exhaustIds.length}</span>
                    </div>
                  </div>
                )}
              </div>

              {game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_CARD' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-10 max-h-[55vh] overflow-y-auto p-6 custom-scrollbar w-full">
                  {game.pendingQuery.options.map((option, i) => {
                    const isSelected = selectedQueryIds.includes(option.card.gamecardId);
                    const isDiscardQuery = game.pendingQuery!.title.includes('舍弃') || game.pendingQuery!.title.includes('Discard');
                    return (
                      <div key={`${option.card.gamecardId}-${i}`} className="flex flex-col items-center gap-4 group">
                        <div className="relative">
                          <motion.div
                            whileHover={{ scale: 1.08, y: -12 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedQueryIds(prev => {
                                const alreadySelected = prev.includes(option.card.gamecardId);
                                if (alreadySelected) return prev.filter(id => id !== option.card.gamecardId);
                                if (prev.length >= (game.pendingQuery?.maxSelections || 1)) {
                                  if (game.pendingQuery?.maxSelections === 1) return [option.card.gamecardId];
                                  return prev;
                                }
                                return [...prev, option.card.gamecardId];
                              });
                            }}
                            className={cn(
                              "w-48 cursor-pointer transition-all rounded-2xl overflow-hidden border-2 relative group-hover:shadow-2xl",
                              isSelected
                                ? isDiscardQuery ? "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-105" : "border-[#f27d26] shadow-[0_0_40px_rgba(242,125,38,0.4)] scale-105"
                                : "border-white/5 opacity-80 hover:opacity-100"
                            )}
                          >
                            <CardComponent card={option.card} disableZoom={true} />

                            {/* Selected Badge */}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
                                >
                                  <div className={cn(
                                    "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl relative",
                                    isDiscardQuery ? "bg-red-600 text-white" : "bg-[#f27d26] text-black"
                                  )}>
                                    {isDiscardQuery ? <Trash2 className="w-8 h-8" /> : <Zap className="w-8 h-8 fill-current" />}
                                    <motion.div
                                      animate={{ scale: [1, 1.2, 1] }}
                                      transition={{ repeat: Infinity, duration: 2 }}
                                      className="absolute inset-0 rounded-full border-2 border-current opacity-30"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>

                          <div className={cn(
                            "absolute -top-3 -right-3 px-3 py-1 bg-black border rounded-lg text-[10px] font-black uppercase tracking-widest shadow-2xl z-20",
                            isDiscardQuery ? "border-red-500/50 text-red-500" : "border-white/10 text-[#f27d26]"
                          )}>
                            {option.source}
                          </div>

                          {(option.isMine !== undefined || option.ownerName) && (
                            <div className={cn(
                              "absolute -bottom-2 -left-2 px-3 py-1 bg-zinc-900 border rounded-lg text-[9px] font-black uppercase tracking-widest shadow-2xl z-20",
                              option.isMine ? "border-blue-500/50 text-blue-400" : "border-red-400/50 text-red-400"
                            )}>
                              {option.isMine ? 'YOU' : (option.ownerName || 'OPPONENT')}
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-white text-[13px] font-black uppercase tracking-tight truncate max-w-[192px]">{option.card.fullName}</p>
                          <p className="text-zinc-500 text-[9px] uppercase tracking-widest mt-0.5">{option.card.type}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_PAYMENT' ? (
                /* Payment Selection for Query */
                <div className="flex flex-col gap-8 w-full max-w-4xl max-h-[50vh] overflow-y-auto p-4 custom-scrollbar">
                  {/* Feijing Section */}
                  {me.hand.some(c => c.feijingMark && c.color === game.pendingQuery?.paymentColor) && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-blue-400 font-black uppercase italic tracking-widest text-sm">
                        <Zap className="w-4 h-4" />
                        菲晶支付 (Feijing Payment - Cost -3)
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {me.hand.filter(c => c.feijingMark && c.color === game.pendingQuery?.paymentColor).map(card => {
                          const isSelected = paymentSelection.useFeijing.includes(card.gamecardId);
                          return (
                            <motion.div
                              key={card.gamecardId}
                              whileHover={{ y: -5 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => togglePaymentFeijing(card.gamecardId)}
                              className={cn(
                                "w-32 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                                isSelected ? "border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.5)]" : "border-white/5 opacity-60 hover:opacity-100"
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
                  {me.unitZone.some(c => c && !c.isExhausted) && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-green-400 font-black uppercase italic tracking-widest text-sm">
                        <Sword className="w-4 h-4" />
                        横置支付 (Exhaust Payment - Cost -1)
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {me.unitZone.filter(c => c && !c.isExhausted).map(card => {
                          const isSelected = paymentSelection.exhaustIds.includes(card!.gamecardId);
                          return (
                            <motion.div
                              key={card!.gamecardId}
                              whileHover={{ y: -5 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => togglePaymentExhaust(card!.gamecardId)}
                              className={cn(
                                "w-32 shrink-0 cursor-pointer transition-all rounded-lg overflow-hidden border-2",
                                isSelected ? "border-green-500 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.5)]" : "border-white/5 opacity-60 hover:opacity-100"
                              )}
                            >
                              <CardComponent card={card!} disableZoom />
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-zinc-500 text-xs italic text-center px-8">
                    Note: Any remaining cost will be automatically deducted from your deck as Erosion Damage.
                  </p>
                </div>
              ) : game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'ASK_TRIGGER' ? (
                <div className="flex gap-8 mt-4 w-full justify-center max-w-md">
                  <button
                    onClick={() => GameService.submitQueryChoice(gameId!, game.pendingQuery!.id, ['YES'])}
                    className="flex-1 py-5 bg-[#f27d26] text-white font-black italic uppercase tracking-[0.2em] rounded-2xl hover:bg-[#f27d26]/80 transition-all shadow-[0_20px_50px_rgba(242,125,38,0.3)] hover:scale-105 active:scale-95"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={() => GameService.submitQueryChoice(gameId!, game.pendingQuery!.id, ['NO'])}
                    className="flex-1 py-5 bg-zinc-800 text-white border border-white/20 font-black italic uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-700 transition-all hover:scale-105 active:scale-95"
                  >
                    CANCEL
                  </button>
                </div>
              ) : null}

              {game.pendingQuery.type.replace(/-/g, '_').toUpperCase() !== 'ASK_TRIGGER' && (
                <div className="flex flex-col items-center gap-6">
                  <button
                    onClick={handleQuerySubmit}
                    disabled={game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_CARD' && selectedQueryIds.length < game.pendingQuery.minSelections}
                    className="px-16 py-5 bg-[#f27d26] text-white font-black italic uppercase tracking-[0.2em] rounded-2xl hover:bg-[#f27d26]/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_20px_50px_rgba(242,125,38,0.3)] hover:scale-105 active:scale-95"
                  >
                    {game.pendingQuery.type.replace(/-/g, '_').toUpperCase() === 'SELECT_CARD' ? 'CONFIRM SELECTION' : 'CONFIRM PAYMENT'}
                  </button>
                  <div className="flex items-center gap-2 text-zinc-600 uppercase text-[10px] font-black tracking-widest">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Awaiting player input
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(242,125,38,0.05)_0%,_transparent_50%)]" />
      </div>

      {/* Detailed Card Information Overlay */}
      <AnimatePresence>
        {previewCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8 cursor-pointer"
            onClick={() => setPreviewCard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative flex flex-col md:flex-row items-stretch gap-12 max-h-[92vh] w-full max-w-6xl p-10 bg-[#120a12]/95 rounded-[3.5rem] border-2 border-[#4a0d4a]/30 shadow-[0_0_150px_rgba(74,13,74,0.3)] overflow-hidden backdrop-blur-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Premium Decorative Accents */}
              <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#4a0d4a]/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />
              <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-red-600/5 blur-[180px] rounded-full translate-y-1/2 -translate-x-1/2" />

              {/* Left Column: Name & Image Area */}
              <div className="relative shrink-0 flex flex-col gap-6 w-[45%]">
                <div className="text-center">
                  <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter leading-none mb-1">
                    {previewCard.fullName}
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-transparent via-[#f27d26] to-transparent mx-auto mt-2 opacity-50" />
                </div>

                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border-2 border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] group">
                  <img
                    src={previewCard.fullImageUrl || getCardImageUrl(previewCard.id, previewCard.rarity, false)}
                    alt={previewCard.fullName}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  {/* Floating Rarity Badge */}
                  <div className="absolute top-6 left-6 px-4 py-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
                    <span className="text-lg font-black italic text-white uppercase tracking-widest">{previewCard.rarity}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Structured Information List */}
              <div className="flex-1 flex flex-col min-w-0 h-full">
                <div className="h-full border-2 border-white/5 bg-black/20 rounded-[2.5rem] p-8 flex flex-col gap-6 overflow-hidden relative">
                  {/* Container Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#f27d26] shadow-[0_0_10px_#f27d26]" />
                      <span className="text-xs font-black uppercase text-white/40 tracking-[0.4em]">Registry Data</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {previewCard.isrush && (
                      <div className="px-5 py-2 bg-[#4a0d4a] border-2 border-white/20 rounded-xl text-white text-xs font-black group/kw relative cursor-help uppercase italic shadow-[0_0_20px_rgba(74,13,74,0.6)]">
                        速攻
                        <div className="absolute bottom-full left-0 mb-3 w-64 p-4 bg-[#1a0f1a] border-2 border-[#4a0d4a] rounded-2xl text-white text-[11px] opacity-0 group-hover/kw:opacity-100 transition-all duration-300 z-[1000] pointer-events-none shadow-[0_10px_40px_rgba(0,0,0,0.8)] leading-relaxed normal-case font-medium">
                          <span className="text-[#f27d26] font-black italic block mb-1">【速攻】</span>
                          此单位在登场的第一个回合可以进行攻击。
                        </div>
                      </div>
                    )}
                    {previewCard.isAnnihilation && (
                      <div className="px-5 py-2 bg-[#4a0d4a] border-2 border-white/20 rounded-xl text-white text-xs font-black group/kw relative cursor-help uppercase italic shadow-[0_0_20px_rgba(74,13,74,0.6)]">
                        歼灭
                        <div className="absolute bottom-full left-0 mb-3 w-72 p-4 bg-[#1a0f1a] border-2 border-[#4a0d4a] rounded-2xl text-white text-[11px] opacity-0 group-hover/kw:opacity-100 transition-all duration-300 z-[1000] pointer-events-none shadow-[0_10px_40px_rgba(0,0,0,0.8)] leading-relaxed normal-case font-medium">
                          <span className="text-[#f27d26] font-black italic block mb-1">【歼灭】</span>
                          此单位参加攻击并在战斗中破坏对手单位时，给予对手等同于此单位伤害值的战斗伤害。
                        </div>
                      </div>
                    )}
                    {previewCard.isShenyi && (
                      <div className="px-5 py-2 bg-[#4a0d4a] border-2 border-white/20 rounded-xl text-white text-xs font-black group/kw relative cursor-help uppercase italic shadow-[0_0_20px_rgba(74,13,74,0.6)]">
                        神依
                        <div className="absolute bottom-full left-0 mb-3 w-72 p-4 bg-[#1a0f1a] border-2 border-[#4a0d4a] rounded-2xl text-white text-[11px] opacity-0 group-hover/kw:opacity-100 transition-all duration-300 z-[1000] pointer-events-none shadow-[0_10px_40px_rgba(0,0,0,0.8)] leading-relaxed normal-case font-medium">
                          <span className="text-[#f27d26] font-black italic block mb-1">【神依】</span>
                          每回合一次，当玩家进入女神化状态时，可以将此单位由横置变为竖置。
                        </div>
                      </div>
                    )}
                    {previewCard.isHeroic && (
                      <div className="px-5 py-2 bg-[#4a0d4a] border-2 border-white/20 rounded-xl text-white text-xs font-black group/kw relative cursor-help uppercase italic shadow-[0_0_20px_rgba(74,13,74,0.6)]">
                        英勇
                        <div className="absolute bottom-full left-0 mb-3 w-72 p-4 bg-[#1a0f1a] border-2 border-[#4a0d4a] rounded-2xl text-white text-[11px] opacity-0 group-hover/kw:opacity-100 transition-all duration-300 z-[1000] pointer-events-none shadow-[0_10px_40px_rgba(0,0,0,0.8)] leading-relaxed normal-case font-medium">
                          <span className="text-[#f27d26] font-black italic block mb-1">【英勇】</span>
                          如果此单位在本回合发动过攻击，在回合结束时重置。
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-4">
                    {/* Item: Type */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Type</span>
                      <span className="text-sm font-black italic text-[#f27d26] uppercase">{previewCard.type}</span>
                    </div>

                    {/* Stats List */}
                    {[
                      { label: 'AC VALUE', val: previewCard.acValue, base: previewCard.baseAcValue, icon: Shield, theme: '#3b82f6', show: true },
                      { label: 'DAMAGE', val: previewCard.damage ?? 0, base: previewCard.baseDamage, icon: Zap, theme: '#ef4444', show: previewCard.type === 'UNIT' },
                      { label: 'POWER', val: previewCard.power ?? 0, base: previewCard.basePower, icon: Sword, theme: '#facc15', show: previewCard.type === 'UNIT' }
                    ].filter(s => s.show).map((stat, i) => {
                      const isIncrease = stat.base !== undefined && stat.val > stat.base;
                      const isDecrease = stat.base !== undefined && stat.val < stat.base;
                      return (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <stat.icon className="w-4 h-4" style={{ color: stat.theme }} />
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">{stat.label}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className={cn(
                              "text-xl font-black italic tabular-nums",
                              isIncrease ? "text-red-500" : isDecrease ? "text-green-500" : "text-white"
                            )}>
                              {stat.val}
                            </span>
                            {stat.base !== undefined && stat.val !== stat.base && (
                              <span className="text-xs font-bold text-white/20 italic">
                                ({stat.base})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* God Mark */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">God Mark</span>
                      </div>
                      <span className={cn(
                        "text-xs font-black uppercase tracking-widest italic",
                        previewCard.godMark ? "text-red-500" : "text-white/20"
                      )}>
                        {previewCard.godMark ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    {/* Faction / Influence */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Faction / Influence</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black italic text-white uppercase">{previewCard.faction || 'None'}</span>
                        {previewCard.baseFaction && previewCard.baseFaction !== previewCard.faction && (
                          <span className="text-xs font-bold text-white/40 italic">({previewCard.baseFaction})</span>
                        )}
                      </div>
                    </div>

                    {/* Influenced By Section */}
                    <div className="pt-4">
                      <div className="px-1 mb-4 flex items-center gap-2">
                        <Layers className="w-3 h-3 text-[#f27d26]" />
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Influenced By</span>
                      </div>

                      <div className="space-y-3">
                        {previewCard.influencingEffects && previewCard.influencingEffects.length > 0 ? (
                          previewCard.influencingEffects.map((eff, i) => (
                            <div key={i} className="flex gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                              <span className="text-[10px] font-black text-[#f27d26] opacity-50">{i + 1}.</span>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">Source: {eff.sourceCardName}</span>
                                <p className="text-sm text-zinc-300 leading-relaxed font-semibold">{eff.description}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl opacity-20">
                            <span className="text-[10px] font-bold uppercase tracking-widest italic">No modifiers active</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setPreviewCard(null)}
                    className="px-10 py-4 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-[0.2em] italic hover:scale-105 transition-all shadow-xl active:scale-95"
                  >
                    CLOSE REGISTRY
                  </button>
                </div>
              </div>

              {/* Close Button Icon */}
              <button
                onClick={() => setPreviewCard(null)}
                className="absolute top-8 right-8 p-3 bg-black/40 backdrop-blur-2xl rounded-2xl border border-white/10 hover:bg-white/10 transition-all z-50 group"
              >
                <X className="w-6 h-6 text-white/60 group-hover:text-white group-hover:rotate-90 transition-all" />
              </button>
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
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={selectedAttackers.length === 0}
                      className="w-full h-18 py-5 px-10 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-3xl text-sm font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(220,38,38,0.4)] disabled:opacity-50 flex items-center justify-center gap-5 border-t border-white/20"
                      onClick={() => {
                        handleDeclareAttack();
                        setShowPhaseMenu(false);
                      }}
                    >
                      <Sword className="w-6 h-6" />
                      {selectedAttackers.length === 2 ? 'ALLIANCE ATTACK' : 'DECLARE ATTACK'}
                    </motion.button>
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
                  </>
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
                        END BATTLE FREE
                      </motion.button>
                    )}
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

      {/* Surrender Confirmation Modal */}
      <AnimatePresence>
        {showSurrenderConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={() => setShowSurrenderConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-md w-full bg-zinc-900/90 border border-white/10 rounded-[2.5rem] p-10 shadow-3xl text-center relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Flag className="w-10 h-10 text-red-500" />
              </div>

              <h3 className="text-2xl font-black italic text-white uppercase tracking-wider mb-2">Confirm Surrender?</h3>
              <p className="text-white/50 text-sm mb-8 leading-relaxed font-medium">Are you sure you want to concede this duel? This action cannot be undone and will count as a defeat.</p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  className="py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-white/70 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  onClick={() => setShowSurrenderConfirm(false)}
                >
                  CANCEL
                </button>
                <button
                  className="py-4 px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-red-900/20"
                  onClick={() => {
                    handleSurrender();
                    setShowSurrenderConfirm(false);
                  }}
                >
                  CONCEDE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {game?.gameStatus === 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="max-w-md w-full bg-zinc-900 border-2 border-white/10 rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col items-center gap-8 relative overflow-hidden text-center"
            >
              {/* Premium Background Effects */}
              <div className={cn(
                "absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full opacity-20",
                game.winnerId === myUid ? "bg-orange-500" : "bg-blue-600"
              )} />

              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className={cn(
                  "w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl relative z-10",
                  game.winnerId === myUid
                    ? "bg-gradient-to-br from-orange-400 to-red-600 shadow-orange-500/40"
                    : "bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-black/40"
                )}
              >
                {game.winnerId === myUid ? (
                  <Trophy className="w-12 h-12 text-white" />
                ) : (
                  <Frown className="w-12 h-12 text-zinc-400" />
                )}
              </motion.div>

              <div className="space-y-2 relative z-10">
                <h2 className={cn(
                  "text-5xl font-black italic uppercase tracking-tighter leading-none",
                  game.winnerId === myUid ? "text-orange-500" : "text-white/40"
                )}>
                  {game.winnerId === myUid ? "Victory" : "Defeat"}
                </h2>
                <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">
                  Game Session Terminated
                </p>
              </div>

              <div className="w-full h-px bg-white/5 relative z-10" />

              <div className="space-y-4 relative z-10">
                <p className="text-zinc-400 text-sm font-medium">
                  结算原因:
                </p>
                <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <span className="text-white font-black italic uppercase tracking-widest text-sm">
                    {game.winReason === 'SURRENDER' && game.winnerId === myUid
                      ? '对方投降'
                      : (winReasonMap[game.winReason || ''] || game.winReason || '未知原因')}
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/')}
                className="w-full py-5 px-10 bg-white text-black rounded-3xl font-black uppercase italic tracking-widest transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center justify-center gap-4 group relative z-10 mt-4"
              >
                <Home className="w-5 h-5" />
                Return to Home
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const winReasonMap: Record<string, string> = {
  'DECK_OUT_DRAW': '抽牌阶段卡组已空',
  'DECK_OUT_DRAW_EFFECT': '由于效果抽牌时卡组已空',
  'DECK_OUT_DAMAGE': '受到伤害时卡组卡牌不足',
  'DECK_OUT_BATTLE_DAMAGE': '受到战斗伤害时卡组卡牌不足',
  'DECK_OUT_EFFECT_DAMAGE': '受到效果伤害时卡组卡牌不足',
  'DECK_OUT_COST': '支付费用时卡组卡牌不足',
  'EROSION_BACK_FULL': '侵蚀区背面卡牌达到10张',
  'SURRENDER': '投降'
};

