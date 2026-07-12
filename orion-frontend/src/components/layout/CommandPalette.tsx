import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Boxes, Activity, Settings, LayoutDashboard, Globe, Users, ArrowRight, Database } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch some applications for dynamic search if opened
  const { data: appsData } = useQuery({
    queryKey: ['cmd-applications'],
    queryFn: async () => {
      const res = await api.get('/applications?page=0&size=20');
      return res.data;
    },
    enabled: isOpen,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const staticLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Applications', path: '/applications', icon: Boxes },
    { name: 'Recent Executions', path: '/executions', icon: Activity },
    { name: 'Global Environments', path: '/global/env-configs', icon: Globe },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Database Console', path: '/admin/database', icon: Database },
    { name: 'Settings', path: '/settings/profile', icon: Settings },
  ];

  const dynamicApps = appsData?.content?.map((app: any) => ({
    name: `App: ${app.appName || app.name}`,
    path: `/applications/${app.id}`,
    icon: Boxes,
  })) || [];

  const allLinks = [...staticLinks, ...dynamicApps];

  const filteredLinks = query
    ? allLinks.filter((link) => link.name.toLowerCase().includes(query.toLowerCase()))
    : staticLinks;

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            placeholder="Search applications, settings, or jump to..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-medium border border-border/50">
            ESC
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filteredLinks.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            <div className="px-2">
              {filteredLinks.map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => handleNavigate(link.path)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-sm font-medium text-muted-foreground group"
                >
                  <div className="flex items-center">
                    <link.icon className="h-4 w-4 mr-3 opacity-70 group-hover:opacity-100" />
                    <span className="text-foreground">{link.name}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
