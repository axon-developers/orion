import React from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Layers, 
  Settings, 
  Users, 
  Globe, 
  Sliders, 
  Boxes, 
  Workflow, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Activity
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { cn } from '../../lib/utils';
import { Button } from '../ui';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, clearAuth } = useAuthStore();
  const { appId } = useParams<{ appId?: string }>();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/applications', label: 'Applications', icon: Boxes },
    { to: '/executions', label: 'Executions', icon: Activity },
    { to: '/settings/profile', label: 'Settings', icon: Settings },
  ];

  const adminItems = [
    { to: '/global/env-configs', label: 'Global Configs', icon: Globe },
    { to: '/global/test-steps', label: 'Global Steps', icon: Workflow },
    { to: '/admin/users', label: 'User Management', icon: Users },
  ];

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen border-r border-border bg-card text-card-foreground transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center space-x-2 font-bold text-lg bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            <Layers className="h-6 w-6 text-primary" />
            <span>ORION</span>
          </div>
        )}
        {collapsed && <Layers className="h-6 w-6 text-primary mx-auto" />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                isActive ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}

        {/* Dynamic App Submenu */}
        {appId && !collapsed && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Selected App
            </p>
            <div className="mt-1 space-y-1">
              <NavLink
                to={`/applications/${appId}`}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Sliders className="h-4 w-4" />
                <span>Overview</span>
              </NavLink>
            </div>
          </div>
        )}

        {/* Admin Navigation */}
        {user?.role === 'ADMIN' && (
          <div className="mt-6 pt-6 border-t border-border/50">
            {!collapsed && (
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Administration
              </p>
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
                    isActive ? "bg-primary text-primary-foreground hover:bg-primary/95" : "text-muted-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer / User Profile & Logout */}
      <div className="p-4 border-t border-border flex flex-col space-y-3">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm text-primary">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-semibold truncate">{user?.fullName}</h4>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className={cn("w-full flex items-center justify-start space-x-3 hover:bg-destructive/10 hover:text-destructive text-muted-foreground", collapsed && "justify-center px-0")}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-20 -right-3 h-6 w-6 rounded-full border border-border bg-card text-card-foreground shadow-md flex items-center justify-center cursor-pointer hover:bg-accent z-50"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};
export default Sidebar;
