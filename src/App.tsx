/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';

import { socket, getAuthUser, setAuthUser, setAuthToken, getAuthToken } from './socket';
import { TopBar } from './components/TopBar';
import { Home } from './components/Home';
import { prefetchCardCatalog } from './hooks/useCardCatalog';
import { PageFallback } from './components/PageFallback';

const Matchmaking = lazy(() => import('./components/Matchmaking').then(module => ({ default: module.Matchmaking })));
const BattleField = lazy(() => import('./components/BattleField').then(module => ({ default: module.BattleField })));
const DeckBuilder = lazy(() => import('./components/DeckBuilder').then(module => ({ default: module.DeckBuilder })));
const Rulebook = lazy(() => import('./components/Rulebook').then(module => ({ default: module.Rulebook })));
const Profile = lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const Store = lazy(() => import('./components/Store').then(module => ({ default: module.Store })));
const Collection = lazy(() => import('./components/Collection').then(module => ({ default: module.Collection })));
const PracticeSetup = lazy(() => import('./components/PracticeSetup').then(module => ({ default: module.PracticeSetup })));
const FriendMatch = lazy(() => import('./components/FriendMatch').then(module => ({ default: module.FriendMatch })));

export default function App() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [sendCodeCooldown, setSendCodeCooldown] = useState(0);

  useEffect(() => {
    const savedUser = getAuthUser();
    let cleanup = () => {};

    if (savedUser) {
      setUser(savedUser);

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

        cleanup = () => {
          socket.off('connect', authHandler);
        };
      }
    }

    setLoading(false);
    return cleanup;
  }, []);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const preloadRoutes = () => {
      void import('./components/Matchmaking');
      void import('./components/FriendMatch');
      void import('./components/PracticeSetup');
      void prefetchCardCatalog({ includeEffects: false });
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(preloadRoutes, { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timer = window.setTimeout(preloadRoutes, 800);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (sendCodeCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setSendCodeCooldown(current => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sendCodeCooldown]);

  const handleAuthSuccess = (token: string, authUser: any) => {
    setAuthToken(token);
    setAuthUser(authUser);
    setUser(authUser);

    if (!socket.connected) {
      socket.once('connect', () => socket.emit('authenticate', token));
      socket.connect();
      return;
    }

    socket.emit('authenticate', token);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        handleAuthSuccess(data.token, data.user);
      } else {
        setLoginError(data.error || '登录失败');
      }
    } catch (err) {
      setLoginError('网络错误');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSendVerificationCode = async () => {
    setRegisterError('');
    setRegisterMessage('');
    setSendingCode(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/register/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        setRegisterMessage(data.message || '验证码已发送，请前往邮箱查收');
        setSendCodeCooldown(60);
      } else {
        setRegisterError(data.error || '验证码发送失败');
      }
    } catch (err) {
      setRegisterError('网络错误');
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterMessage('');
    setRegisterSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword,
          verificationCode
        })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        handleAuthSuccess(data.token, data.user);
      } else {
        setRegisterError(data.error || '注册失败');
      }
    } catch (err) {
      setRegisterError('网络错误');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:p-8">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100vh-4rem)]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full rounded-[28px] border border-white/10 bg-zinc-900/95 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8"
          >
            <h1 className="mb-3 text-center text-4xl font-black italic tracking-tighter text-red-600 md:text-6xl">神蚀创痕</h1>
            <p className="mb-6 text-center text-[10px] tracking-[0.2em] text-zinc-400 md:mb-8 md:text-sm">OVERHEAT TCG ONLINE</p>

            <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setLoginError('');
                }}
                className={`rounded-xl py-3 text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setRegisterError('');
                  setRegisterMessage('');
                }}
                className={`rounded-xl py-3 text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                注册
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-3 sm:gap-4">
                <input
                  type="text"
                  placeholder="用户名或邮箱"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                />
                <input
                  type="password"
                  placeholder="密码"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                />
                {loginError && <div className="text-sm font-bold text-red-500">{loginError}</div>}
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="mt-3 w-full rounded-2xl bg-white py-4 text-base font-bold text-black transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:bg-zinc-200 disabled:opacity-60"
                >
                  {loginSubmitting ? '登录中...' : '登录'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-3 sm:gap-4">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs leading-relaxed text-zinc-300">
                  <p className="font-bold tracking-wide text-white">新用户初始资源</p>
                  <p className="mt-1 text-zinc-400">100000 金币 + 100000 卡晶 + 每种卡牌 4 张</p>
                </div>
                <input
                  type="text"
                  placeholder="用户名"
                  value={registerUsername}
                  onChange={e => setRegisterUsername(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                />
                <input
                  type="email"
                  placeholder="邮箱"
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                />
                <input
                  type="password"
                  placeholder="密码"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    placeholder="6位验证码"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black px-4 py-3 text-white placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode || sendCodeCooldown > 0}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-red-500 disabled:opacity-60 disabled:hover:bg-red-600 sm:w-auto sm:min-w-[122px]"
                  >
                    {sendingCode ? '发送中...' : sendCodeCooldown > 0 ? `${sendCodeCooldown}秒` : '发送验证码'}
                  </button>
                </div>
                {registerMessage && <div className="text-sm font-bold text-emerald-400">{registerMessage}</div>}
                {registerError && <div className="text-sm font-bold text-red-500">{registerError}</div>}
                <button
                  type="submit"
                  disabled={registerSubmitting}
                  className="mt-1 w-full rounded-2xl bg-white py-4 text-base font-bold text-black transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:bg-zinc-200 disabled:opacity-60"
                >
                  {registerSubmitting ? '注册中...' : '完成注册'}
                </button>
                <p className="px-1 text-xs leading-relaxed text-zinc-500">
                  注册成功后会自动发放 100000 金币、100000 卡晶，并为每张卡初始化 4 张。
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500 selection:text-white">
        <TopBar onOpenRulebook={() => setIsRulebookOpen(true)} />

        <main className="h-screen overflow-auto">
          <Suspense fallback={<PageFallback />}>
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
          </Suspense>
        </main>

        {isRulebookOpen && (
          <Suspense fallback={null}>
            <Rulebook isOpen={isRulebookOpen} onClose={() => setIsRulebookOpen(false)} />
          </Suspense>
        )}
      </div>
    </Router>
  );
}
