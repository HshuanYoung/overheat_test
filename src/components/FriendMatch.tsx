import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, LogIn, Loader2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { getAuthUser } from '../socket';
import { Deck } from '../types/game';

export const FriendMatch: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [createdGameId, setCreatedGameId] = useState('');
  const [error, setError] = useState('');

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

  // Poll for opponent when waiting
  useEffect(() => {
    if (!waitingForOpponent || !createdGameId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/games`);
        const data = await res.json();
        const game = (data.games || []).find((g: any) => g.id === createdGameId);
        if (game && game.playerIds && game.playerIds.length >= 2) {
          clearInterval(interval);
          navigate(`/battle/${createdGameId}`, { state: { deckId: selectedDeckId } });
        }
      } catch (e) { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [waitingForOpponent, createdGameId]);

  const handleCreateRoom = async () => {
    if (!selectedDeckId) { alert('请先选择一个卡组'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/friend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId: selectedDeckId }),
      });
      const data = await res.json();
      setCreatedRoomCode(data.roomCode);
      setCreatedGameId(data.gameId);
      setWaitingForOpponent(true);
    } catch (e: any) {
      setError(e.message || '创建房间失败');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!selectedDeckId) { alert('请先选择一个卡组'); return; }
    if (!roomCode || roomCode.length < 6) { setError('请输入有效的房间码'); return; }
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/friend/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, deckId: selectedDeckId }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setJoining(false); return; }
      navigate(`/battle/${data.gameId}`, { state: { deckId: selectedDeckId } });
    } catch (e: any) {
      setError(e.message || '加入房间失败');
    } finally {
      setJoining(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <button onClick={() => waitingForOpponent ? setWaitingForOpponent(false) : mode === 'select' ? navigate('/') : setMode('select')} className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter">好友约战</h1>
            <p className="text-zinc-500 text-sm">创建或加入一个私人对战房间</p>
          </div>
        </div>

        {/* Waiting for opponent screen */}
        {waitingForOpponent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black italic tracking-tighter mb-4">等待对手加入...</h2>
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-8 py-4 mb-4">
              <span className="text-zinc-500 text-sm">房间码:</span>
              <span className="text-3xl font-mono font-black tracking-[0.3em] text-amber-400">{createdRoomCode}</span>
              <button onClick={copyCode} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-zinc-500" />}
              </button>
            </div>
            <p className="text-zinc-600 text-sm">将房间码发送给你的好友</p>
          </motion.div>
        )}

        {/* Mode selection */}
        {!waitingForOpponent && mode === 'select' && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.div 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setMode('create')}
              className="p-8 rounded-2xl bg-gradient-to-br from-red-900/20 to-zinc-900 border border-zinc-800 hover:border-red-600/50 cursor-pointer text-center transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-red-600/20 group-hover:bg-red-600 flex items-center justify-center mx-auto mb-4 transition-colors">
                <Plus className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black italic tracking-tighter mb-1">创建房间</h3>
              <p className="text-zinc-500 text-xs">生成房间码邀请好友</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setMode('join')}
              className="p-8 rounded-2xl bg-gradient-to-br from-blue-900/20 to-zinc-900 border border-zinc-800 hover:border-blue-600/50 cursor-pointer text-center transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-blue-600/20 group-hover:bg-blue-600 flex items-center justify-center mx-auto mb-4 transition-colors">
                <LogIn className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black italic tracking-tighter mb-1">加入房间</h3>
              <p className="text-zinc-500 text-xs">输入房间码加入对战</p>
            </motion.div>
          </div>
        )}

        {/* Create room / Join room panels */}
        {!waitingForOpponent && mode !== 'select' && (
          <>
            {/* Deck Selection */}
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">选择你的卡组</h2>
            <div className="grid grid-cols-1 gap-3 mb-8">
              {myDecks.map(d => (
                <motion.div
                  key={d.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedDeckId(d.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between",
                    selectedDeckId === d.id ? "border-red-600 bg-red-900/15" : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  )}
                >
                  <div>
                    <p className="font-bold">{d.name}</p>
                    <p className="text-xs text-zinc-500">{d.cards.length} 张卡牌</p>
                  </div>
                  {selectedDeckId === d.id && <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>}
                </motion.div>
              ))}
              {myDecks.length === 0 && (
                <div className="p-12 border-2 border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500">
                  <p>还没有卡组</p>
                  <button onClick={() => navigate('/deck-builder')} className="mt-2 text-red-500 text-sm hover:underline">去创建一个卡组</button>
                </div>
              )}
            </div>

            {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

            {mode === 'create' && (
              <div className="flex justify-center">
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleCreateRoom}
                  disabled={creating || !selectedDeckId}
                  className="px-10 py-3.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-lg tracking-tighter flex items-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  创建房间
                </motion.button>
              </div>
            )}

            {mode === 'join' && (
              <div className="flex flex-col items-center gap-4">
                <input
                  className="text-center text-2xl font-mono font-bold tracking-[0.3em] bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 w-80 focus:outline-none focus:border-red-600 transition-all"
                  placeholder="输入房间码"
                  maxLength={8}
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.replace(/\D/g, ''))}
                />
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleJoinRoom}
                  disabled={joining || !selectedDeckId || roomCode.length < 6}
                  className="px-10 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl font-black italic text-lg tracking-tighter flex items-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.3)] disabled:opacity-50 transition-all"
                >
                  {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  加入房间
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
