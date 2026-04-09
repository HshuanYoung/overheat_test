import { getAuthUser, socket } from '../socket';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Swords, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Deck } from '../types/game';

export const Matchmaking: React.FC = () => {
  const navigate = useNavigate();
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const loadDecks = async () => {
      if (!getAuthUser()) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/decks`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setMyDecks(data.decks || []);
        if (data.decks?.length > 0) setSelectedDeckId(data.decks[0].id);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadDecks();

    // Listen for match found via socket
    socket.on('matchFound', (data: { gameId: string }) => {
      setSearching(false);
      navigate(`/battle/${data.gameId}`, { state: { deckId: selectedDeckId } });
    });

    return () => {
      socket.off('matchFound');
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleStartSearch = async () => {
    if (!selectedDeckId) { alert('请先选择一个卡组'); return; }
    setSearching(true);
    setSearchTimer(0);

    // Start timer
    timerRef.current = setInterval(() => setSearchTimer(prev => prev + 1), 1000);

    try {
      const res = await fetch(`${BACKEND_URL}/api/games/matchmaking`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });
      const data = await res.json();
      if (data.matched && data.gameId) {
        setSearching(false);
        if (timerRef.current) clearInterval(timerRef.current);
        navigate(`/battle/${data.gameId}`, { state: { deckId: selectedDeckId } });
        return;
      }
      // Not matched yet, poll for match
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${BACKEND_URL}/api/games/matchmaking`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deckId: selectedDeckId })
          });
          const pollData = await pollRes.json();
          if (pollData.matched && pollData.gameId) {
            setSearching(false);
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            navigate(`/battle/${pollData.gameId}`, { state: { deckId: selectedDeckId } });
          }
        } catch (e) { /* ignore */ }
      }, 3000);
    } catch (e) {
      console.error(e);
      setSearching(false);
      if (timerRef.current) clearInterval(timerRef.current);
      alert('匹配失败');
    }
  };

  const handleCancelSearch = async () => {
    setSearching(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await fetch(`${BACKEND_URL}/api/games/matchmaking/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) { /* ignore */ }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="pt-20 px-8 min-h-screen bg-black text-white pb-20">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => searching ? handleCancelSearch() : navigate('/')} className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter">匹配模式</h1>
            <p className="text-zinc-500 text-sm">选择卡组，自动匹配对手</p>
          </div>
        </div>

        {/* Searching Animation */}
        <AnimatePresence>
          {searching && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <div className="relative w-24 h-24 mx-auto mb-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Swords className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter mb-2">正在寻找对手...</h2>
              <p className="text-zinc-500 text-lg font-mono mb-6">{formatTime(searchTimer)}</p>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleCancelSearch}
                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex items-center gap-2 mx-auto transition-colors"
              >
                <X className="w-5 h-5" />
                取消匹配
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deck Selection (shown when not searching) */}
        {!searching && (
          <>
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">选择你的卡组</h2>
            <div className="grid grid-cols-1 gap-3 mb-8">
              {myDecks.map(d => (
                <motion.div
                  key={d.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedDeckId(d.id)}
                  className={cn(
                    "p-5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between",
                    selectedDeckId === d.id
                      ? "border-red-600 bg-red-900/15 shadow-[0_0_20px_rgba(220,38,38,0.15)]"
                      : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  )}
                >
                  <div>
                    <p className="font-bold text-lg">{d.name}</p>
                    <p className="text-xs text-zinc-500">{d.cards.length} 张卡牌</p>
                  </div>
                  {selectedDeckId === d.id && (
                    <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </motion.div>
              ))}
              {myDecks.length === 0 && (
                <div className="p-12 border-2 border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
                  <p>还没有卡组</p>
                  <Link to="/deck-builder" className="mt-2 text-red-500 text-sm hover:underline block">去创建一个卡组</Link>
                </div>
              )}
            </div>

            {/* Start Button */}
            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartSearch}
                disabled={!selectedDeckId}
                className="px-12 py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-xl tracking-tighter flex items-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all"
              >
                <Swords className="w-6 h-6" />
                开始匹配
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
