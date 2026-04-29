import { getAuthUser } from '../socket';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Trash2, Plus, Search, Loader2, Copy, Edit3, X, Sparkles, ArrowLeft, Shuffle, ListFilter, Zap, Shield, Check } from 'lucide-react';
import { FACTIONS } from '../data/factions';
import { Card as CardType, Deck } from '../types/game';
import { CardComponent } from './Card';
import { cn, getCardImageUrl, getCardTypeLabel } from '../lib/utils';
import { CARD_BACKS } from '../data/customization';
import { TriggerLocation } from '../types/game';
import { useCardCatalog } from '../hooks/useCardCatalog';
import { LoadingOverlay } from './LoadingOverlay';
import { KeywordBadges } from './KeywordBadges';
import { readJsonResponse } from '../lib/http';

const INITIAL_VISIBLE_CARD_COUNT = 48;

const tokenizeCardPackage = (value?: string | null) =>
  (value || '')
    .toUpperCase()
    .replace(/[，、]/g, ',')
    .split(/[,\s|/]+/)
    .map(token => token.trim())
    .filter(Boolean);

const matchesCardPackageFilter = (cardPackage: string | undefined, query: string) => {
  const queryTokens = tokenizeCardPackage(query);
  if (queryTokens.length === 0) {
    return true;
  }

  const packageTokens = tokenizeCardPackage(cardPackage);
  return queryTokens.every(token => packageTokens.some(pkg => pkg.includes(token)));
};

export const DeckBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deck, setDeck] = useState<CardType[]>([]);
  const [deckName, setDeckName] = useState('我的新卡组');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [zoomedCard, setZoomedCard] = useState<CardType | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collection, setCollection] = useState<Record<string, number>>({});
  const [cardCrystals, setCardCrystals] = useState(0);
  const [favoriteBackId, setFavoriteBackId] = useState('default');
  const [actionLoading, setActionLoading] = useState(false);
  const [addSuccessToast, setAddSuccessToast] = useState<{ cardName: string; count: number } | null>(null);
  const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_VISIBLE_CARD_COUNT);
  const [filters, setFilters] = useState({
    ac: '',
    damage: '',
    power: '',
    cardPackage: '',
    color: 'ALL',
    faction: 'ALL',
    rarity: 'ALL',
    ownership: 'ALL' // ALL, OWNED, NOT_OWNED
  });
  const [showDecksMobile, setShowDecksMobile] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false); // Changed from showLibraryMobile
  const deferredSearchTerm = useDeferredValue(searchTerm.trim());
  const {
    cards: cardLibrary,
    getCardByReference,
    loading: cardsLoading
  } = useCardCatalog({ includeEffects: false });

  const CRYSTAL_VALUES: Record<string, { decompose: number, produce: number }> = {
    C: { decompose: 1, produce: 5 },
    U: { decompose: 1, produce: 5 },
    R: { decompose: 5, produce: 20 },
    SR: { decompose: 20, produce: 80 },
    UR: { decompose: 100, produce: 400 },
    SER: { decompose: 400, produce: 1600 },
    PR: { decompose: 100, produce: 400 },
  };

  useEffect(() => {
    loadDecks();
    loadCollection();
    loadProfile();
  }, []);

  useEffect(() => {
    if (!cardLibrary.length) {
      return;
    }

    const deckIdFromUrl = searchParams.get('id');
    if (!deckIdFromUrl) {
      return;
    }

    const targetDeck = myDecks.find(d => d.id === deckIdFromUrl);
    if (targetDeck && selectedDeckId !== targetDeck.id) {
      loadDeckToEditor(targetDeck);
    }
  }, [cardLibrary, myDecks, searchParams, selectedDeckId]);

  const loadCollection = async () => {
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/collection`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setCollection(data.collection || {});
    } catch (e) {
      console.error('Failed to load collection:', e);
    }
  };

  const loadProfile = async () => {
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await readJsonResponse(res);
      setCardCrystals(data?.cardCrystals || 0);
      setFavoriteBackId(data?.favoriteBackId || 'default');
    } catch (e) { console.error(e); }
  };

  const handleDecompose = async (cardId: string) => {
    setActionLoading(true);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/decompose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ cardId })
      });
      const data = await res.json();
      if (data.success) {
        setCardCrystals(data.newCardCrystals);
        setCollection(prev => {
          const next = { ...prev };
          if (next[cardId] > 1) next[cardId]--;
          else delete next[cardId];
          return next;
        });
      } else {
        alert(data.error || '分解失败');
      }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  const handleCraft = async (cardId: string) => {
    const card = getCardByReference(cardId);
    if (!card) return;
    const cost = CRYSTAL_VALUES[card.rarity]?.produce || 0;
    if (cardCrystals < cost) { alert('卡晶不足'); return; }

    setActionLoading(true);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/craft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ cardId })
      });
      const data = await res.json();
      if (data.success) {
        setCardCrystals(data.newCardCrystals);
        setCollection(prev => ({
          ...prev,
          [cardId]: (prev[cardId] || 0) + 1
        }));
      } else {
        alert(data.error || '制作失败');
      }
    } catch (e) { console.error(e); }
    setActionLoading(false);
  };

  const loadDecks = async () => {
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(BACKEND_URL + '/api/user/decks', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      const decks: Deck[] = data.decks || [];
      setMyDecks(decks);
    } catch (e) {
      console.error('Failed to load decks:', e);
    }
  };

  const loadDeckToEditor = (savedDeck: Deck) => {
    const cards = savedDeck.cards.map(uid => getCardByReference(uid)).filter((c): c is CardType => !!c);

    setDeck(cards);
    setDeckName(savedDeck.name);
    setSelectedDeckId(savedDeck.id);
  };

  const handleSave = async () => {
    if (!getAuthUser()) return;
    setSaving(true);
    try {
      const deckData = {
        userId: getAuthUser().uid,
        name: deckName,
        cards: deck.map(c => c.uniqueId),
        isFavorite: false,
        updatedAt: Date.now()
      };

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
      const token = localStorage.getItem('token');

      if (selectedDeckId) {
        await fetch(`${BACKEND_URL}/api/user/decks/${selectedDeckId}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(deckData)
        });
      } else {
        const res = await fetch(`${BACKEND_URL}/api/user/decks`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(deckData)
        });
        const data = await res.json();
        setSelectedDeckId(data.id);
        setSearchParams({ id: data.id });
      }
      loadDecks();
    } catch (e) {
      console.error('Failed to save deck:', e);
    } finally {
      setSaving(false);
    }
  };

  const createNewDeck = () => {
    setDeck([]);
    setDeckName('新卡组');
    setSelectedDeckId(null);
    setSearchParams({});
  };

  const deleteDeck = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      await fetch(`${BACKEND_URL}/api/user/decks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (selectedDeckId === id) createNewDeck();
      setConfirmDeleteId(null);
      loadDecks();
    } catch (e) {
      console.error('Failed to delete deck:', e);
    }
  };

  const copyDeck = async (savedDeck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      await fetch(`${BACKEND_URL}/api/user/decks/${savedDeck.id}/copy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadDecks();
    } catch (e) {
      console.error('Failed to copy deck:', e);
    }
  };

  const renameDeck = async (id: string) => {
    if (!getAuthUser() || !newName.trim()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    const token = localStorage.getItem('token');
    try {
      await fetch(`${BACKEND_URL}/api/user/decks/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      setIsRenaming(null);
      if (selectedDeckId === id) setDeckName(newName);
      loadDecks();
    } catch (e) {
      console.error('Failed to rename deck:', e);
    }
  };

  const addToDeck = (card: CardType) => {
    // Count per card ID (not uniqueId) for limit check
    const count = deckBaseCounts[card.id] || 0;

    if (count < 4 && deck.length < 50) {
      if (card.godMark && godMarkCount >= 10) {
        alert('卡组中带有神蚀标记的卡牌不能超过10张！');
        return;
      }

      const ownedQty = collection[card.uniqueId] || collection[card.id] || 0;
      if (ownedQty <= count) {
        alert('你拥有的该卡牌数量不足！');
        return;
      }

      setDeck([...deck, card]);
      setAddSuccessToast({
        cardName: card.fullName,
        count: count + 1
      });
    } else if (count >= 4) {
      alert('同名卡牌在卡组中不能超过4张！');
    } else if (deck.length >= 50) {
      alert('卡组已满（上限50张）！');
    }
  };

  const removeFromDeck = (index: number) => {
    const newDeck = [...deck];
    newDeck.splice(index, 1);
    setDeck(newDeck);
  };

  const sortDeck = () => {
    const rarityOrder: Record<string, number> = { 'SER': 0, 'UR': 1, 'PR': 2, 'SR': 3, 'R': 4, 'U': 5, 'C': 6 };
    const colorOrder: Record<string, number> = { 'RED': 0, 'WHITE': 1, 'YELLOW': 2, 'BLUE': 3, 'GREEN': 4, 'NONE': 5 };

    const sorted = [...deck].sort((a, b) => {
      // Rarity
      const rA = rarityOrder[a.rarity] ?? 10;
      const rB = rarityOrder[b.rarity] ?? 10;
      if (rA !== rB) return rA - rB;

      // Color
      const cA = colorOrder[a.color] ?? 10;
      const cB = colorOrder[b.color] ?? 10;
      if (cA !== cB) return cA - cB;

      // AC
      if (a.acValue !== b.acValue) return a.acValue - b.acValue;

      // Name
      return a.fullName.localeCompare(b.fullName);
    });
    setDeck(sorted);
  };

  useEffect(() => {
    setVisibleCardCount(INITIAL_VISIBLE_CARD_COUNT);
  }, [deferredSearchTerm, filters]);

  useEffect(() => {
    if (!addSuccessToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAddSuccessToast(null);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [addSuccessToast]);

  const favoriteBackUrl = useMemo(
    () => CARD_BACKS.find(back => back.id === favoriteBackId)?.url,
    [favoriteBackId]
  );

  const deckBaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const card of deck) {
      counts[card.id] = (counts[card.id] || 0) + 1;
    }

    return counts;
  }, [deck]);

  const godMarkCount = useMemo(
    () => deck.reduce((total, card) => total + (card.godMark ? 1 : 0), 0),
    [deck]
  );

  const shuffleDeck = () => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
  };

  const filteredCards = useMemo(() => cardLibrary.filter(c => {
    // Text search
    const matchesSearch = c.fullName.includes(deferredSearchTerm) ||
      (c.specialName && c.specialName.includes(deferredSearchTerm));
    if (!matchesSearch) return false;

    // Filters
    if (filters.ac !== '' && c.acValue.toString() !== filters.ac) return false;
    if (filters.damage !== '' && c.damage?.toString() !== filters.damage) return false;
    if (filters.power !== '' && c.power?.toString() !== filters.power) return false;
    if (!matchesCardPackageFilter(c.cardPackage, filters.cardPackage)) return false;
    if (filters.color !== 'ALL' && c.color !== filters.color) return false;
    if (filters.faction !== 'ALL' && c.faction !== filters.faction) return false;
    if (filters.rarity !== 'ALL' && c.rarity !== filters.rarity) return false;

    // Ownership
    const isOwned = (collection[c.uniqueId] || collection[c.id] || 0) > 0;
    if (filters.ownership === 'OWNED' && !isOwned) return false;
    if (filters.ownership === 'NOT_OWNED' && isOwned) return false;

    return true;
  }), [cardLibrary, collection, deferredSearchTerm, filters]);

  const visibleCards = useMemo(
    () => filteredCards.slice(0, visibleCardCount),
    [filteredCards, visibleCardCount]
  );

  const loadingOverlayTitle = saving ? '保存卡组中' : '处理中';
  const loadingOverlayDescription = saving
    ? '正在同步你的卡组配置，请稍候...'
    : '正在处理当前卡牌操作，请稍候...';

  return (
    <div className="flex h-[calc(100vh-64px)] mt-16 overflow-hidden bg-zinc-950 relative">
      <LoadingOverlay
        open={saving || actionLoading}
        title={loadingOverlayTitle}
        description={loadingOverlayDescription}
      />

      <AnimatePresence>
        {addSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed left-1/2 top-24 z-[145] w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
          >
            <div className="rounded-2xl border border-emerald-400/20 bg-zinc-950/95 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-400">
                  <Check className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black italic text-white">已加入卡组</p>
                  <p className="truncate text-xs text-zinc-400">
                    {addSuccessToast.cardName} 已加入，当前 {addSuccessToast.count} / 4
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left: My Decks */}
      <div className={cn(
        "absolute lg:relative z-40 w-72 h-full border-r border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl lg:shadow-none transition-transform duration-300",
        showDecksMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <button
          onClick={() => setShowDecksMobile(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-zinc-400"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-4">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-white/5 transition-all w-full text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1" />
            <span className="font-black italic tracking-tighter uppercase text-sm">返回主界面</span>
          </button>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black italic tracking-tighter text-red-500">我的卡组</h3>
            <button onClick={createNewDeck} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {myDecks.map((d, index) => (
            <div
              key={d.id || `deck-${index}`}
              onClick={() => setSearchParams({ id: d.id })}
              className={cn(
                "group p-3 rounded-xl border transition-all cursor-pointer relative",
                selectedDeckId === d.id ? "bg-red-600/10 border-red-600" : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600"
              )}
            >
              {isRenaming === d.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    className="bg-black border border-zinc-700 rounded px-2 py-1 text-xs w-full"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && renameDeck(d.id)}
                  />
                  <button onClick={() => renameDeck(d.id)}><Save className="w-3 h-3" /></button>
                </div>
              ) : (
                <>
                  <p className="font-bold text-sm truncate pr-16">{d.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{d.cards.length} 张卡牌</p>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setIsRenaming(d.id); setNewName(d.name); }} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => copyDeck(d, e)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(d.id); }} className="p-1.5 hover:bg-zinc-800 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-black italic tracking-tighter mb-4">删除卡组</h3>
              <p className="text-zinc-400 text-sm mb-6">确定要删除这个卡组吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteDeck(confirmDeleteId)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-colors"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Middle: Deck Editor */}
      <div className="flex-1 flex flex-col bg-black overflow-hidden w-full">
        <div className="flex-shrink-0 p-4 md:p-6 border-b border-zinc-900 flex flex-col md:flex-row md:items-center justify-between bg-zinc-950/50 gap-4">
          <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDecksMobile(true)}
                className="lg:hidden p-2 bg-zinc-900 rounded-lg text-zinc-400"
              >
                <ListFilter className="w-5 h-5" />
              </button>
              <input
                className="bg-transparent text-2xl font-black italic tracking-tighter focus:outline-none border-b-2 border-transparent focus:border-red-600 transition-all"
                value={deckName}
                onChange={e => setDeckName(e.target.value)}
              />
              <span className="px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {deck.length} / 50
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setShowLibrary(true)}
              className="lg:flex hidden items-center gap-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-full transition-all text-zinc-400"
            >
              <Search className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">搜索卡牌</span>
            </button>
            <button
              onClick={() => setShowLibrary(true)}
              className="lg:hidden flex items-center gap-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-full transition-all text-zinc-400"
            >
              <Search className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">搜索卡牌</span>
            </button>
            <div className="flex gap-2">
              <button
                onClick={sortDeck}
                className="flex items-center gap-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-full transition-all text-zinc-400 hover:text-white group"
                title="排序卡组"
              >
                <ListFilter className="w-4 h-4 group-hover:scale-110" />
                <span className="text-[10px] font-black uppercase tracking-widest">排序</span>
              </button>
              <button
                onClick={shuffleDeck}
                className="flex items-center gap-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-full transition-all text-zinc-400 hover:text-white group"
                title="洗切卡组"
              >
                <Shuffle className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">洗切</span>
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 md:px-8 py-2 bg-red-600 hover:bg-red-700 rounded-full font-black italic text-[10px] md:text-sm tracking-tighter flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="whitespace-nowrap">保存卡组</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {deck.map((card, index) => (
              <div key={`${card.uniqueId}-${index}`} className="relative group">
                <div
                  className="transition-transform hover:scale-105 cursor-zoom-in"
                  onClick={() => setZoomedCard(card)}
                >
                  <CardComponent
                    card={card}
                    disableZoom={true}
                    displayMode="deck"
                    cardBackUrl={favoriteBackUrl}
                  />
                </div>
                <button
                  onClick={() => removeFromDeck(index)}
                  className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-2xl opacity-60 group-hover:opacity-100 transition-all hover:scale-110 z-10 border-2 border-white/20"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            ))}
            {deck.length === 0 && (
              <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
                <Plus className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-black italic tracking-tighter">从右侧添加卡牌开始构筑</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Card Library */}
      <div className={cn(
        "absolute lg:relative right-0 z-40 w-80 h-full border-l border-zinc-800 flex flex-col bg-zinc-900 transition-transform duration-300 shadow-2xl lg:shadow-none",
        showLibrary ? "translate-x-0" : "translate-x-full lg:hidden"
      )}>
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-4">
          <button
            onClick={() => setShowLibrary(false)}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-white/10 transition-all w-full text-zinc-300"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-black italic tracking-tighter uppercase text-sm">返回</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              className="w-full bg-black border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-red-600 transition-all"
              placeholder="搜索卡牌..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">AC</label>
              <input
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="全部"
                value={filters.ac}
                onChange={e => setFilters({ ...filters, ac: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">伤害</label>
              <input
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="全部"
                value={filters.damage}
                onChange={e => setFilters({ ...filters, damage: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">力量</label>
              <input
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="全部"
                value={filters.power}
                onChange={e => setFilters({ ...filters, power: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">卡包</label>
              <input
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="例如 BT01"
                value={filters.cardPackage}
                onChange={e => setFilters({ ...filters, cardPackage: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">颜色</label>
              <select
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.color}
                onChange={e => setFilters({ ...filters, color: e.target.value })}
              >
                <option value="ALL">全部颜色</option>
                <option value="RED">红色</option>
                <option value="BLUE">蓝色</option>
                <option value="GREEN">绿色</option>
                <option value="YELLOW">黄色</option>
                <option value="WHITE">白色</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">稀有度</label>
              <select
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.rarity}
                onChange={e => setFilters({ ...filters, rarity: e.target.value })}
              >
                <option value="ALL">全部稀有度</option>
                <option value="C">C</option>
                <option value="U">U</option>
                <option value="R">R</option>
                <option value="SR">SR</option>
                <option value="UR">UR</option>
                <option value="SER">SER</option>
                <option value="PR">PR</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">持有状态</label>
              <select
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.ownership}
                onChange={e => setFilters({ ...filters, ownership: e.target.value })}
              >
                <option value="ALL">全部卡牌</option>
                <option value="OWNED">已拥有</option>
                <option value="NOT_OWNED">未拥有</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">势力</label>
              <select
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.faction}
                onChange={e => setFilters({ ...filters, faction: e.target.value })}
              >
                <option value="ALL">全部势力</option>
                {FACTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleCards.map((card, index) => {
            const isOwned = (collection[card.uniqueId] || collection[card.id] || 0) > 0;
            return (
              <div
                key={card.uniqueId || card.id || `card-${index}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '96px 148px' }}
                className={cn(
                  "bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 hover:border-zinc-600 transition-all group relative",
                  !isOwned && "opacity-60 grayscale-[0.5]"
                )}
              >
                <div className="flex gap-3">
                  <div
                    className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 shadow-lg cursor-zoom-in"
                    onClick={() => setZoomedCard(card)}
                  >
                    <img src={getCardImageUrl(card.id, card.rarity, true, card.availableRarities)} className={cn("w-full h-full object-cover", !isOwned && "brightness-[0.4]")} loading="lazy" decoding="async" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black italic text-sm truncate">{card.fullName}</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{getCardTypeLabel(card.type)} - {card.rarity}</p>
                    <p className="text-[10px] text-zinc-500 mb-1">卡包：{card.cardPackage || '未知'}</p>
                    <p className="text-[10px] text-zinc-400 font-bold">数量：{collection[card.uniqueId] || collection[card.id] || 0}</p>
                  </div>
                </div>
                {isOwned && (
                  <button
                    onClick={() => addToDeck(card)}
                    className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg opacity-60 group-hover:opacity-100 transition-all z-10"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {filteredCards.length > visibleCards.length && (
            <button
              onClick={() => setVisibleCardCount(current => current + INITIAL_VISIBLE_CARD_COUNT)}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black italic text-zinc-300 transition-all hover:border-red-500/40 hover:text-white"
            >
              加载更多卡牌 ({visibleCards.length}/{filteredCards.length})
            </button>
          )}
        </div>
      </div>

      {/* Zoom Modal (Synthesis Console) */}
      <AnimatePresence>
        {zoomedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedCard(null)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 lg:p-24 cursor-default"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-[2rem] md:rounded-[3rem] p-0 md:p-10 max-w-5xl w-full flex flex-col md:flex-row gap-0 md:gap-12 relative overflow-y-auto md:overflow-hidden shadow-2xl max-h-[92vh] md:max-h-[90vh] custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedCard(null);
                }}
                className="absolute top-6 left-6 z-[110] px-4 py-2 bg-zinc-800/90 hover:bg-zinc-700 border border-white/20 rounded-xl text-white shadow-2xl transition-all group flex items-center gap-2"
                title="返回"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-black italic uppercase tracking-widest hidden md:block">返回</span>
              </button>
              {/* Large Card Image */}
              <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-0 bg-zinc-800/20 md:bg-transparent">
                <div className="relative group w-full max-w-[240px] md:max-w-[320px]">
                  <div className={cn(
                    "absolute -inset-4 rounded-[2rem] blur-2xl opacity-20",
                    zoomedCard.rarity === 'UR' || zoomedCard.rarity === 'SER' ? 'bg-amber-500' : 'bg-red-600'
                  )} />
                  <img
                    src={getCardImageUrl(zoomedCard.id, zoomedCard.rarity, false, zoomedCard.availableRarities)}
                    alt={zoomedCard.fullName}
                    className="relative w-full object-contain rounded-[1.5rem] shadow-2xl border-4 border-white/10 max-h-[45vh] md:max-h-none"
                    decoding="async"
                  />
                  <div className="absolute bottom-4 -right-2 bg-red-600 px-3 py-1.5 rounded-xl border border-red-400 font-black italic shadow-2xl rotate-12 z-20">
                    <span className="text-sm">x{collection[zoomedCard.uniqueId] || 0}</span>
                  </div>
                  <div className="absolute -bottom-4 -left-4 bg-zinc-800 px-4 py-2 rounded-xl border border-white/10 font-black italic shadow-2xl -rotate-6 z-20 flex flex-col items-center">
                    <span className="text-[10px] opacity-60 text-red-500">卡组内</span>
                    <span>{deckBaseCounts[zoomedCard.id] || 0} / 4</span>
                  </div>
                </div>
              </div>

              {/* Console & Details */}
              <div className="flex-1 flex flex-col p-6 md:p-6 overflow-hidden md:overflow-visible">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{zoomedCard.id}</span>
                    <div className="h-px w-12 bg-red-500/30" />
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black italic text-white uppercase tracking-tighter leading-none mb-1">
                    {zoomedCard.fullName}
                  </h2>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">关键词</p>
                  <KeywordBadges card={zoomedCard} variant="detail" />
                </div>

                <div className="flex-1 md:overflow-y-auto pr-0 md:pr-2 custom-scrollbar space-y-6">

                  {/* Synthesis Console Area */}
                  <div className="space-y-4 pt-4">
                    {/* <h3 className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.4em] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      Synthesis Console
                    </h3> */}
                    {/* Decompose */}
                    <div className="p-4 md:p-6 rounded-3xl bg-zinc-800/50 border border-white/5 flex items-center justify-between group hover:bg-zinc-800 transition-all">
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase italic mb-1">分解</p>
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-5 h-5 text-red-500" />
                          <span className="text-xl md:text-2xl font-black italic text-cyan-400">+{CRYSTAL_VALUES[zoomedCard.rarity]?.decompose || 0}</span>
                          <X className="w-4 h-4 text-cyan-400" />
                        </div>
                      </div>
                      <button
                        onClick={() => handleDecompose(zoomedCard.uniqueId)}
                        disabled={actionLoading || (collection[zoomedCard.uniqueId] || 0) <= 0}
                        className={cn(
                          "px-6 md:px-8 py-2 md:py-3 rounded-2xl font-black italic text-xs md:text-sm transition-all uppercase",
                          (collection[zoomedCard.uniqueId] || 0) > 0
                            ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '分解'}
                      </button>
                    </div>

                    {/* Craft */}
                    <div className="p-4 md:p-6 rounded-3xl bg-zinc-800/50 border border-white/5 flex items-center justify-between group hover:bg-zinc-800 transition-all">
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase italic mb-1">制作</p>
                        <div className="flex items-center gap-2">
                          <Plus className="w-5 h-5 text-green-500" />
                          <span className="text-xl md:text-2xl font-black italic text-red-500">-{CRYSTAL_VALUES[zoomedCard.rarity]?.produce || 0}</span>
                          <X className="w-4 h-4 text-cyan-400" />
                        </div>
                      </div>
                      <button
                        onClick={() => handleCraft(zoomedCard.uniqueId)}
                        disabled={actionLoading || cardCrystals < (CRYSTAL_VALUES[zoomedCard.rarity]?.produce || 0)}
                        className={cn(
                          "px-6 md:px-8 py-2 md:py-3 rounded-2xl font-black italic text-xs md:text-sm transition-all uppercase",
                          cardCrystals >= (CRYSTAL_VALUES[zoomedCard.rarity]?.produce || 0)
                            ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20"
                            : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '制作'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">当前卡晶</p>
                      <p className="text-lg md:text-xl font-black italic text-cyan-400">{(cardCrystals || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <button onClick={() => setZoomedCard(null)} className="text-zinc-500 hover:text-white font-black italic text-sm uppercase transition-colors">
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
