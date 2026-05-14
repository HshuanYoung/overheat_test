import React, { useEffect, useState } from 'react';
import { UsersRound, Wifi } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { socket, getAuthToken } from '../socket';
import { cn } from '../lib/utils';

interface OnlinePlayer {
  uid: string;
  username?: string;
  displayName: string;
}

export const OnlinePlayersSidebar: React.FC = () => {
  const location = useLocation();
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const isHiddenRoute = location.pathname.startsWith('/battle/') || location.pathname === '/deck-builder';

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const handleOnlinePlayers = (payload: { players?: OnlinePlayer[] }) => {
      setPlayers(payload.players || []);
    };

    socket.on('onlinePlayers', handleOnlinePlayers);
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('authenticate', token);

    return () => {
      socket.off('onlinePlayers', handleOnlinePlayers);
    };
  }, []);

  if (isHiddenRoute) return null;

  return (
    <aside className="fixed right-4 top-20 z-40 hidden w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 text-white shadow-2xl backdrop-blur-xl xl:block">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-black italic tracking-tight">在线玩家</h2>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-black text-emerald-300">
            {players.length}
          </span>
        </div>
      </div>

      <div className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto p-2">
        {players.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs font-bold text-zinc-500">
            暂无在线玩家
          </div>
        ) : (
          players.map(player => (
            <div key={player.uid} className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-black text-zinc-200">
                {(player.displayName || player.username || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-zinc-100">{player.displayName || player.username || player.uid}</div>
                {player.username && player.username !== player.displayName && (
                  <div className="truncate text-[10px] font-bold text-zinc-500">{player.username}</div>
                )}
              </div>
              <Wifi className={cn('h-3.5 w-3.5 shrink-0 text-emerald-400')} />
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
