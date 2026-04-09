import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Filter, Layout, CreditCard, Image as ImageIcon, Copy, Trash2, Plus, Check, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { CARD_LIBRARY } from '../data/cards';
import { Card, Deck } from '../types/game';
import { CardComponent } from './Card';
import { getAuthUser } from '../socket';

const RARITY_BADGE: Record<string, string> = {
  C: 'bg-zinc-700 text-zinc-300', U: 'bg-emerald-900 text-emerald-300', R: 'bg-blue-900 text-blue-300',
  SR: 'bg-purple-900 text-purple-300', UR: 'bg-amber-900 text-amber-300', SER: 'bg-amber-800 text-amber-200', PR: 'bg-rose-900 text-rose-300',
};

const RAY_CARDS = [
  { id: 'fav_card', name: '默认雷亚卡', url: '/assets/fav_card/fav_card.jpg' },
  { id: 'fav_card_1', name: '雷亚卡 01', url: '/assets/fav_card/fav_card_1.jpg' },
  { id: 'fav_card_2', name: '雷亚卡 02', url: '/assets/fav_card/fav_card_2.jpg' },
  { id: 'fav_card_3', name: '雷亚卡 03', url: '/assets/fav_card/fav_card_3.jpg' },
  { id: 'fav_card_4', name: '雷亚卡 04', url: '/assets/fav_card/fav_card_4.jpg' },
];

const CARD_BACKS = [
  { id: 'default', name: '默认卡背', url: '/assets/card_bg.jpg' },
  { id: 'back_1', name: '星空轨迹', url: '/assets/card_bg.jpg' }, 
  { id: 'back_2', name: '深渊之触', url: '/assets/card_bg.jpg' },
  { id: 'back_3', name: '黄金黎明', url: '/assets/card_bg.jpg' },
];

type CollectionTab = 'DECKS' | 'CARDS' | 'BACKS' | 'RAY_CARDS';

export const Collection: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as CollectionTab) || 'CARDS';
  
  const user = getAuthUser();
  const [activeTab, setActiveTab] = useState<CollectionTab>(initialTab);
  const [collection, setCollection] = useState<Record<string, number>>({});
  const [decks, setDecks] = useState<Deck[]>([]);
  const [profile, setProfile] = useState<{ favoriteCardId: string; favoriteBackId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Card Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    ac: '', damage: '', power: '', faction: '', ownership: 'ALL'
  });

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [collRes, deckRes, profRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/user/collection`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND_URL}/api/user/decks`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const collData = await collRes.json();
        const deckData = await deckRes.json();
        const profData = await profRes.json();

        setCollection(collData.collection || {});
        setDecks(deckData.decks || []);
        setProfile({ favoriteCardId: profData.favoriteCardId, favoriteBackId: profData.favoriteBackId });
      } catch (e) {
        console.error('Failed to fetch collection data:', e);
      }
      setLoading(false);
    };
    fetchData();
  }, [BACKEND_URL, token]);

  const handleUpdateProfile = async (updates: Partial<{ favoriteCardId: string; favoriteBackId: string }>) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setProfile(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (e) {
      console.error('Failed to update profile:', e);
    }
  };

  const filteredCards = CARD_LIBRARY.filter(card => {
    if (searchTerm && !card.fullName.includes(searchTerm) && !(card.specialName && card.specialName.includes(searchTerm))) return false;
    if (filterRarity && card.rarity !== filterRarity) return false;
    if (filterColor && card.color !== filterColor) return false;
    if (filters.ac !== '' && card.acValue.toString() !== filters.ac) return false;
    if (filters.damage !== '' && card.damage?.toString() !== filters.damage) return false;
    if (filters.power !== '' && card.power?.toString() !== filters.power) return false;
    if (filters.faction !== '' && !card.faction?.toLocaleLowerCase().includes(filters.faction.toLocaleLowerCase())) return false;
    const isOwned = (collection[card.uniqueId] || collection[card.id] || 0) > 0;
    if (filters.ownership === 'OWNED' && !isOwned) return false;
    if (filters.ownership === 'NOT_OWNED' && isOwned) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header and Tab Switcher */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 transition-all border border-white/5 group">
              <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter uppercase">我的收藏</h1>
              <div className="flex gap-2 mt-4">
                <TabButton active={activeTab === 'DECKS'} onClick={() => setActiveTab('DECKS')} icon={<Layout className="w-4 h-4" />} label="卡组" />
                <TabButton active={activeTab === 'CARDS'} onClick={() => setActiveTab('CARDS')} icon={<CreditCard className="w-4 h-4" />} label="卡牌" />
                <TabButton active={activeTab === 'BACKS'} onClick={() => setActiveTab('BACKS')} icon={<ImageIcon className="w-4 h-4" />} label="卡背" />
                <TabButton active={activeTab === 'RAY_CARDS'} onClick={() => setActiveTab('RAY_CARDS')} icon={<Plus className="w-4 h-4" />} label="雷亚卡" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-2xl border border-white/5">
             <div className="px-4 py-2 text-center">
               <p className="text-[10px] text-zinc-500 uppercase font-bold">已拥有种数</p>
               <p className="text-xl font-black italic">{Object.keys(collection).length}</p>
             </div>
             <div className="w-px h-8 bg-white/10" />
             <div className="px-4 py-2 text-center">
               <p className="text-[10px] text-zinc-500 uppercase font-bold">总收藏张数</p>
               <p className="text-xl font-black italic">{Object.values(collection).reduce((a, b) => a + b, 0)}</p>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'DECKS' && (
            <motion.div key="decks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2 italic"><Layout className="w-5 h-5 text-red-600" /> 我的卡组</h2>
                <button onClick={() => navigate('/deck-builder')} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all">
                  <Plus className="w-4 h-4" /> 创建新卡组
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {decks.map(deck => (
                  <DeckCard key={deck.id} deck={deck} onClick={() => navigate(`/deck-builder?id=${deck.id}`)} />
                ))}
                {decks.length === 0 && (
                  <div className="col-span-full py-20 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-500">
                    <Layout className="w-12 h-12 mb-4 opacity-20" />
                    <p>暂无卡组，快去创建一个吧</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'CARDS' && (
            <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Filters */}
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all font-medium"
                      placeholder="搜索卡牌名称..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1.5 p-1.5 bg-zinc-900/50 rounded-2xl border border-white/5">
                    {['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE'].map(c => (
                      <button
                        key={c}
                        onClick={() => setFilterColor(filterColor === c ? null : c)}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center",
                          filterColor === c ? 'border-white scale-105' : 'border-transparent hover:scale-105',
                          c === 'RED' && 'bg-red-700', c === 'BLUE' && 'bg-blue-700',
                          c === 'GREEN' && 'bg-green-700', c === 'YELLOW' && 'bg-yellow-600',
                          c === 'WHITE' && 'bg-zinc-300',
                        )}
                      >
                         {filterColor === c && <Check className={cn("w-5 h-5", c === 'WHITE' ? 'text-black' : 'text-white')} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {['C', 'U', 'R', 'SR', 'UR', 'SER', 'PR'].map(r => (
                    <button
                      key={r}
                      onClick={() => setFilterRarity(filterRarity === r ? null : r)}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-black transition-all border",
                        filterRarity === r ? `${RARITY_BADGE[r]} border-white` : "bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                  <select 
                    className="bg-zinc-900/50 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                    value={filters.ownership}
                    onChange={e => setFilters({...filters, ownership: e.target.value})}
                  >
                    <option value="ALL">全部状态</option>
                    <option value="OWNED">已拥有</option>
                    <option value="NOT_OWNED">未拥有</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {filteredCards.map(card => {
                  const qty = collection[card.uniqueId] || collection[card.id] || 0;
                  const isOwned = qty > 0;
                  return (
                    <motion.div 
                      key={card.uniqueId} 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn("relative group transition-all duration-300", !isOwned && "opacity-40 grayscale-[0.8] hover:grayscale-0 hover:opacity-80")}
                    >
                      <CardComponent card={card} displayMode="deck" />
                      <div className="absolute -top-2 -right-2 z-10">
                        <div className={cn(
                          "px-2.5 py-1 rounded-lg border font-black italic text-xs shadow-xl",
                          isOwned ? "bg-red-600 border-red-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        )}>
                          x{qty}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'BACKS' && (
            <motion.div key="backs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {CARD_BACKS.map(back => (
                  <div key={back.id} className="relative group flex flex-col gap-4">
                    <div className={cn(
                      "aspect-[2.5/3.5] rounded-2xl overflow-hidden border-4 transition-all duration-500 relative bg-zinc-900",
                      profile?.favoriteBackId === back.id ? "border-red-600 scale-[1.02] shadow-[0_0_30px_rgba(220,38,38,0.3)]" : "border-zinc-800 grayscale group-hover:grayscale-0 group-hover:border-zinc-600"
                    )}>
                      <img src={back.url} alt={back.name} className="w-full h-full object-cover" />
                      {profile?.favoriteBackId === back.id && (
                        <div className="absolute top-4 right-4 bg-red-600 p-2 rounded-xl shadow-xl">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 text-center">
                       <h3 className="font-black italic text-lg uppercase tracking-wider">{back.name}</h3>
                       <button
                         onClick={() => handleUpdateProfile({ favoriteBackId: back.id })}
                         disabled={profile?.favoriteBackId === back.id}
                         className={cn(
                           "mt-3 w-full py-3 rounded-xl font-bold text-sm transition-all",
                           profile?.favoriteBackId === back.id 
                             ? "bg-zinc-900 text-zinc-600 cursor-default" 
                             : "bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white"
                         )}
                       >
                         {profile?.favoriteBackId === back.id ? '使用中' : '点击使用'}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'RAY_CARDS' && (
            <motion.div key="ray" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {RAY_CARDS.map(rc => (
                  <div key={rc.id} className="relative group">
                    <div className={cn(
                      "aspect-video rounded-3xl overflow-hidden border-4 transition-all duration-500 relative bg-zinc-900",
                      profile?.favoriteCardId === rc.id ? "border-red-600 scale-[1.02] shadow-[0_0_40px_rgba(220,38,38,0.4)]" : "border-zinc-800 grayscale group-hover:grayscale-0 group-hover:border-zinc-600"
                    )}>
                      <img src={rc.url} alt={rc.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="mt-6 flex items-center justify-between px-2">
                      <div>
                        <h3 className="font-black italic text-xl uppercase tracking-tighter">{rc.name}</h3>
                        <p className="text-zinc-500 text-xs text-left">雷亚卡收藏 (背景模式)</p>
                      </div>
                      <button
                         onClick={() => handleUpdateProfile({ favoriteCardId: rc.id })}
                         className={cn(
                           "p-4 rounded-2xl transition-all shadow-xl",
                           profile?.favoriteCardId === rc.id
                             ? "bg-red-600 text-white cursor-default scale-110"
                             : "bg-zinc-900 text-zinc-500 hover:bg-red-600/20 hover:text-red-500"
                         )}
                       >
                         {profile?.favoriteCardId === rc.id ? <Check className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all border uppercase italic tracking-tighter",
      active ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/40" : "bg-zinc-900 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
    )}
  >
    {icon}
    {label}
  </button>
);

const DeckCard = ({ deck, onClick }: { deck: Deck; onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="group relative bg-zinc-900/40 border border-white/5 rounded-3xl p-6 hover:bg-zinc-900/60 hover:border-red-600/50 transition-all cursor-pointer overflow-hidden"
  >
    <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
       <Layout className="w-48 h-48" />
    </div>
    <div className="relative z-10 text-left">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-red-600/10 rounded-2xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
          <CreditCard className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-black italic px-2 py-1 bg-white/5 rounded-lg text-zinc-500">
          ID: {deck.id}
        </span>
      </div>
      <h3 className="text-2xl font-black italic mb-1 uppercase tracking-tighter truncate">{deck.name}</h3>
      <p className="text-zinc-500 text-sm mb-6 flex items-center gap-2 font-bold uppercase">
         {deck.cards.length} CARDS • {new Date(deck.createdAt).toLocaleDateString()}
      </p>
      <div className="flex gap-2">
        <button className="flex-1 py-3.5 bg-zinc-800 hover:bg-red-600 text-white font-black rounded-2xl transition-all text-xs uppercase italic">
          EDIT DECK
        </button>
      </div>
    </div>
  </div>
);
