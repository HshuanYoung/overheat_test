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
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-20 right-4 z-[49] w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              <Link
                to="/deck-builder"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 text-zinc-200 p-3 hover:bg-white/10 hover:text-white hover:translate-x-1 rounded-xl transition-all font-bold tracking-wider"
              >
                <LayoutGrid className="w-5 h-5 text-red-400" />
                <span>我的卡组</span>
              </Link>
              
              <button
                onClick={() => {
                  onOpenRulebook();
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-3 text-zinc-200 p-3 hover:bg-white/10 hover:text-white hover:translate-x-1 rounded-xl transition-all font-bold tracking-wider text-left"
              >
                <BookOpen className="w-5 h-5 text-blue-400" />
                <span>简易规则书</span>
              </button>

              <Link
                to="/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 text-zinc-200 p-3 hover:bg-white/10 hover:text-white hover:translate-x-1 rounded-xl transition-all font-bold tracking-wider"
              >
                <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                  {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <img src="assets/icons/myself.JPG" className="w-full h-full object-cover" />}
                </div>
                <span>个人信息</span>
              </Link>

              <div className="h-px w-full bg-white/5 my-2" />

              <div className="flex items-center justify-between gap-3 text-zinc-200 p-3 bg-black/20 rounded-xl font-bold tracking-wider">
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>我的金币</span>
                </div>
                <span className="text-amber-300 text-sm">{coins?.toLocaleString() ?? 0}</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-zinc-200 p-3 bg-black/20 rounded-xl font-bold tracking-wider">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>我的卡晶</span>
                </div>
                <span className="text-cyan-300 text-sm">{crystals?.toLocaleString() ?? 0}</span>
              </div>

              <div className="h-px w-full bg-white/5 my-2" />

              <button
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 text-zinc-400 p-3 hover:text-white hover:bg-white/10 hover:translate-x-1 rounded-xl transition-all font-bold tracking-wider text-left"
              >
                <Undo2 className="w-5 h-5" />
                <span>返回</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
