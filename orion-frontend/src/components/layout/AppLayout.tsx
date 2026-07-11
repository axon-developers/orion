import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import { toast } from 'sonner';
import { useSystemSettingsStore } from '../../stores/system-settings-store';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { getSettingInt } = useSystemSettingsStore();

  // Inactivity timeout threshold: dynamically configured (default 15 minutes)
  const inactivityMinutes = getSettingInt('ui.inactivity_timeout_minutes', 15);
  const INACTIVITY_TIMEOUT = inactivityMinutes * 60 * 1000;
  const lastActivityTime = useRef<number>(Date.now());

  useEffect(() => {
    // Reset inactivity timer when user activity is detected
    const handleActivity = () => {
      lastActivityTime.current = Date.now();
    };

    // Listen to standard user interaction events
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'click', 'mousemove'];
    
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check inactivity state periodically (every 10 seconds)
    const interval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime.current;
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        // Clear all session storage tokens
        localStorage.removeItem('orion_access_token');
        localStorage.removeItem('orion_refresh_token');
        localStorage.removeItem('orion_user');
        
        toast.error('Session expired due to inactivity. Please login again.');
        
        // Redirect user to login page
        navigate('/login');
      }
    }, 10000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar navigation */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main content viewport */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar header */}
        <Header />

        {/* Content body scroll area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="w-full max-w-full space-y-6 px-1 md:px-3">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  );
};
export default AppLayout;
