import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { CARD_LIBRARY } from '../data/cards';
import { Card } from '../types/game';

const RARITY_COLORS: Record<string, string> = {
  C: 'border-zinc-600', U: 'border-emerald-600', R: 'border-blue-600',
  SR: 'border-purple-600', UR: 'border-amber-500', SER: 'border-amber-400', PR: 'border-rose-500',
};
const RARITY_BADGE: Record<string, string> = {
  C: 'bg-zinc-700 text-zinc-300', U: 'bg-emerald-900 text-emerald-300', R: 'bg-blue-900 text-blue-300',
  SR: 'bg-purple-900 text-purple-300', UR: 'bg-amber-900 text-amber-300', SER: 'bg-amber-800 text-amber-200', PR: 'bg-rose-900 text-rose-300',
};

export const Collection: React.FC = () => {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const loadCollection = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/collection`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setCollection(data.collection || {});
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadCollection();
  }, []);

  const ownedCards = CARD_LIBRARY.filter(card => {
    // Check both base id (legacy) and uniqueId (new)
    const owned = (collection[card.uniqueId] || collection[card.id] || 0);
    if (owned === 0) return false;
    if (searchTerm && !card.fullName.includes(searchTerm) && !(card.specialName && card.specialName.includes(searchTerm))) return false;
    if (filterRarity && card.rarity !== filterRarity) return false;
    if (filterColor && card.color !== filterColor) return false;
    return true;
  });

  const totalOwned = Object.values(collection).reduce((sum: number, qty: number) => sum + qty, 0);
  const uniqueOwned = Object.keys(collection).filter(k => collection[k] > 0).length;

  const getRarityClass = (rarity: string) => {
    switch (rarity) {
      case 'C':
      case 'U': return 'rarity-border-cu';
      case 'R': return 'rarity-border-r';
      case 'SR': return 'rarity-border-sr';
      case 'UR': return 'rarity-border-ur';
      case 'SER': return 'rarity-border-ser';
      case 'PR': return 'rarity-border-pr';
      default: return 'border-zinc-700';
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter">我的收藏</h1>
              <p className="text-zinc-500 text-sm">拥有 {uniqueOwned} 种 / 共 {totalOwned} 张卡牌</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/deck-builder')}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-sm transition-colors"
          >
            前往组卡
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-red-600 transition-all"
              placeholder="搜索卡牌..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {['C', 'U', 'R', 'SR', 'UR', 'SER', 'PR'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRarity(filterRarity === r ? null : r)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                  filterRarity === r ? RARITY_BADGE[r] : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE'].map(c => (
              <button
                key={c}
                onClick={() => setFilterColor(filterColor === c ? null : c)}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 transition-all",
                  filterColor === c ? 'border-white scale-110' : 'border-zinc-800 hover:border-zinc-600',
                  c === 'RED' && 'bg-red-700', c === 'BLUE' && 'bg-blue-700',
                  c === 'GREEN' && 'bg-green-700', c === 'YELLOW' && 'bg-yellow-600',
                  c === 'WHITE' && 'bg-zinc-300',
                )}
              />
            ))}
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {ownedCards.map(card => (
            <motion.div
              key={card.uniqueId}
              whileHover={{ scale: 1.05 }}
              className={cn(
                "relative aspect-[3/4] rounded-xl border-2 overflow-hidden cursor-pointer group",
                getRarityClass(card.rarity)
              )}
            >
              <img 
                src={card.imageUrl || getCardImageUrl(card.id, card.rarity, true)} 
                alt={card.fullName} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-[11px] font-bold truncate">{card.fullName}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", RARITY_BADGE[card.rarity])}>{card.rarity}</span>
                  <span className="text-[10px] text-zinc-400">x{collection[card.uniqueId] || collection[card.id] || 0}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {ownedCards.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-lg">没有符合条件的卡牌</p>
            <button onClick={() => navigate('/store')} className="mt-4 text-red-500 text-sm hover:underline">
              去商店购买卡包
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
