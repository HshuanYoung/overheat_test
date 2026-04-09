import { getAuthUser } from '../socket';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Trash2, Plus, Search, Loader2, Copy, Edit3, X, Sparkles } from 'lucide-react';
import { CARD_LIBRARY } from '../data/cards';
import { FACTIONS } from '../data/factions';
import { Card as CardType, Deck } from '../types/game';
import { CardComponent } from './Card';
import { cn, getCardImageUrl } from '../lib/utils';

export const DeckBuilder: React.FC = () => {
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
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({
    ac: '',
    damage: '',
    power: '',
    color: 'ALL',
    faction: 'ALL',
    rarity: 'ALL',
    ownership: 'ALL' // ALL, OWNED, NOT_OWNED
  });

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

  const loadCollection = async () => {
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setCardCrystals(data.cardCrystals || 0);
    } catch (e) { console.error(e); }
  };

  const handleDecompose = async (cardId: string) => {
    setActionLoading(true);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const card = CARD_LIBRARY.find(c => c.uniqueId === cardId || c.id === cardId);
    if (!card) return;
    const cost = CRYSTAL_VALUES[card.rarity]?.produce || 0;
    if (cardCrystals < cost) { alert('卡晶不足'); return; }

    setActionLoading(true);
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(BACKEND_URL + '/api/user/decks', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      const decks: Deck[] = data.decks || [];
      setMyDecks(decks);
      if (decks.length > 0 && !selectedDeckId) {
        loadDeckToEditor(decks[0]);
      }
    } catch (e) {
      console.error('Failed to load decks:', e);
    }
  };

  const loadDeckToEditor = (savedDeck: Deck) => {
    // Attempt to find by uniqueId first, then by legacy id
    const cards = savedDeck.cards.map(uid => 
        CARD_LIBRARY.find(c => c.uniqueId === uid) || 
        CARD_LIBRARY.find(c => c.id === uid)
    ).filter((c): c is CardType => !!c);
    
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

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
  };

  const deleteDeck = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!getAuthUser()) return;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
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
    const count = deck.filter(c => c.id === card.id).length;
    const godMarkCount = deck.filter(c => c.godMark).length;

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

  const filteredCards = CARD_LIBRARY.filter(c => {
    // Text search
    const matchesSearch = c.fullName.includes(searchTerm) || 
      (c.specialName && c.specialName.includes(searchTerm)) || 
      c.effects?.some(e => e.description.includes(searchTerm));
    if (!matchesSearch) return false;

    // Filters
    if (filters.ac !== '' && c.acValue.toString() !== filters.ac) return false;
    if (filters.damage !== '' && c.damage?.toString() !== filters.damage) return false;
    if (filters.power !== '' && c.power?.toString() !== filters.power) return false;
    if (filters.color !== 'ALL' && c.color !== filters.color) return false;
    if (filters.faction !== 'ALL' && c.faction !== filters.faction) return false;
    if (filters.rarity !== 'ALL' && c.rarity !== filters.rarity) return false;

    // Ownership
    const isOwned = (collection[c.uniqueId] || collection[c.id] || 0) > 0;
    if (filters.ownership === 'OWNED' && !isOwned) return false;
    if (filters.ownership === 'NOT_OWNED' && isOwned) return false;

    return true;
  });

  return (
    <div className="flex h-[calc(100vh-64px)] mt-16 overflow-hidden bg-zinc-950">
      {/* Left: My Decks */}
      <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-black italic tracking-tighter text-red-500">我的卡组</h3>
          <button onClick={createNewDeck} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {myDecks.map(d => (
            <div 
              key={d.id} 
              onClick={() => loadDeckToEditor(d)}
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
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{d.cards.length} CARDS</p>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="flex-1 flex flex-col bg-black">
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-4">
            <input 
              className="bg-transparent text-2xl font-black italic tracking-tighter focus:outline-none border-b-2 border-transparent focus:border-red-600 transition-all"
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
            />
            <span className="px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {deck.length} / 50
            </span>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-black italic text-sm tracking-tighter flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存卡组
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {deck.map((card, index) => (
              <div key={`${card.uniqueId}-${index}`} className="relative group">
                <div 
                  className="transition-transform hover:scale-105 cursor-zoom-in"
                  onClick={() => setZoomedCard(card)}
                >
                  <CardComponent card={card} disableZoom={true} displayMode="deck" />
                </div>
                <button 
                  onClick={() => removeFromDeck(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
                >
                  <X className="w-4 h-4" />
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
      <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-800">
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
                placeholder="All"
                value={filters.ac}
                onChange={e => setFilters({...filters, ac: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Damage</label>
              <input 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="All"
                value={filters.damage}
                onChange={e => setFilters({...filters, damage: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Power</label>
              <input 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs"
                placeholder="All"
                value={filters.power}
                onChange={e => setFilters({...filters, power: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Color</label>
              <select 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.color}
                onChange={e => setFilters({...filters, color: e.target.value})}
              >
                <option value="ALL">All Colors</option>
                <option value="RED">Red</option>
                <option value="BLUE">Blue</option>
                <option value="GREEN">Green</option>
                <option value="YELLOW">Yellow</option>
                <option value="WHITE">White</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Rarity</label>
              <select 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.rarity}
                onChange={e => setFilters({...filters, rarity: e.target.value})}
              >
                <option value="ALL">All Rarities</option>
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
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Owned</label>
              <select 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.ownership}
                onChange={e => setFilters({...filters, ownership: e.target.value})}
              >
                <option value="ALL">All Cards</option>
                <option value="OWNED">Owned</option>
                <option value="NOT_OWNED">Not Owned</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase">Faction</label>
              <select 
                className="bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-white appearance-none"
                value={filters.faction}
                onChange={e => setFilters({...filters, faction: e.target.value})}
              >
                <option value="ALL">All Factions</option>
                {FACTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredCards.map(card => {
            const isOwned = (collection[card.uniqueId] || collection[card.id] || 0) > 0;
            return (
              <div 
                key={card.uniqueId}
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
                    <img src={getCardImageUrl(card.id, card.rarity, true)} className={cn("w-full h-full object-cover", !isOwned && "brightness-[0.4]")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black italic text-sm truncate">{card.fullName}</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{card.type} - {card.rarity}</p>
                    <p className="text-[10px] text-zinc-400 font-bold">QTY: {collection[card.uniqueId] || collection[card.id] || 0}</p>
                  </div>
                </div>
                {isOwned && (
                  <button 
                    onClick={() => addToDeck(card)}
                    className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
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
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-default"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-6 md:p-10 max-w-4xl w-full flex flex-col md:flex-row gap-8 md:gap-12 relative overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Large Card Image */}
              <div className="w-full md:w-1/2 flex items-center justify-center">
                <div className="relative group w-full max-w-[280px] md:max-w-[320px]">
                  <div className={cn(
                    "absolute -inset-4 rounded-[2rem] blur-2xl opacity-20",
                    zoomedCard.rarity === 'UR' || zoomedCard.rarity === 'SER' ? 'bg-amber-500' : 'bg-red-600'
                  )} />
                  <img 
                    src={getCardImageUrl(zoomedCard.id, zoomedCard.rarity, false)} 
                    alt={zoomedCard.fullName} 
                    className="relative w-full rounded-[1.5rem] shadow-2xl border-4 border-white/10"
                  />
                  <div className="absolute top-4 -right-4 bg-red-600 px-4 py-2 rounded-xl border border-red-400 font-black italic shadow-2xl rotate-12">
                    x{collection[zoomedCard.uniqueId] || 0}
                  </div>
                </div>
              </div>

              {/* Console */}
              <div className="w-full md:w-1/2 flex flex-col justify-center">
                <div className="mb-4">
                  <span className="px-4 py-1.5 rounded-full text-xs font-black italic border bg-zinc-800 border-zinc-700 text-zinc-300">
                     {zoomedCard.rarity} RARITY
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black italic mb-2 tracking-tighter uppercase">{zoomedCard.fullName}</h2>
                <p className="text-zinc-500 font-bold mb-6 md:mb-8 uppercase tracking-widest text-sm">{zoomedCard.specialName || '---'}</p>

                <div className="space-y-4 md:space-y-6">
                  {/* Decompose */}
                  <div className="p-4 md:p-6 rounded-3xl bg-zinc-800/50 border border-white/5 flex items-center justify-between group hover:bg-zinc-800 transition-all">
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase italic mb-1">DECOMPOSE 分解</p>
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
                      <p className="text-[10px] font-black text-zinc-500 uppercase italic mb-1">CRAFT 制作</p>
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

                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">Current Crystals</p>
                        <p className="text-lg md:text-xl font-black italic text-cyan-400">{(cardCrystals || 0).toLocaleString()}</p>
                      </div>
                   </div>
                   <button onClick={() => setZoomedCard(null)} className="text-zinc-500 hover:text-white font-black italic text-sm uppercase transition-colors">
                      CLOSE
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
