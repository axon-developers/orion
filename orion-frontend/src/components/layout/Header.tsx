import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { User, Shield, ChevronRight, Sun, Moon, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { Button } from '../ui';

export const Header: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('orion-theme') || 'dark';
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('orion-theme', theme);
  }, [theme]);

  // Handle click outside to close profile dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
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

  // Generate breadcrumbs from path
  const pathnames = location.pathname.split('/').filter((x) => x);

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

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2.5 hover:bg-secondary/40 px-2.5 py-1.5 rounded-md cursor-pointer transition-all border border-transparent active:border-border/10 shrink-0"
          >
            <span className="text-sm font-semibold text-foreground hidden sm:inline">
              {user?.fullName}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150 py-1 font-medium">
              <div className="px-3 py-2 border-b border-border/40 text-xs">
                <span className="block text-foreground truncate">{user?.fullName}</span>
                <span className="block text-muted-foreground truncate">{user?.email}</span>
              </div>
              
              <Link 
                to="/settings/profile" 
                onClick={() => setIsDropdownOpen(false)}
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
