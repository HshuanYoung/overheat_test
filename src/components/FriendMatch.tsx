import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, LogIn, Loader2, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { validateDeckForBattle } from '../lib/deckValidation';
import { getAuthToken, getAuthUser } from '../socket';
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
  const [turnTime, setTurnTime] = useState(300);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const token = getAuthToken();
  const selectedDeck = myDecks.find(deck => deck.id === selectedDeckId) || null;
  const selectedDeckValidation = validateDeckForBattle(selectedDeck);

  const clearPoll = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

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
        if (data.decks?.length > 0) setSelectedDeckId(data.decks[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadDecks();
    void import('./BattleField');

    return () => clearPoll();
  }, [BACKEND_URL, token]);

  useEffect(() => {
    if (!waitingForOpponent || !createdGameId) return;

    const pollFriendRoomStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/games/friend/${createdGameId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          schedulePoll(1200);
          return;
        }

        const data = await res.json();
        if (data.joined) {
          clearPoll();
          navigate(`/battle/${createdGameId}`, { state: { deckId: selectedDeckId } });
          return;
        }

        schedulePoll(800);
      } catch (e) {
        console.error('[FriendMatch] Poll error:', e);
        schedulePoll(1500);
      }
    };

    const schedulePoll = (delayMs: number) => {
      clearPoll();
      pollRef.current = setTimeout(() => {
        void pollFriendRoomStatus();
      }, delayMs);
    };

    void pollFriendRoomStatus();

    return () => clearPoll();
  }, [waitingForOpponent, createdGameId, navigate, selectedDeckId, BACKEND_URL, token]);

  const handleCreateRoom = async () => {
    if (!selectedDeckValidation.valid) {
      alert(selectedDeckValidation.error || '请选择合法的卡组');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/friend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId: selectedDeckId,
          turnTimerLimit: turnTime
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '创建房间失败');
        return;
      }

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
    if (!selectedDeckValidation.valid) {
      alert(selectedDeckValidation.error || '请选择合法的卡组');
      return;
    }
    if (!roomCode || roomCode.length < 6) {
      setError('请输入有效的房间码');
      return;
    }

    setJoining(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/friend/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, deckId: selectedDeckId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '加入房间失败');
        setJoining(false);
        return;
      }

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
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-10 px-2 md:px-0">
          <button
            onClick={() => waitingForOpponent ? setWaitingForOpponent(false) : mode === 'select' ? navigate('/') : setMode('select')}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase">好友约战</h1>
            <p className="text-zinc-500 text-[10px] md:text-sm font-bold tracking-widest leading-none">私人对战房间</p>
          </div>
        </div>

        {waitingForOpponent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 md:py-16">
            <Loader2 className="w-10 h-10 md:w-12 md:h-12 animate-spin text-red-500 mx-auto mb-6" />
            <h2 className="text-xl md:text-2xl font-black italic tracking-tighter mb-4 md:mb-6 uppercase">等待对手加入...</h2>
            <div className="inline-flex flex-col md:flex-row items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 md:px-8 py-4 md:py-6 mb-4 w-full md:w-auto">
              <span className="text-zinc-500 text-[10px] md:text-sm font-bold tracking-widest leading-none">房间码：</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl md:text-4xl font-mono font-black tracking-[0.2em] md:tracking-[0.3em] text-amber-400">{createdRoomCode}</span>
                <button onClick={copyCode} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  {copied ? <Check className="w-5 h-5 md:w-6 md:h-6 text-green-500" /> : <Copy className="w-5 h-5 md:w-6 md:h-6 text-zinc-500" />}
                </button>
              </div>
            </div>
            <p className="text-zinc-600 text-[10px] md:text-sm font-bold tracking-widest">请将房间码发送给你的好友</p>
          </motion.div>
        )}

        {!waitingForOpponent && mode === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('create')}
              className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-red-900/10 to-zinc-900 border border-zinc-800 hover:border-red-600/50 cursor-pointer text-center transition-all group"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600/10 group-hover:bg-red-600 flex items-center justify-center mx-auto mb-3 md:mb-4 transition-colors">
                <Plus className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-black italic tracking-tighter mb-1 uppercase">创建房间</h3>
              <p className="text-zinc-500 text-[10px] md:text-xs font-bold tracking-widest leading-none">邀请好友进入房间</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('join')}
              className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-blue-900/10 to-zinc-900 border border-zinc-800 hover:border-blue-600/50 cursor-pointer text-center transition-all group"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-blue-600/10 group-hover:bg-blue-600 flex items-center justify-center mx-auto mb-3 md:mb-4 transition-colors">
                <LogIn className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-xl font-black italic tracking-tighter mb-1 uppercase">加入房间</h3>
              <p className="text-zinc-500 text-[10px] md:text-xs font-bold tracking-widest leading-none">输入房间码加入对局</p>
            </motion.div>
          </div>
        )}

        {!waitingForOpponent && mode !== 'select' && (
          <>
            <h2 className="text-sm font-bold text-zinc-500 tracking-widest mb-4">选择你的卡组</h2>
            <div className="grid grid-cols-1 gap-3 mb-8">
              {myDecks.map(d => (
                <motion.div
                  key={d.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedDeckId(d.id)}
                  className={cn(
                    'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between',
                    selectedDeckId === d.id ? 'border-red-600 bg-red-900/15' : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                  )}
                >
                  <div>
                    <p className="font-bold">{d.name}</p>
                    <p className="text-xs text-zinc-500">{d.cards.length} 张卡牌</p>
                  </div>
                  {selectedDeckId === d.id && (
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
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
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm">
                当前选中的卡组不可用于对战：{selectedDeckValidation.error}
              </div>
            )}

            {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

            {mode === 'create' && (
              <div className="mb-10 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-zinc-500 tracking-widest">回合时间（秒）</h2>
                  <span className="text-2xl font-black italic tracking-tighter text-red-500">{turnTime}秒</span>
                </div>
                <input
                  type="range"
                  min="180"
                  max="999"
                  step="10"
                  value={turnTime}
                  onChange={(e) => setTurnTime(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-bold tracking-widest">
                  <span>最短 180 秒</span>
                  <span>默认 300 秒</span>
                  <span>最长 999 秒</span>
                </div>
              </div>
            )}

            {mode === 'create' && (
              <div className="flex justify-center mt-6">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreateRoom}
                  disabled={creating || !selectedDeckId}
                  className="w-full md:w-auto px-8 md:px-10 py-3 md:py-3.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl font-black italic text-base md:text-lg tracking-tighter flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:opacity-50 transition-all"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  创建房间
                </motion.button>
              </div>
            )}

            {mode === 'join' && (
              <div className="flex flex-col items-center gap-6 mt-4">
                <input
                  className="text-center text-xl md:text-2xl font-mono font-bold tracking-[0.2em] md:tracking-[0.3em] bg-zinc-900 border border-zinc-800 rounded-xl px-4 md:px-6 py-3 md:py-4 w-full md:w-80 focus:outline-none focus:border-red-600 transition-all"
                  placeholder="输入房间码"
                  maxLength={8}
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.replace(/\D/g, ''))}
                />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleJoinRoom}
                  disabled={joining || !selectedDeckId || roomCode.length < 6}
                  className="w-full md:w-auto px-8 md:px-10 py-3 md:py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl font-black italic text-base md:text-lg tracking-tighter flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.3)] disabled:opacity-50 transition-all"
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
