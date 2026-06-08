import { useHealth } from '../hooks/useHealth';
import { useMarketStatus } from '../hooks/useMarketStatus';
import { useNiftyIndex } from '../hooks/useNiftyIndex';
import { useTheme } from '../hooks/useTheme';
import { Moon, Settings as SettingsIcon, Sun, LogOut } from 'lucide-react';
import { useState } from 'react';
import Settings from './Settings';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const health = useHealth();
  const market = useMarketStatus();
  const nifty = useNiftyIndex();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isMarketOpen = market.data?.isOpen ?? false;

  return (
    <div className="navbar bg-base-200 shadow-lg sticky top-0 z-20">
      <div className="flex-1">
        <a href="/" className="btn btn-ghost text-xl font-bold">Auto Trade</a>
      </div>
      <div className="flex-none gap-2 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs opacity-70">Nifty 50</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg">
                {nifty.data
                  ? nifty.data.value.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '—'}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold ${
                  (nifty.data?.change ?? 0) >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {nifty.data ? (
                  <>
                    {nifty.data.change >= 0 ? '+' : ''}
                    {nifty.data.change.toFixed(2)} (
                    {nifty.data.changePercent >= 0 ? '+' : ''}
                    {nifty.data.changePercent.toFixed(2)}%)
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`badge badge-sm sm:badge-md ${
                isMarketOpen ? 'badge-success' : 'badge-error'
              }`}
            >
              {isMarketOpen ? 'Open' : 'Closed'}
            </div>
            <div
              className={`badge badge-sm sm:badge-md ${
                health.isError ? 'badge-error' : health.isLoading ? 'badge-warning' : 'badge-success'
              }`}
            >
              {health.isError ? 'Backend down' : health.isLoading ? 'Connecting' : 'Backend OK'}
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              <SettingsIcon size={18} />
            </button>
            {user && (
              <div className="flex items-center gap-2 border-l border-base-300 pl-2 sm:pl-4">
                {user.role === 'Admin' && (
                  <a href="/admin" className="btn btn-xs bg-secondary/15 hover:bg-secondary hover:text-secondary-content border border-secondary/35 hover:border-secondary font-black text-secondary px-3 py-1 rounded-lg hover:scale-105 active:scale-95 transition-all duration-200 mr-2 shadow-sm">
                    🛡️ Admin Panel
                  </a>
                )}
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-xs font-semibold text-primary">{user.fullName}</span>
                  <span className="text-[10px] opacity-50">{user.role}</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm text-error animate-pulse-subtle"
                  type="button"
                  onClick={logout}
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="text-xs opacity-70 hidden sm:block">
            Last: {formatTime(market.data?.serverTimeIst ?? new Date().toISOString())}
          </div>
        </div>
      </div>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
