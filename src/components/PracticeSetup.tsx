import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { getAuthUser } from '../socket';
import { Deck } from '../types/game';

export const PracticeSetup: React.FC = () => {
  const navigate = useNavigate();
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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
  }, []);

  const handleStart = async () => {
    if (!selectedDeckId) { alert('请先选择一个卡组'); return; }
    setStarting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/practice`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deckId: selectedDeckId })
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
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter">练习模式</h1>
            <p className="text-zinc-500 text-sm">与AI对手进行练习对战，机器人将使用与你相同的卡组</p>
          </div>
        </div>

        {/* Bot Info */}
        <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)]">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black italic tracking-tighter">AI 对手</h2>
            <p className="text-zinc-500 text-sm mt-1">机器人将镜像你的卡组进行对战</p>
            <p className="text-zinc-600 text-xs mt-0.5">• 自动出牌 • 无限重赛 • 不影响排名</p>
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

        {/* Start Button */}
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={starting || !selectedDeckId}
            className="px-12 py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-xl tracking-tighter flex items-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all"
          >
            {starting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
            开始练习
          </motion.button>
        </div>
      </div>
    </div>
  );
};
