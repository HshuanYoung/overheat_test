import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, LayoutGrid, Users, Heart, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { CARD_LIBRARY } from '../data/cards';
import { Card } from '../types/game';

const RAY_CARDS = [
  { id: 'fav_card', name: '默认雷亚卡', url: '/assets/fav_card/fav_card.jpg' },
  { id: 'fav_card_1', name: '雷亚卡 01', url: '/assets/fav_card/fav_card_1.jpg' },
  { id: 'fav_card_2', name: '雷亚卡 02', url: '/assets/fav_card/fav_card_2.jpg' },
  { id: 'fav_card_3', name: '雷亚卡 03', url: '/assets/fav_card/fav_card_3.jpg' },
  { id: 'fav_card_4', name: '雷亚卡 04', url: '/assets/fav_card/fav_card_4.jpg' },
];

export const Home: React.FC = () => {
  const [favoriteCard, setFavoriteCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = getAuthUser();

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setFavoriteCard(RAY_CARDS[0]);
        setLoading(false);
        return;
      }
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
        const data = await res.json();
        if (data.favoriteCardId) {
            const card = RAY_CARDS.find(c => c.id === data.favoriteCardId);
            setFavoriteCard(card || RAY_CARDS[0]);
        } else {
            setFavoriteCard(RAY_CARDS[0]);
        }
      } catch (e) {
        console.error(e);
        setFavoriteCard(RAY_CARDS[0]);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black flex items-center">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-40 grayscale-[0.2] hover:grayscale-0 transition-all duration-1000"
        style={{
          backgroundImage: `url("${favoriteCard?.url || '/assets/fav_card/fav_card.jpg'}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10" />

      {/* Content */}
      <div className="relative z-20 pl-16 flex flex-col gap-12 max-w-2xl">
        <div className="flex flex-col gap-6">
          <MenuButton title="联机对战" icon={<Play className="w-6 h-6" />} description="寻找对手进行在线联机对战" to="/battle" color="bg-zinc-900/60" />
          <MenuButton title="好友约战" icon={<Users className="w-6 h-6" />} description="与你的好友进行私人对战" to="/friend-match" color="bg-zinc-900/60" />
          <MenuButton title="卡组构筑" icon={<LayoutGrid className="w-6 h-6" />} description="管理和编辑你的战斗卡组" to="/deck-builder" color="bg-zinc-900/60" />
        </div>
      </div>

      {/* Bottom Right Info */}
      <div className="absolute bottom-12 right-12 z-20 text-right">
        <p className="text-zinc-500 text-xs italic uppercase tracking-widest mb-2">"在神蚀的创痕中，寻找最后的希望。"</p>
        <div className="flex items-center justify-end gap-2 text-red-600">
          <Heart className={cn("w-4 h-4", favoriteCard ? "fill-red-600" : "")} />
          <span className="text-xs font-black uppercase tracking-tighter">
            {loading ? "Loading..." : favoriteCard ? `Ray Card: ${favoriteCard.name}` : "No Ray Card Set"}
          </span>
        </div>
      </div>
    </div>
  );
};

const MenuButton = ({ title, icon, description, to, color }: any) => (
  <Link to={to}>
    <motion.div 
      whileHover={{ x: 20, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "p-6 rounded-r-full border-l-4 border-red-600 cursor-pointer w-[400px] transition-all hover:bg-red-600/20 group",
        color
      )}
    >
      <div className="flex items-center gap-6">
        <div className="p-4 rounded-full bg-black/50 group-hover:bg-red-600 transition-colors">{icon}</div>
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter">{title}</h2>
          <p className="text-zinc-400 text-xs uppercase tracking-wider">{description}</p>
        </div>
      </div>
    </motion.div>
  </Link>
);
