import { getAuthUser, removeAuthToken, removeAuthUser } from '../socket';
import React from 'react';
import { Link } from 'react-router-dom';
import { User, LayoutGrid, BookOpen } from 'lucide-react';

export const TopBar: React.FC<{ onOpenRulebook: () => void }> = ({ onOpenRulebook }) => {
  const user = getAuthUser();

  return (
    <nav className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-50">
      <Link to="/" className="flex items-center gap-3">
        <img src="/assets/logo.jpg" alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-red-500/30" />
        <span className="text-xl font-black italic text-red-600 tracking-tighter">神蚀创痕</span>
      </Link>

      <div className="flex items-center gap-8">
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
            {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white" />}
          </div>
          个人信息
        </Link>
      </div>
    </nav>
  );
};
