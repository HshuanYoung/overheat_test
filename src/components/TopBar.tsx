import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, BookOpen, Coins, Sparkles, X, Menu, LogOut, Info, Undo2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const TopBar: React.FC<{ onOpenRulebook: () => void }> = ({ onOpenRulebook }) => {
  const user = getAuthUser();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [coins, setCoins] = useState<number | null>(null);
  const [crystals, setCrystals] = useState<number | null>(null);

  const isInGame = location.pathname.startsWith('/battle/');

  useEffect(() => {
    const loadAssets = async () => {
      if (!user) return;
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
        const token = localStorage.getItem('token');
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setCoins(data.coins ?? 0);
        setCrystals(data.cardCrystals ?? 0);
      } catch (e) { /* ignore */ }
    };
    loadAssets();
    const interval = setInterval(loadAssets, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isInGame) return null;

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={isMenuOpen}
          className="p-3 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/30 hover:bg-zinc-800/90 transition-all shadow-xl"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl flex flex-col gap-8 relative"
            >
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-red-600/10 blur-[120px] rounded-full" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full" />

              <div className="flex flex-col items-center gap-2 mb-8 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center shadow-2xl mb-4">
                  <Menu className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">游戏菜单</h2>
                <div className="h-1 w-24 bg-red-600" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                <Link
                  to="/deck-builder"
                  onClick={() => setIsMenuOpen(false)}
                  className="group flex items-center gap-6 p-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1 shadow-xl"
                >
                  <div className="p-4 rounded-2xl bg-red-500/10 group-hover:bg-red-500 transition-colors">
                    <LayoutGrid className="w-8 h-8 text-red-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tight">我的卡组</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">管理你的战斗套牌</p>
                  </div>
                </Link>

                <button
                  onClick={() => {
                    onOpenRulebook();
                    setIsMenuOpen(false);
                  }}
                  className="group flex items-center gap-6 p-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1 shadow-xl text-left"
                >
                  <div className="p-4 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500 transition-colors">
                    <BookOpen className="w-8 h-8 text-blue-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tight">简易规则书</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">查看游戏规则与机制</p>
                  </div>
                </button>

                <Link
                  to="/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className="group flex items-center gap-6 p-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all hover:-translate-y-1 shadow-xl"
                >
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-red-500 transition-colors">
                    {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <img src="assets/icons/myself.JPG" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tight">个人信息</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">查看你的战绩与资产</p>
                  </div>
                </Link>

                <div className="grid grid-rows-2 gap-4">
                  <div className="flex items-center justify-between px-8 bg-black/40 rounded-[2rem] border border-white/5 shadow-inner">
                    <div className="flex items-center gap-4">
                      <Coins className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-black text-white/60 uppercase tracking-widest">金币</span>
                    </div>
                    <span className="text-xl font-black text-amber-400 italic">{coins?.toLocaleString() ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between px-8 bg-black/40 rounded-[2rem] border border-white/5 shadow-inner">
                    <div className="flex items-center gap-4">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      <span className="text-xs font-black text-white/60 uppercase tracking-widest">卡晶</span>
                    </div>
                    <span className="text-xl font-black text-cyan-400 italic">{crystals?.toLocaleString() ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-12">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="group px-12 py-5 bg-white text-black rounded-3xl font-black uppercase italic tracking-widest transition-all hover:bg-zinc-200 flex items-center gap-4 shadow-[0_20px_50px_rgba(255,255,255,0.1)]"
                >
                  <X className="w-6 h-6" />
                  关闭菜单
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
