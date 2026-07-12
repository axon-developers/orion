import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { EnvironmentDto } from '../../types/api';
import { 
  User, Shield, ChevronRight, Sun, Moon, LogOut, Settings,
  Bell, Trash2, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle, Globe
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useThemeStore } from '../../stores/theme-store';
import { useNotificationStore } from '../../stores/notification-store';
import { Button } from '../ui';

export const Header: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

  const pathnames = location.pathname.split('/').filter((x) => x);
  const appId = pathnames[0] === 'applications' ? pathnames[1] : null;

  const { data: environments } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: !!appId,
  });

  const defaultEnv = environments?.find(e => e.isDefault);

  const { theme, setTheme } = useThemeStore();
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotificationStore();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [timeState, setTimeState] = useState({ ist: '', est: '' });

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      
      const istString = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const estString = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      setTimeState({ ist: istString, est: estString });
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close profile dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch (e) {
      return '';
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <header className="h-16 border-b border-border bg-card text-card-foreground flex items-center justify-between px-6 z-40">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-sm font-medium">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          Home
        </Link>
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          return (
            <React.Fragment key={to}>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {last ? (
                <span className="text-foreground capitalize">{decodeURIComponent(value)}</span>
              ) : (
                <Link to={to} className="text-muted-foreground hover:text-foreground capitalize">
                  {decodeURIComponent(value)}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Top Header Actions */}
      <div className="flex items-center space-x-4">
        {/* Live Digital Clocks */}
        <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono border-r border-border/50 pr-4 h-9">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-[8px] uppercase tracking-wider leading-none">IST (Kolkata)</span>
            <span className="text-foreground/90 font-bold mt-0.5">{timeState.ist}</span>
          </div>
          <div className="h-6 border-l border-border/30" />
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-[8px] uppercase tracking-wider leading-none">EST (New York)</span>
            <span className="text-foreground/90 font-bold mt-0.5">{timeState.est}</span>
          </div>
        </div>

        {defaultEnv && (
          <div className="flex items-center space-x-1.5 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2.5 py-1">
            <Globe className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" />
            <span>Env: <strong>{defaultEnv.name}</strong></span>
          </div>
        )}

        {user?.role === 'ADMIN' && (
          <div className="flex items-center space-x-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin Mode</span>
          </div>
        )}
        
        {/* Light / Dark Mode Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className="text-muted-foreground hover:text-foreground h-9 w-9 animate-in fade-in duration-100"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notificationDropdownRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
            className="text-muted-foreground hover:text-foreground h-9 w-9 relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </Button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[420px]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
                <span className="font-bold text-sm">Notifications</span>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearAll()}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Clear all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto py-1 divide-y divide-border/20 max-h-[300px]">
                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => markAsRead(item.id)}
                      className={`px-4 py-3 hover:bg-secondary/40 transition-colors cursor-pointer flex gap-3 text-xs ${!item.read ? 'bg-secondary/15 font-semibold' : ''}`}
                    >
                      <div className="shrink-0 mt-0.5">{getNotifIcon(item.type)}</div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground font-bold truncate">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(item.timestamp)}</span>
                        </div>
                        <p className="text-muted-foreground leading-normal break-words">{item.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs select-none">
                    No new notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button 
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center space-x-2.5 hover:bg-secondary/40 px-2.5 py-1.5 rounded-md cursor-pointer transition-all border border-transparent active:border-border/10 shrink-0"
          >
            <span className="text-sm font-semibold text-foreground hidden sm:inline">
              {user?.fullName}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150 py-1 font-medium">
              <div className="px-3 py-2 border-b border-border/40 text-xs">
                <span className="block text-foreground truncate">{user?.fullName}</span>
                <span className="block text-muted-foreground truncate">{user?.email}</span>
              </div>
              
              <Link 
                to="/settings/profile" 
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-secondary/50 text-foreground transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>My Profile</span>
              </Link>
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive border-t border-border/40 transition-colors cursor-pointer text-left font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default Header;
