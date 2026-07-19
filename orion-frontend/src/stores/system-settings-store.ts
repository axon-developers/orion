import { create } from 'zustand';
import api from '../lib/api';

interface SystemSettingsState {
  settings: Record<string, string>;
  isLoading: boolean;
  fetchPublicSettings: () => Promise<void>;
  getSetting: (key: string, defaultValue: string) => string;
  getSettingInt: (key: string, defaultValue: number) => number;
}

export const useSystemSettingsStore = create<SystemSettingsState>((set, get) => ({
  settings: {},
  isLoading: false,

  fetchPublicSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/admin/settings/public');
      set({ settings: res.data, isLoading: false });
    } catch (err) {
      console.error('Failed to load public settings:', err);
      set({ isLoading: false });
    }
  },

  getSetting: (key: string, defaultValue: string) => {
    return get().settings[key] || defaultValue;
  },

  getSettingInt: (key: string, defaultValue: number) => {
    const val = get().settings[key];
    if (val === undefined) return defaultValue;
    const num = parseInt(val);
    return isNaN(num) ? defaultValue : num;
  }
}));
