import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { User, Settings, Image, Layout, Palette, Heart, Save, Loader2, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { CARD_LIBRARY } from '../data/cards';
import { CardComponent } from './Card';
import { Card as CardType } from '../types/game';

const RAY_CARDS = [
  { id: 'fav_card', name: '默认雷亚卡', url: '/assets/fav_card/fav_card.jpg' },
  { id: 'fav_card_1', name: '雷亚卡 01', url: '/assets/fav_card/fav_card_1.jpg' },
  { id: 'fav_card_2', name: '雷亚卡 02', url: '/assets/fav_card/fav_card_2.jpg' },
  { id: 'fav_card_3', name: '雷亚卡 03', url: '/assets/fav_card/fav_card_3.jpg' },
  { id: 'fav_card_4', name: '雷亚卡 04', url: '/assets/fav_card/fav_card_4.jpg' },
];

export const Profile: React.FC = () => {
  const user = getAuthUser();
  const [nickname, setNickname] = useState(user?.displayName || 'User');
  const [favoriteCardId, setFavoriteCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const token = localStorage.getItem('token');
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        setFavoriteCardId(data.favoriteCardId || null);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      await fetch(`${BACKEND_URL}/api/user/profile`, { 
          method: 'PUT', 
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ favoriteCardId }) 
      });
      alert('个人信息已保存');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const favoriteCard = RAY_CARDS.find(c => c.id === favoriteCardId);

  if (loading) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="pt-24 px-12 min-h-screen bg-black text-white pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-8">
            <div className="w-32 h-32 rounded-full bg-red-600 flex items-center justify-center overflow-hidden border-4 border-zinc-800 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
              {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <User className="w-16 h-16 text-white" />}
            </div>
            <div>
              <input 
                className="text-4xl font-black italic tracking-tighter mb-2 bg-transparent border-b-2 border-transparent focus:border-red-600 focus:outline-none transition-all w-full"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
              <p className="text-zinc-500 uppercase tracking-widest text-xs">UID: {user?.uid?.slice(0, 8) || user?.uid}</p>
            </div>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-full font-black italic tracking-tighter flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存修改
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div onClick={() => setIsSelectingCard(true)}>
            <SettingCard 
              title="设置雷亚卡" 
              icon={<Heart className="w-6 h-6" />} 
              description={favoriteCard ? `当前: ${favoriteCard.name}` : "从 assets/fav_card 中选择你的雷亚卡"} 
            />
          </div>
          <SettingCard 
            title="设置背景" 
            icon={<Image className="w-6 h-6" />} 
            description="自定义你的主界面背景图片" 
          />
          <SettingCard 
            title="设置卡背图案" 
            icon={<Layout className="w-6 h-6" />} 
            description="在对战中展示你的个性化卡背" 
          />
          <SettingCard 
            title="偏好设置" 
            icon={<Settings className="w-6 h-6" />} 
            description="管理游戏音效、画面等其他设置" 
          />
        </div>

        {favoriteCard && (
          <div className="mt-16 p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-8 italic">当前展示雷亚卡</h3>
            <div className="w-full max-w-lg aspect-video rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl">
              <img src={favoriteCard.url} className="w-full h-full object-cover" />
            </div>
            <p className="mt-4 text-red-500 font-bold italic">{favoriteCard.name}</p>
          </div>
        )}
      </div>

      {/* Card Selection Modal */}
      <AnimatePresence>
        {isSelectingCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-2xl font-black italic tracking-tighter">选择雷亚卡</h2>
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-red-600 transition-all"
                      placeholder="搜索雷亚卡..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <button onClick={() => setIsSelectingCard(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {RAY_CARDS.filter(c => c.name.includes(searchTerm)).map(card => (
                  <div 
                    key={card.id} 
                    onClick={() => { setFavoriteCardId(card.id); setIsSelectingCard(false); }}
                    className={cn(
                      "cursor-pointer transition-all hover:scale-[1.02] group relative rounded-2xl overflow-hidden border-2",
                      favoriteCardId === card.id ? "border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]" : "border-zinc-800 hover:border-zinc-600"
                    )}
                  >
                    <div className="aspect-video">
                      <img src={card.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                      <p className="font-black italic tracking-tighter text-lg">{card.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingCard = ({ title, icon, description }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-red-500/50 transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-4 mb-4">
      <div className="p-3 rounded-xl bg-black group-hover:bg-red-600 transition-colors">{icon}</div>
      <h2 className="text-xl font-bold italic tracking-tighter">{title}</h2>
    </div>
    <p className="text-zinc-500 text-sm">{description}</p>
  </motion.div>
);
