import { create } from 'zustand';
import { UserInfo } from '../types/auth';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  setAuth: (user: UserInfo, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('orion_access_token', accessToken);
    localStorage.setItem('orion_refresh_token', refreshToken);
    localStorage.setItem('orion_user', JSON.stringify(user));
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('orion_access_token');
    localStorage.removeItem('orion_refresh_token');
    localStorage.removeItem('orion_user');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  checkAuth: () => {
    const accessToken = localStorage.getItem('orion_access_token');
    const userStr = localStorage.getItem('orion_user');
    if (accessToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, accessToken, isAuthenticated: true });
      } catch {
        // Corrupt localStorage -> clear
        localStorage.removeItem('orion_access_token');
        localStorage.removeItem('orion_refresh_token');
        localStorage.removeItem('orion_user');
        set({ user: null, accessToken: null, isAuthenticated: false });
      }
    }
  },
}));
