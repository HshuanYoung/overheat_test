import { getAuthUser, removeAuthToken, removeAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, LayoutGrid, BookOpen, Coins, Sparkles, Lock, Flag, AlertTriangle, X, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const TopBar: React.FC<{ onOpenRulebook: () => void }> = ({ onOpenRulebook }) => {
  const user = getAuthUser();
  const location = useLocation();
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
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
    // Refresh every 10s
    const interval = setInterval(loadAssets, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleConfirmSurrender = () => {
    window.dispatchEvent(new CustomEvent('game:surrender'));
    setShowSurrenderConfirm(false);
  };

  return (
    <>
      <nav className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center px-6 fixed top-0 left-0 right-0 z-50">
        {/* Left Section: Logo */}
        {/* <div className={cn("flex-1 items-center justify-start", isInGame ? "hidden lg:flex" : "flex")}>
          <Link 
            to={isInGame ? '#' : "/"} 
            className={cn(
              "flex items-center gap-3 transition-all",
              isInGame && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <img src="/assets/logo.jpg" alt="游戏标志" className="w-10 h-10 rounded-lg object-cover border border-red-500/30" />
            <span className="text-xl font-black italic text-red-600 tracking-tighter">神蚀创痕</span>
          </Link>
        </div> */}

        {/* Middle Section: Surrender Button */}
        {isInGame && (
          <div className="flex-1 flex items-center justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSurrenderConfirm(true)}
              className="flex items-center gap-2 px-6 py-2 bg-red-950/30 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded-full text-red-500 hover:text-white transition-all group shadow-[0_0_20px_rgba(220,38,38,0.1)]"
            >
              <Flag className="w-4 h-4 group-hover:animate-bounce" />
              <span className="text-xs font-black tracking-[0.2em] italic">投降</span>
            </motion.button>
          </div>
        )}

        {/* Right Section: Navigation (Desktop) */}
        <div className="hidden lg:flex flex-1 items-center justify-end gap-6">
          <div className="flex items-center gap-2">
            {/* Coins */}
            {coins !== null && (
              <Link
                to={isInGame ? '#' : "/store"}
                className={cn(
                  "flex items-center gap-1.5 bg-amber-900/20 border border-amber-500/20 rounded-full px-4 py-1.5 hover:border-amber-500/40 transition-colors",
                  isInGame && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-bold text-sm">{coins.toLocaleString()}</span>
              </Link>
            )}
            {/* Crystals */}
            {crystals !== null && (
              <Link
                to={isInGame ? '#' : "/collection?tab=CARDS"}
                className={cn(
                  "flex items-center gap-1.5 bg-cyan-900/20 border border-cyan-500/20 rounded-full px-4 py-1.5 hover:border-cyan-500/40 transition-colors",
                  isInGame && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-sm">{crystals.toLocaleString()}</span>
              </Link>
            )}
          </div>

          <Link
            to={isInGame ? '#' : "/deck-builder"}
            className={cn(
              "flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider",
              isInGame && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            {isInGame ? <Lock className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            我的卡组
          </Link>
          <button
            onClick={onOpenRulebook}
            className="flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider"
          >
            <BookOpen className="w-4 h-4" />
            简易规则书
          </button>
          <Link
            to={isInGame ? '#' : "/profile"}
            className={cn(
              "flex items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors text-sm font-bold uppercase tracking-wider",
              isInGame && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center overflow-hidden border border-white/10">
              {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <img src="assets/icons/myself.JPG" className="w-full h-full object-cover" />}
            </div>
            个人信息
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex lg:hidden flex-1 justify-end items-center gap-4">
          {!isInGame && (
            <div className="flex items-center gap-2 mr-2">
              {coins !== null && (
                <div className="flex items-center gap-1 bg-amber-900/20 border border-amber-500/20 rounded-full px-3 py-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300 font-bold text-xs">{coins.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
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

      {/* Surrender Confirmation Modal */}
      <AnimatePresence>
        {showSurrenderConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSurrenderConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-red-500/30 rounded-3xl p-8 overflow-hidden"
            >
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Flag className="w-32 h-32 rotate-12" />
              </div>

              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>

                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">确定要投降吗？</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    投降后将直接判定为负且无法撤回。<br />你确定要退出当前的战斗吗？
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3 mt-4">
                  <button
                    onClick={handleConfirmSurrender}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black italic uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                  >
                    确认投降
                  </button>
                  <button
                    onClick={() => setShowSurrenderConfirm(false)}
                    className="w-full py-4 bg-transparent border border-white/10 hover:border-white/20 text-white/50 hover:text-white font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    继续战斗
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
