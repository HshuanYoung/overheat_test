import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Swords, Bot, ShoppingBag, Library, Play, Users, Layout, CreditCard, Image as ImageIcon, Plus, GalleryHorizontalEnd } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RAY_CARDS } from '../data/customization';
import { readJsonResponse } from '../lib/http';

export const Home: React.FC = () => {
  const [favoriteCard, setFavoriteCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBattleMenu, setShowBattleMenu] = useState(false);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  const navigate = useNavigate();
  const user = getAuthUser();

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setFavoriteCard(RAY_CARDS[0]);
        setLoading(false);
        return;
      }
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
        const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await readJsonResponse(res);
        if (data?.favoriteCardId) {
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
      <div
        className="absolute inset-0 z-0 opacity-30 transition-all duration-1000"
        style={{
          backgroundImage: `url("${favoriteCard?.url || '/assets/fav_card/fav_card.jpg'}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(2px)',
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/40 z-10" />

      <div className="relative z-20 px-6 md:pl-16 flex flex-col gap-6 w-full max-w-2xl">
        <div>
          <motion.div
            whileHover={{ x: 16, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowBattleMenu(!showBattleMenu)}
            className="p-5 rounded-r-full border-l-4 border-red-600 cursor-pointer w-full max-w-[420px] bg-zinc-900/60 hover:bg-red-600/20 group transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="p-3.5 rounded-full bg-black/50 group-hover:bg-red-600 transition-colors">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter">对战模式</h2>
                <p className="text-zinc-400 text-xs tracking-wider">选择你的对战方式</p>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {showBattleMenu && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden ml-8"
              >
                <div className="pt-3 flex flex-col gap-2">
                  <SubMenuButton title="匹配模式" desc="随机匹配在线玩家" icon={<Play className="w-4 h-4" />} to="/battle" />
                  <SubMenuButton title="好友约战" desc="邀请好友进行对战" icon={<Users className="w-4 h-4" />} to="/friend-match" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <MenuButton title="练习模式" icon={<Bot className="w-6 h-6" />} description="与人机进行练习对战" to="/practice" />

        <MenuButton title="卡牌商店" icon={<ShoppingBag className="w-6 h-6" />} description="购买卡包并扩充收藏" to="/store" />

        <div>
          <motion.div
            whileHover={{ x: 16, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCollectionMenu(!showCollectionMenu)}
            className="p-5 rounded-r-full border-l-4 border-red-600 cursor-pointer w-full max-w-[420px] bg-zinc-900/60 hover:bg-red-600/20 group transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="p-3.5 rounded-full bg-black/50 group-hover:bg-red-600 transition-colors">
                <Library className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter">我的收藏</h2>
                <p className="text-zinc-400 text-xs tracking-wider">管理卡组、卡牌与卡背</p>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {showCollectionMenu && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden ml-8"
              >
                <div className="pt-3 flex flex-col gap-2">
                  <SubMenuButton title="我的卡组" desc="管理及编辑你的卡组" icon={<Layout className="w-4 h-4" />} onClick={() => navigate('/collection?tab=DECKS')} />
                  <SubMenuButton title="所有卡牌" desc="查看及筛选拥有的卡牌" icon={<CreditCard className="w-4 h-4" />} onClick={() => navigate('/collection?tab=CARDS')} />
                  <SubMenuButton title="卡背样式" desc="自定义你的个性化卡背" icon={<ImageIcon className="w-4 h-4" />} onClick={() => navigate('/collection?tab=BACKS')} />
                  <SubMenuButton title="雷亚收藏" desc="管理及展示雷亚卡背景" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/collection?tab=RAY_CARDS')} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <MenuButton title="套牌广场" icon={<GalleryHorizontalEnd className="w-6 h-6" />} description="发布、预览全服卡组" to="/deck-square" />
      </div>

      <div className="absolute bottom-12 right-6 md:right-12 z-20 text-right">
        <p className="text-zinc-500 text-[10px] md:text-xs italic tracking-widest mb-2">“在神蚀的创痕中，寻找最后的希望。”</p>
      </div>
    </div>
  );
};

const MenuButton = ({ title, icon, description, to }: any) => (
  <Link to={to}>
    <motion.div
      whileHover={{ x: 16, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="p-5 rounded-r-full border-l-4 border-red-600 cursor-pointer w-full max-w-[420px] bg-zinc-900/60 hover:bg-red-600/20 group transition-all"
    >
      <div className="flex items-center gap-5">
        <div className="p-3.5 rounded-full bg-black/50 group-hover:bg-red-600 transition-colors">{icon}</div>
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter">{title}</h2>
          <p className="text-zinc-400 text-xs tracking-wider">{description}</p>
        </div>
      </div>
    </motion.div>
  </Link>
);

const SubMenuButton = ({ title, desc, icon, to, onClick }: any) => {
  const content = (
    <motion.div
      whileHover={{ x: 10, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="p-3 pl-6 rounded-r-2xl border-l-2 border-red-600/50 cursor-pointer w-full max-w-[360px] bg-zinc-900/40 hover:bg-red-600/10 group transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-black/40 group-hover:bg-red-600/80 transition-colors">{icon}</div>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-zinc-500 text-[10px]">{desc}</p>
        </div>
      </div>
    </motion.div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return <div onClick={onClick}>{content}</div>;
};
