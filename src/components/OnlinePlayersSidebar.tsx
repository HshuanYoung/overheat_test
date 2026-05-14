import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UsersRound, Wifi, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getAuthToken, getAuthUser, socket } from '../socket';
import { cn } from '../lib/utils';

interface OnlinePlayer {
  uid: string;
  username?: string;
  displayName: string;
}

interface OnlinePlayersSidebarProps {
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const OnlinePlayersSidebar: React.FC<OnlinePlayersSidebarProps> = ({ isDesktopOpen, isMobileOpen, onClose, onCountChange }) => {
  const location = useLocation();
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const isHiddenRoute = location.pathname.startsWith('/battle/') || location.pathname === '/deck-builder';
  const currentUserId = getAuthUser()?.uid?.toString();

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    let active = true;

    const authenticate = () => {
      if (!active) return;
      socket.emit('authenticate', token);
    };

    const handleOnlinePlayers = (payload: { players?: OnlinePlayer[] }) => {
      if (!active) return;
      const nextPlayers = payload.players || [];
      setPlayers(nextPlayers);
      onCountChange?.(nextPlayers.length);
    };

    const handleAuthenticated = () => {
      if (!active) return;
      socket.emit('requestOnlinePlayers');
    };

    socket.on('onlinePlayers', handleOnlinePlayers);
    socket.on('authenticated', handleAuthenticated);
    socket.on('connect', authenticate);

    if (!socket.connected) {
      socket.connect();
    } else {
      authenticate();
    }

    return () => {
      active = false;
      socket.off('onlinePlayers', handleOnlinePlayers);
      socket.off('authenticated', handleAuthenticated);
      socket.off('connect', authenticate);
    };
  }, [onCountChange]);

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  if (isHiddenRoute) return null;

  const renderPlayers = () => (
    <div className="space-y-1">
      {players.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs font-bold text-zinc-500">
          暂无在线玩家
        </div>
      ) : (
        players.map(player => (
          <div
            key={player.uid}
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5',
              player.uid === currentUserId && 'bg-emerald-500/10 ring-1 ring-emerald-400/20'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-black text-zinc-200">
              {(player.displayName || player.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-bold text-zinc-100">{player.displayName || player.username || player.uid}</div>
                {player.uid === currentUserId && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                    你
                  </span>
                )}
              </div>
              {player.username && player.username !== player.displayName && (
                <div className="truncate text-[10px] font-bold text-zinc-500">{player.username}</div>
              )}
            </div>
            <Wifi className={cn('h-3.5 w-3.5 shrink-0 text-emerald-400')} />
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <aside className="fixed right-4 top-20 z-[80] hidden w-72 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-xl xl:block">
        <AnimatePresence initial={false}>
          {isDesktopOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-2">
                {renderPlayers()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm xl:hidden"
              onClick={onClose}
            />

            <motion.aside
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="fixed right-4 top-20 z-[95] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-xl xl:hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-black italic tracking-tight">在线玩家</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-300">
                    {players.length}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="关闭在线玩家"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(26rem,calc(100vh-7rem))] overflow-y-auto p-2">
                {renderPlayers()}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
