import { create } from 'zustand';
import type { RuntimeStatus } from '@lofiaistudio/shared';
import { api } from '@/lib/api';

interface RuntimeState {
  runtimes: RuntimeStatus[];
  setRuntimes: (runtimes: RuntimeStatus[]) => void;
  updateRuntime: (type: string, status: Partial<RuntimeStatus>) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  fetchRuntimes: () => Promise<void>;
  connectRuntimes: () => Promise<void>;
}

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  runtimes: [],
  setRuntimes: (runtimes) => set({ runtimes }),
  updateRuntime: (type, status) => set((state) => ({
    runtimes: state.runtimes.map((r) =>
      r.type === type ? { ...r, ...status } : r
    ),
  })),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error }),

  fetchRuntimes: async () => {
    set({ isLoading: true, error: null });
    try {
      const runtimes = await api<RuntimeStatus[]>('/api/runtimes');
      set({ runtimes, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch runtimes',
        isLoading: false
      });
    }
  },

  connectRuntimes: async () => {
    set({ isLoading: true, error: null });
    try {
      const runtimes = await api<RuntimeStatus[]>('/api/runtimes/connect', { method: 'POST' });
      set({ runtimes, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to connect runtimes',
        isLoading: false
      });
    }
  },
}));
