import fs from 'fs';
import path from 'path';

// Fix BigInt crash in index.ts
const indexFile = path.join(process.cwd(), 'server', 'index.ts');
let indexText = fs.readFileSync(indexFile, 'utf8');
indexText = indexText.replace(
/createdAt:\s*r\.created_at,\n\s*updatedAt:\s*r\.updated_at/g,
"createdAt: Number(r.created_at),\n            updatedAt: Number(r.updated_at)"
);
fs.writeFileSync(indexFile, indexText);

// Fix Matchmaking completely
const matchFile = path.join(process.cwd(), 'src', 'components', 'Matchmaking.tsx');
let matchText = fs.readFileSync(matchFile, 'utf8');

matchText = `import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { GameService } from '../services/gameService';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Plus, Users, Loader2 } from 'lucide-react';
import { CARD_LIBRARY } from '../data/cards';
import { cn } from '../lib/utils';
import { Deck } from '../types/game';

export const Matchmaking: React.FC = () => {
  const [waitingGames, setWaitingGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(BACKEND_URL + '/api/games');
        const data = await res.json();
        setWaitingGames(data.games || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, []);

  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  useEffect(() => {
    const loadDecks = async () => {
      if (!getAuthUser()) return;
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(\`\${BACKEND_URL}/api/user/decks\`, { headers: { 'Authorization': \`Bearer \${token}\` }});
      const data = await res.json();
      setMyDecks(data.decks || []);
      if (data.decks?.length > 0) setSelectedDeckId(data.decks[0].id);
    };
    loadDecks();
  }, []);

  const getSelectedDeckCards = () => {
    const deck = myDecks.find(d => d.id === selectedDeckId);
    if (!deck) return CARD_LIBRARY; // Fallback
    return deck.cards.map(id => CARD_LIBRARY.find(c => c.id === id)!).filter(Boolean);
  };

  const handleCreateGame = async () => {
    if (!selectedDeckId) {
      alert('请先选择一个卡组');
      return;
    }
    const cards = getSelectedDeckCards();
    const validation = GameService.validateDeck(cards);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(BACKEND_URL + '/api/games', { method: 'POST', headers: { 'Authorization': \`Bearer \${token}\` }});
      const data = await res.json();
      navigate(\`/battle/\${data.gameId}\`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeGame = async () => {
    if (!selectedDeckId) {
      alert('请先选择一个卡组');
      return;
    }
    const cards = getSelectedDeckCards();
    const validation = GameService.validateDeck(cards);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const res = await fetch(BACKEND_URL + '/api/games', { method: 'POST', headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ practice: true }) });
      const data = await res.json();
      navigate(\`/battle/\${data.gameId}\`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to create practice game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    if (!selectedDeckId) {
      alert('请先选择一个卡组');
      return;
    }
    const cards = getSelectedDeckCards();
    const validation = GameService.validateDeck(cards);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setLoading(true);
    try {
      navigate(\`/battle/\${gameId}\`);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">在线对战</h1>
          <p className="text-zinc-400">寻找对手或创建新的对局</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePracticeGame}
            disabled={loading}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
            练习模式
          </button>
          <button 
            onClick={handleCreateGame}
            disabled={loading}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            创建对局
          </button>
        </div>
      </div>

      <div className="mb-8 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">选择你的卡组</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {myDecks.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDeckId(d.id)}
              className={cn(
                "flex-shrink-0 px-6 py-3 rounded-xl border-2 transition-all text-left min-w-[200px]",
                selectedDeckId === d.id ? "border-red-600 bg-red-900/20" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
              )}
            >
              <p className="font-bold truncate">{d.name}</p>
              <p className="text-[10px] text-zinc-500">{d.cards.length} 张卡牌</p>
            </button>
          ))}
          {myDecks.length === 0 && (
            <Link to="/deck-builder" className="flex items-center gap-2 text-red-500 text-sm hover:underline">
              <Plus className="w-4 h-4" /> 去创建一个卡组
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {waitingGames.length === 0 ? (
          <div className="p-12 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p>当前没有等待中的对局</p>
          </div>
        ) : (
          waitingGames.map(game => (
            <div key={game.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-red-500 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-red-500">
                  {game.players[Object.keys(game.players)[0]]?.displayName?.[0] || '?'}
                </div>
                <div>
                  <h3 className="font-bold">{game.players[Object.keys(game.players)[0]]?.displayName || 'Unknown Player'} 的对局</h3>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">Waiting for opponent...</p>
                </div>
              </div>
              <button 
                onClick={() => handleJoinGame(game.id)}
                disabled={loading}
                className="px-6 py-2 bg-zinc-800 group-hover:bg-red-600 rounded-lg font-bold transition-all"
              >
                加入战斗
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
`;
fs.writeFileSync(matchFile, matchText);

console.log("Bugfixes applied successfully");
