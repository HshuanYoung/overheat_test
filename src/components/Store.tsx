import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Coins, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { CARD_LIBRARY } from '../data/cards';
import { Card } from '../types/game';

const RARITY_COLORS: Record<string, string> = {
  C: 'border-zinc-500 shadow-zinc-500/20',
  U: 'border-emerald-500 shadow-emerald-500/30',
  R: 'border-blue-500 shadow-blue-500/30',
  SR: 'border-purple-500 shadow-purple-500/40',
  UR: 'border-amber-400 shadow-amber-400/50',
  SER: 'border-amber-400 shadow-amber-400/50',
  PR: 'border-rose-400 shadow-rose-400/40',
};
const RARITY_BG: Record<string, string> = {
  C: 'from-zinc-800', U: 'from-emerald-900/40', R: 'from-blue-900/40',
  SR: 'from-purple-900/50', UR: 'from-amber-900/50', SER: 'from-amber-900/50', PR: 'from-rose-900/40',
};
const RARITY_TEXT: Record<string, string> = {
  C: 'text-zinc-400', U: 'text-emerald-400', R: 'text-blue-400',
  SR: 'text-purple-400', UR: 'text-amber-400', SER: 'text-amber-300', PR: 'text-rose-400',
};

export const Store: React.FC = () => {
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [cardCrystals, setCardCrystals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [drawnCards, setDrawnCards] = useState<{ id: string; rarity: string; revealed: boolean }[]>([]);
  const [allDrawnPacks, setAllDrawnPacks] = useState<{ id: string; rarity: string; revealed: boolean }[][]>([]);
  const [currentPackIndex, setCurrentPackIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [pityInfo, setPityInfo] = useState({ packsSinceSR: 0, packsSinceUR: 0, totalPacks: 0 });

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setCoins(data.coins || 0);
        setCardCrystals(data.cardCrystals || 0);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleBuyPack = async (packType: 'basic' | 'prize', count: number) => {
    const singleCost = packType === 'prize' ? 20 : 10;
    const totalCost = singleCost * count;
    if (coins < totalCost) { alert('金币不足！'); return; }
    
    setBuying(`${packType}-${count}`);
    setDrawnCards([]);
    setShowResult(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/store/buy-pack`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ packType, count }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setBuying(null); return; }

      setCoins(data.newCoins);
      setCardCrystals(data.newCardCrystals);
      
      // Group cards into packs (Basic: 5, Prize: 1)
      const packSize = packType === 'prize' ? 1 : 5;
      const packs: { id: string; rarity: string; revealed: boolean }[][] = [];
      for (let i = 0; i < data.cards.length; i += packSize) {
        packs.push(data.cards.slice(i, i + packSize).map((c: any) => ({ ...c, revealed: false })));
      }
      
      setAllDrawnPacks(packs);
      setCurrentPackIndex(0);
      setDrawnCards(packs[0]);

      setPityInfo({ 
        packsSinceSR: data.packsSinceSR, 
        packsSinceUR: data.packsSinceUR, 
        totalPacks: data.totalPacks 
      });
      setShowResult(true);
    } catch (e) {
      console.error(e);
      alert('购买失败');
    } finally {
      setBuying(null);
    }
  };

  const revealCard = (index: number) => {
    setDrawnCards(prev => prev.map((c, i) => i === index ? { ...c, revealed: true } : c));
  };

  const revealAll = () => {
    setDrawnCards(prev => prev.map(c => ({ ...c, revealed: true })));
  };

  const nextPack = () => {
    if (currentPackIndex < allDrawnPacks.length - 1) {
      const nextIdx = currentPackIndex + 1;
      setCurrentPackIndex(nextIdx);
      setDrawnCards(allDrawnPacks[nextIdx]);
    } else {
      setShowResult(false);
    }
  };

  const getCardInfo = (id: string) => CARD_LIBRARY.find(c => c.id === id);

  if (loading) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="pt-20 px-8 min-h-screen bg-black text-white pb-20 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 transition-all border border-white/5 group">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1" />
            </button>
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter uppercase">Card Store</h1>
              <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">扩充你的卡牌收藏</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-900/30 to-amber-800/10 border border-amber-500/30 rounded-full px-6 py-2.5">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="text-amber-300 font-bold text-xl">{coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-900/30 to-cyan-800/10 border border-cyan-500/30 rounded-full px-6 py-2.5">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-300 font-bold text-xl">{cardCrystals.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pack Purchase Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-5xl mx-auto">
          {/* Basic Pack */}
          <div className="flex flex-col items-center gap-8">
            <motion.div
              whileHover={{ rotateY: 5, scale: 1.02 }}
              className={cn(
                "relative w-72 h-96 rounded-3xl border-4 overflow-hidden transition-all group",
                "border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.1)] hover:border-red-500 hover:shadow-[0_0_60px_rgba(220,38,38,0.3)]"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-black to-red-950/20" />
              <img src="assets/cardpack/basic.JPG" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 text-center px-6">
                {/* <ShoppingBag className="w-20 h-20 text-red-500 group-hover:scale-110 transition-transform duration-500" /> */}
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">基础包</h2>
                  <p className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">Basic Edition</p>
                </div>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
                <p className="text-xs text-zinc-400 font-bold leading-relaxed px-4">包含5张卡牌<br/>保底一张R及以上稀有度</p>
              </div>
              {buying?.startsWith('basic') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 animate-spin text-red-500 mb-4" />
                  <span className="text-xs font-black italic text-red-500 uppercase">Processing...</span>
                </div>
              )}
            </motion.div>
            
            <div className="flex gap-2 w-full max-w-[288px]">
              {[1, 10, 50].map(n => (
                <button
                  key={n}
                  onClick={() => handleBuyPack('basic', n)}
                  className="flex-1 py-4 bg-zinc-900 hover:bg-red-600 border border-white/5 hover:border-red-500 rounded-2xl font-black italic text-sm transition-all flex flex-col items-center gap-1 group"
                >
                  <span className="text-zinc-400 group-hover:text-white transition-colors">{n} 包</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">{n * 10}</span>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="text-[10px] text-zinc-600 bg-zinc-900/40 p-4 rounded-2xl border border-white/5 w-full max-w-[288px] text-center">
              <p className="font-bold uppercase tracking-widest mb-1 opacity-50 text-[8px]">Pity Status</p>
              <p>SR: <span className="text-purple-400">{10 - pityInfo.packsSinceSR}</span> UR: <span className="text-amber-400">{50 - pityInfo.packsSinceUR}</span></p>
            </div>
          </div>

          {/* Prize Pack */}
          <div className="flex flex-col items-center gap-8">
            <motion.div
              whileHover={{ rotateY: -5, scale: 1.02 }}
              className={cn(
                "relative w-72 h-96 rounded-3xl border-4 overflow-hidden transition-all group",
                "border-rose-600/30 shadow-[0_0_50px_rgba(244,63,94,0.1)] hover:border-rose-500 hover:shadow-[0_0_60px_rgba(244,63,94,0.3)]"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-rose-950/40 via-black to-rose-950/20" />
              <img src="assets/cardpack/basic.JPG" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10 text-center px-6">
                {/* <Sparkles className="w-20 h-20 text-rose-500 group-hover:scale-110 transition-transform duration-500" /> */}
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">奖品包</h2>
                  <p className="text-zinc-500 text-[10px] font-black tracking-[0.2em] uppercase">Prize Collector</p>
                </div>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-rose-600/50 to-transparent" />
                <p className="text-xs text-zinc-400 font-bold leading-relaxed px-4">包含1张卡牌<br/>必得PR稀有度奖品卡</p>
              </div>
              {buying?.startsWith('prize') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 animate-spin text-rose-500 mb-4" />
                  <span className="text-xs font-black italic text-rose-500 uppercase">Processing...</span>
                </div>
              )}
            </motion.div>

            <div className="flex gap-2 w-full max-w-[288px]">
              {[1, 10, 50].map(n => (
                <button
                  key={n}
                  onClick={() => handleBuyPack('prize', n)}
                  className="flex-1 py-4 bg-zinc-900 hover:bg-rose-600 border border-white/5 hover:border-rose-500 rounded-2xl font-black italic text-sm transition-all flex flex-col items-center gap-1 group"
                >
                  <span className="text-zinc-400 group-hover:text-white transition-colors">{n} 包</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">{n * 20}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[10px] text-zinc-600 bg-zinc-900/40 p-4 rounded-2xl border border-white/5 w-full max-w-[288px] text-center h-[58px] flex items-center justify-center uppercase font-black italic tracking-widest opacity-40">
              Top Collector Rewards
            </div>
          </div>
        </div>

        {/* Card Opening Portal */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 overflow-hidden"
            >
              {/* Portal Background Glow */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-600/20 blur-[120px] rounded-full animate-pulse" />
              </div>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-7xl flex-1 flex flex-col relative z-10"
              >
                {/* Result Info */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                       <Sparkles className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black italic uppercase tracking-tighter">开包成果 Drawn Result</h2>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        第 {currentPackIndex + 1} / {allDrawnPacks.length} 包 • 点击卡牌以揭开
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={revealAll}
                    className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black italic text-sm transition-all uppercase"
                  >
                    全部揭开 Reveal All
                  </button>
                </div>

                {/* Cards Grid - Centered items with larger size */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-10 p-4 max-w-6xl mx-auto">
                    {drawnCards.map((drawn, i) => {
                      const card = getCardInfo(drawn.id);
                      return (
                        <motion.div
                          key={i}
                          layout
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ 
                            scale: drawn.revealed ? 1.05 : 1, 
                            opacity: 1,
                            y: drawn.revealed ? -10 : 0
                          }}
                          transition={{ 
                            type: 'spring', 
                            damping: 15, 
                            stiffness: 100,
                            delay: i * 0.05 
                          }}
                          className="relative w-56 sm:w-64 aspect-[3/4] perspective-1000 group cursor-pointer"
                          onClick={() => revealCard(i)}
                        >
                          {/* Hover Halo */}
                          {!drawn.revealed && (
                            <div className="absolute -inset-2 bg-red-600/0 group-hover:bg-red-600/30 blur-xl rounded-2xl transition-all duration-300 scale-90 group-hover:scale-100" />
                          )}
                          
                          <motion.div
                            animate={{ rotateY: drawn.revealed ? 180 : 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                            className="w-full h-full relative transform-style-3d preserve-3d"
                          >
                            {/* Card Back (Face Down) */}
                            <div className={cn(
                              "absolute inset-0 backface-hidden rounded-2xl border-2 border-white/10 bg-zinc-900 group-hover:border-red-500/50 flex flex-col items-center justify-center p-4 transition-colors",
                              "shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                            )}>
                              <img src="assets/card_bg/default_card_bg.jpg" className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-2xl grayscale" />
                              <div className="relative z-10 flex flex-col items-center gap-2">
                                <ShoppingBag className="w-10 h-10 text-zinc-700 group-hover:text-red-500 animation-pulse" />
                                <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Pack Card</span>
                              </div>
                            </div>

                            {/* Card Front (Revealed) */}
                            <div className={cn(
                              "absolute inset-0 backface-hidden rotateY-180 rounded-2xl border-2 bg-zinc-900 overflow-hidden",
                              RARITY_COLORS[drawn.rarity] || "border-zinc-800",
                              drawn.revealed && "shadow-[0_0_40px_rgba(255,255,255,0.1)] ring-2 ring-white/10",
                              "shadow-[0_15px_40px_rgba(0,0,0,0.7)]"
                            )}>
                              {card ? (
                                <>
                                  <img src={card.imageUrl} className="w-full h-full object-cover" />
                                  <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", RARITY_BG[drawn.rarity])} />
                                  <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                                    <p className="text-[9px] font-black truncate text-white uppercase italic tracking-tighter">{card.fullName}</p>
                                    <span className={cn("text-[9px] font-black", RARITY_TEXT[drawn.rarity])}>{drawn.rarity}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black">?</div>
                              )}
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Confirm Button */}
                <div className="mt-12 text-center pb-8 border-t border-white/5 pt-8">
                  <button
                    onClick={nextPack}
                    className={cn(
                      "px-20 py-5 rounded-full text-xl font-black italic tracking-tighter uppercase transition-all hover:scale-110 active:scale-95",
                      drawnCards.every(c => c.revealed) 
                        ? "bg-red-600 shadow-[0_0_50px_rgba(220,38,38,0.4)] text-white" 
                        : "bg-zinc-900 text-zinc-500 cursor-not-allowed"
                    )}
                  >
                    {currentPackIndex < allDrawnPacks.length - 1 ? "下一包 Next Pack" : "确认 Confirm"}
                  </button>
                  <p className="text-[10px] text-zinc-600 mt-4 font-bold uppercase tracking-widest transition-opacity duration-300">
                    {drawnCards.every(c => c.revealed) 
                      ? (currentPackIndex < allDrawnPacks.length - 1 ? `已揭开第 ${currentPackIndex + 1} 包` : "所有卡牌已入库") 
                      : "请先揭开本包所有卡牌"}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .backface-hidden { backface-visibility: hidden; }
        .transform-style-3d { transform-style: preserve-3d; }
        .preserve-3d { transform-style: preserve-3d; }
        .rotateY-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};
