import { create } from 'zustand';
import type { AppSettings } from '@lofiaistudio/shared';
import { api } from '@/lib/api';

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await api<AppSettings>('/api/settings');
      set({ settings, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch settings',
        isLoading: false
      });
    }
  },

  updateSettings: async (newSettings) => {
    set({ isLoading: true, error: null });
    try {
      const settings = await api<AppSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      });
      set({ settings, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update settings',
        isLoading: false
      });
    }
  },
}));
