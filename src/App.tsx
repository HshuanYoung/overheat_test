/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Play, History, Heart, Plus, Trash2, Home as HomeIcon, Settings, User } from 'lucide-react';
import { cn } from './lib/utils';

import { socket, getAuthUser, setAuthUser, setAuthToken, getAuthToken } from './socket';
import { Matchmaking } from './components/Matchmaking';
import { BattleField } from './components/BattleField';
import { DeckBuilder } from './components/DeckBuilder';
import { Rulebook } from './components/Rulebook';
import { TopBar } from './components/TopBar';
import { Home } from './components/Home';
import { Profile } from './components/Profile';
import { Store } from './components/Store';
import { Collection } from './components/Collection';
import { PracticeSetup } from './components/PracticeSetup';
import { FriendMatch } from './components/FriendMatch';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const savedUser = getAuthUser();
    if (savedUser) {
      setUser(savedUser);
      // Ensure socket is connected and authenticates on every connect (including reconnects)
      const token = getAuthToken();
      if (token) {
        const authHandler = () => {
          socket.emit('authenticate', token);
        };
        socket.on('connect', authHandler);
        if (!socket.connected) {
          socket.connect();
        } else {
          authHandler();
        }
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      // Use relative path for proxy support
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        setAuthUser(data.user);
        setUser(data.user);
        // Connect socket and authenticate after login
        socket.connect();
        socket.once('connect', () => socket.emit('authenticate', data.token));
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network Error');
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center text-white">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-zinc-900 border border-white/10 p-8 rounded-3xl"
        >
          <h1 className="text-6xl font-black text-red-600 italic mb-4 tracking-tighter">神蚀创痕</h1>
          <p className="text-zinc-400 mb-8 uppercase tracking-[0.3em] text-sm">OVERHEAT TCG ONLINE</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="text" 
              placeholder="Username (e.g. test1)" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="p-3 bg-black border border-white/20 rounded-lg text-white"
            />
            <input 
              type="password" 
              placeholder="Password (password123)" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="p-3 bg-black border border-white/20 rounded-lg text-white"
            />
            {loginError && <div className="text-red-500 text-sm font-bold">{loginError}</div>}
            <button 
              type="submit"
              className="w-full py-4 mt-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              登录
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500 selection:text-white">
        <TopBar onOpenRulebook={() => setIsRulebookOpen(true)} />

        {/* Main Content */}
        <main className="h-screen overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/deck-builder" element={<DeckBuilder />} />
            <Route path="/battle" element={<Matchmaking />} />
            <Route path="/battle/:gameId" element={<BattleField />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/store" element={<Store />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/practice" element={<PracticeSetup />} />
            <Route path="/friend-match" element={<FriendMatch />} />
            <Route path="/history" element={<div className="pt-24 px-12 text-zinc-500 uppercase tracking-widest text-center">对战历史即将上线</div>} />
          </Routes>
        </main>

        {/* Rulebook Overlay */}
        <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} />
      </div>
    </Router>
  );
}
