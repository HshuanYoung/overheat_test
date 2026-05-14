import { getAuthUser, getAuthToken, socket } from '../socket';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Swords, X, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { validateDeckForBattle } from '../lib/deckValidation';
import { Deck } from '../types/game';
import { PageFallback } from './PageFallback';

export const Matchmaking: React.FC = () => {
  const navigate = useNavigate();
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedDeckIdRef = useRef<string | null>(null);
  const searchingRef = useRef(false);
  const isPollingRef = useRef(false);
  const isEnqueueingRef = useRef(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const token = getAuthToken();
  const selectedDeck = myDecks.find(deck => deck.id === selectedDeckId) || null;
  const selectedDeckValidation = validateDeckForBattle(selectedDeck);

  const clearSearchTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    isPollingRef.current = false;
    isEnqueueingRef.current = false;
  };

  const navigateToBattle = (gameId: string) => {
    searchingRef.current = false;
    clearSearchTimers();
    setSearching(false);
    navigate(`/battle/${gameId}`, { state: { deckId: selectedDeckIdRef.current } });
  };

  useEffect(() => {
    selectedDeckIdRef.current = selectedDeckId;
  }, [selectedDeckId]);

  useEffect(() => {
    searchingRef.current = searching;
  }, [searching]);

  useEffect(() => {
    const loadDecks = async () => {
      if (!getAuthUser()) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/user/decks`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setMyDecks(data.decks || []);
        if (data.decks?.length > 0) {
          setSelectedDeckId(data.decks[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadDecks();
    void import('./BattleField');

    if (token) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('authenticate', token);
    }

    const handleMatchFound = (data: { gameId: string }) => {
      navigateToBattle(data.gameId);
    };

    socket.on('matchFound', handleMatchFound);

    return () => {
      socket.off('matchFound', handleMatchFound);
      clearSearchTimers();
    };
  }, [BACKEND_URL, navigate, token]);

  const enqueueForMatchmaking = async (): Promise<{ matched?: boolean; gameId?: string; queued?: boolean } | null> => {
    if (!selectedDeckIdRef.current || isEnqueueingRef.current) return null;
    isEnqueueingRef.current = true;

    try {
      const res = await fetch(`${BACKEND_URL}/api/games/matchmaking`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deckId: selectedDeckIdRef.current }),
      });
      const data = await res.json();
      return data;
    } finally {
      isEnqueueingRef.current = false;
    }
  };

  const scheduleStatusPoll = (delayMs: number) => {
    if (!searchingRef.current) return;
    pollRef.current = setTimeout(() => {
      void pollMatchStatus();
    }, delayMs);
  };

  const pollMatchStatus = async () => {
    if (!searchingRef.current || isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const res = await fetch(`${BACKEND_URL}/api/games/matchmaking/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.matched && data.gameId) {
        navigateToBattle(data.gameId);
        return;
      }

      if (!data.queued && searchingRef.current) {
        const enqueueResult = await enqueueForMatchmaking();
        if (enqueueResult?.matched && enqueueResult.gameId) {
          navigateToBattle(enqueueResult.gameId);
          return;
        }
      }

      scheduleStatusPoll(900);
    } catch (e) {
      scheduleStatusPoll(1500);
    } finally {
      isPollingRef.current = false;
    }
  };

  const handleStartSearch = async () => {
    if (!selectedDeckValidation.valid) {
      alert(selectedDeckValidation.error || '请选择合法的卡组');
      return;
    }

    clearSearchTimers();
    searchingRef.current = true;
    setSearching(true);
    setSearchTimer(0);
    timerRef.current = setInterval(() => setSearchTimer(prev => prev + 1), 1000);

    try {
      const data = await enqueueForMatchmaking();

      if (data?.matched && data.gameId) {
        navigateToBattle(data.gameId);
        return;
      }

      scheduleStatusPoll(500);
    } catch (e) {
      console.error(e);
      searchingRef.current = false;
      clearSearchTimers();
      setSearching(false);
      alert('匹配失败');
    }
  };

  const handleCancelSearch = async () => {
    searchingRef.current = false;
    clearSearchTimers();
    setSearching(false);

    try {
      await fetch(`${BACKEND_URL}/api/games/matchmaking/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      // ignore cancel errors
    }
  };

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const renderDeckDropdown = () => (
    <div className="relative mb-8">
      <button
        type="button"
        onClick={() => setDeckDropdownOpen(open => !open)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition-all',
          selectedDeckValidation.valid ? 'border-zinc-700 bg-zinc-950/70' : 'border-red-500/40 bg-red-950/20'
        )}
      >
        <div>
          <div className="text-base font-black text-white">{selectedDeck?.name || '请选择卡组'}</div>
          <div className="mt-1 text-xs font-bold text-zinc-500">
            {selectedDeck ? `${selectedDeck.cards.length} 张卡牌` : '匹配前需要选择合法卡组'}
          </div>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-zinc-500 transition-transform', deckDropdownOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {deckDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl"
          >
            {myDecks.map((deck, index) => {
              const validation = validateDeckForBattle(deck);
              const active = selectedDeckId === deck.id;
              return (
                <button
                  key={deck.id || `deck-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedDeckId(deck.id);
                    setDeckDropdownOpen(false);
                  }}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors',
                    active ? 'bg-red-600/20 text-white' : 'hover:bg-white/5',
                    !validation.valid && 'opacity-60'
                  )}
                >
                  <div>
                    <div className="text-sm font-bold">{deck.name}</div>
                    <div className={cn('mt-1 text-[10px] font-bold', validation.valid ? 'text-zinc-500' : 'text-red-400')}>
                      {validation.valid ? `${deck.cards.length} 张卡牌` : validation.error}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 text-red-400" />}
                </button>
              );
            })}
            {myDecks.length === 0 && (
              <div className="p-6 text-center text-sm text-zinc-500">
                还没有卡组
                <Link to="/deck-builder" className="ml-2 text-red-500 hover:underline">去创建</Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (loading) {
    return (
      <PageFallback
        title="对战模式加载中"
        description="正在加载卡组列表并连接对战服务，请稍候..."
      />
    );
  }

  return (
    <div className="pt-20 px-8 min-h-screen bg-black text-white pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-10">
          <button
            onClick={() => searching ? handleCancelSearch() : navigate('/')}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase">匹配模式</h1>
            <p className="text-zinc-500 text-[10px] md:text-sm font-bold uppercase tracking-widest leading-none">自动匹配对手</p>
          </div>
        </div>

        <AnimatePresence>
          {searching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <div className="relative w-24 h-24 mx-auto mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Swords className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tighter mb-2">正在寻找对手...</h2>
              <p className="text-zinc-500 text-base md:text-lg font-mono mb-6">{formatTime(searchTimer)}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCancelSearch}
                className="px-6 md:px-8 py-2 md:py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex items-center gap-2 mx-auto transition-colors text-sm md:text-base"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
                取消匹配
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {!searching && (
          <>
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">选择你的卡组</h2>
            {renderDeckDropdown()}

            {selectedDeckId && !selectedDeckValidation.valid && (
              <div className="mb-6 p-3 rounded-xl border border-red-500/30 bg-red-900/20 text-red-300 text-sm">
                当前选中的卡组不可用于匹配：{selectedDeckValidation.error}
              </div>
            )}

            <div className="flex justify-center mt-8">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartSearch}
                disabled={!selectedDeckId}
                className="w-full md:w-auto px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-base md:text-xl tracking-tighter flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all uppercase"
              >
                <Swords className="w-5 h-5 md:w-6 md:h-6" />
                开始匹配
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
