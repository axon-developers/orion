import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [
        {
          id: 'n1',
          title: 'Welcome to ORION',
          message: 'Explore visual test automation, DB validator, and browser recording tools.',
          type: 'info',
          timestamp: new Date().toISOString(),
          read: false
        }
      ],

      addNotification: (title, message, type = 'info') => {
        const newNotif: NotificationItem = {
          id: Math.random().toString(36).substring(2, 9),
          title,
          message,
          type,
          timestamp: new Date().toISOString(),
          read: false
        };
        set((state) => ({
          notifications: [newNotif, ...state.notifications].slice(0, 50)
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) => 
            n.id === id ? { ...n, read: true } : n
          )
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true }))
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      }
    }),
    {
      name: 'orion-notifications-storage'
    }
  )
);
