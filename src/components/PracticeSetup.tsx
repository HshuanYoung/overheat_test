import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { validateDeckForBattle } from '../lib/deckValidation';
import { getAuthUser } from '../socket';
import { Deck } from '../types/game';

export const PracticeSetup: React.FC = () => {
  const navigate = useNavigate();
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [turnTime, setTurnTime] = useState(300);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const token = localStorage.getItem('token');
  const selectedDeck = myDecks.find(deck => deck.id === selectedDeckId) || null;
  const selectedDeckValidation = validateDeckForBattle(selectedDeck);

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
  }, []);

  const handleStart = async () => {
    if (!selectedDeckValidation.valid) {
      alert(selectedDeckValidation.error || '请选择合法的卡组');
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/practice`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          deckId: selectedDeckId,
          turnTimerLimit: turnTime
        })
      });
      const data = await res.json();
      navigate(`/battle/${data.gameId}`, { state: { deckId: selectedDeckId } });
    } catch (e: any) {
      console.error(e);
      alert(e.message || '创建练习对局失败');
    } finally {
      setStarting(false);
    }
  };

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
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-10 px-2 md:px-0">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase">练习模式</h1>
            <p className="text-zinc-500 text-[10px] md:text-sm font-bold tracking-widest leading-none">镜像对战练习</p>
          </div>
        </div>

        {/* Bot Info */}
        {/* Bot Info */}
        <div className="mb-8 md:mb-10 p-4 md:p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)] shrink-0">
            <Bot className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black italic tracking-tighter">人机对手</h2>
            <p className="text-zinc-500 text-[10px] md:text-sm mt-1">机器人将镜像你的卡组进行对战</p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
              <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">• 自动出牌</span>
              <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">• 无限重赛</span>
              <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">• 不影响排名</span>
            </div>
          </div>
        </div>

        {/* Deck Selection */}
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
              <button onClick={() => navigate('/deck-builder')} className="mt-2 text-red-500 text-sm hover:underline">去创建一个卡组</button>
            </div>
          )}
        </div>

        {selectedDeckId && !selectedDeckValidation.valid && (
          <div className="mb-6 p-3 rounded-xl border border-red-500/30 bg-red-900/20 text-red-300 text-sm">
            当前选中的卡组不可用于机器人对战：{selectedDeckValidation.error}
          </div>
        )}

        {/* Turn Time Setting */}
        <div className="mb-10 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">回合对局时间 (秒)</h2>
            <span className="text-2xl font-black italic tracking-tighter text-red-500">{turnTime}秒</span>
          </div>
          <input
            type="range"
            min="180"
            max="999"
            step="10"
            value={turnTime}
            onChange={(e) => setTurnTime(parseInt(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
          <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
            <span>最短 180 秒</span>
            <span>默认 300 秒</span>
            <span>最长 999 秒</span>
          </div>
        </div>

        {/* Start Button */}
        {/* Start Button */}
        <div className="flex justify-center mt-8 px-4 md:px-0">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={starting || !selectedDeckId}
            className="w-full md:w-auto px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-base md:text-xl tracking-tighter flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all uppercase"
          >
            {starting ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <Play className="w-5 h-5 md:w-6 md:h-6" />}
            开始练习
          </motion.button>
        </div>
      </div>
    </div>
  );
};
