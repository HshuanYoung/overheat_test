import { getAuthUser, removeAuthToken, removeAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, LayoutGrid, BookOpen, Coins, Sparkles } from 'lucide-react';

export const TopBar: React.FC<{ onOpenRulebook: () => void }> = ({ onOpenRulebook }) => {
  const user = getAuthUser();
  const [coins, setCoins] = useState<number | null>(null);
  const [crystals, setCrystals] = useState<number | null>(null);

  useEffect(() => {
    const loadAssets = async () => {
      if (!user) return;
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const token = localStorage.getItem('token');
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setCoins(data.coins ?? 0);
        setCrystals(data.cardCrystals ?? 0);
      } catch (e) { /* ignore */ }
    };
    loadAssets();
    // Refresh every 10s
    const interval = setInterval(loadAssets, 10000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <nav className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
      <Link to="/" className="flex items-center gap-3">
        <img src="/assets/logo.jpg" alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-red-500/30" />
        <span className="text-xl font-black italic text-red-600 tracking-tighter">神蚀创痕</span>
      </Link>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {/* Coins */}
          {coins !== null && (
            <Link to="/store" className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-500/20 rounded-full px-4 py-1.5 hover:border-amber-500/40 transition-colors">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">{coins.toLocaleString()}</span>
            </Link>
          )}
          {/* Crystals */}
          {crystals !== null && (
            <Link to="/collection?tab=CARDS" className="flex items-center gap-1.5 bg-cyan-900/20 border border-cyan-500/20 rounded-full px-4 py-1.5 hover:border-cyan-500/40 transition-colors">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-300 font-bold text-sm">{crystals.toLocaleString()}</span>
            </Link>
          )}
        </div>

        <Link to="/deck-builder" className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider">
          <LayoutGrid className="w-4 h-4" />
          我的卡组
        </Link>
        <button 
          onClick={onOpenRulebook}
          className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider"
        >
          <BookOpen className="w-4 h-4" />
          简易规则书
        </button>
        <Link to="/profile" className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center overflow-hidden border border-white/10">
            {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <img src="assets/icons/myself.JPG" className="w-full h-full object-cover" />}
          </div>
          个人信息
        </Link>
      </div>
    </nav>
  );
};
