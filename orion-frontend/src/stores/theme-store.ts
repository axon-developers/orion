import { create } from 'zustand';

export interface AccentColor {
  id: string;
  name: string;
  darkHsl: string;
  lightHsl: string;
  colorPreview: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'violet', name: 'Violet', darkHsl: '250 89% 65%', lightHsl: '250 89% 60%', colorPreview: '#8b5cf6' },
  { id: 'emerald', name: 'Emerald', darkHsl: '142 71% 45%', lightHsl: '142 76% 36%', colorPreview: '#10b981' },
  { id: 'cyan', name: 'Cyan', darkHsl: '189 94% 43%', lightHsl: '189 94% 40%', colorPreview: '#06b6d4' },
  { id: 'rose', name: 'Rose', darkHsl: '347 77% 50%', lightHsl: '347 87% 44%', colorPreview: '#f43f5e' },
  { id: 'amber', name: 'Amber', darkHsl: '38 92% 50%', lightHsl: '38 92% 45%', colorPreview: '#f59e0b' },
  { id: 'blue', name: 'Blue', darkHsl: '221 83% 53%', lightHsl: '221 83% 58%', colorPreview: '#3b82f6' }
];

interface ThemeState {
  theme: 'dark' | 'light';
  accentColor: string;
  setTheme: (theme: 'dark' | 'light') => void;
  setAccentColor: (colorId: string) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  accentColor: 'violet',

  setTheme: (theme) => {
    localStorage.setItem('orion-theme', theme);
    set({ theme });
    get().initialize();
  },

  setAccentColor: (colorId) => {
    localStorage.setItem('orion-accent-color', colorId);
    set({ accentColor: colorId });
    get().initialize();
  },

  initialize: () => {
    const savedTheme = (localStorage.getItem('orion-theme') as 'dark' | 'light') || 'dark';
    const savedAccent = localStorage.getItem('orion-accent-color') || 'violet';

    set({ theme: savedTheme, accentColor: savedAccent });

    const root = window.document.documentElement;

    if (savedTheme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }

    const chosenColor = ACCENT_COLORS.find(c => c.id === savedAccent) || ACCENT_COLORS[0];
    const hslValue = savedTheme === 'dark' ? chosenColor.darkHsl : chosenColor.lightHsl;

    root.style.setProperty('--primary', hslValue);
    root.style.setProperty('--accent', hslValue);
    root.style.setProperty('--ring', hslValue);
  }
}));
export default useThemeStore;
