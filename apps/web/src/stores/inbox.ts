import { create } from 'zustand';
import type { InboxAccount, InboxMessage, InboxFolder, InboxSummary } from '@lofiaistudio/shared';
import { api } from '@/lib/api';

type InboxAccountMap = Record<string, InboxAccount>;
type InboxMessageMap = Record<string, InboxMessage[]>;

interface InboxState {
  accounts: InboxAccount[];
  messages: InboxMessageMap;
  selectedAccountId: string | null;
  folder: InboxFolder;
  searchQuery: string;
  isLoading: boolean;
  summary: InboxSummary | null;

  loadAccounts: () => Promise<void>;
  loadMessages: (accountId?: string, folder?: InboxFolder) => Promise<void>;
  setSelectedAccount: (accountId: string | null) => void;
  setFolder: (folder: InboxFolder) => void;
  setSearchQuery: (query: string) => void;
  markRead: (messageId: string, read: boolean) => Promise<void>;
  toggleStar: (messageId: string, starred: boolean) => Promise<void>;
  moveMessage: (messageId: string, folder: InboxFolder) => Promise<void>;
  loadSummary: () => Promise<void>;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  accounts: [],
  messages: {},
  selectedAccountId: null,
  folder: 'inbox',
  searchQuery: '',
  isLoading: false,
  summary: null,

  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const accounts = await api<InboxAccount[]>('/api/inbox/accounts');
      set({ accounts, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMessages: async (accountId, folder) => {
    set({ isLoading: true });
    try {
      const targetAccount = accountId ?? get().selectedAccountId;
      const targetFolder = folder ?? get().folder;
      const qs = new URLSearchParams();
      if (targetAccount) qs.set('accountId', targetAccount);
      qs.set('folder', targetFolder);
      const messages = await api<InboxMessage[]>(`/api/inbox/messages?${qs.toString()}`);
      const key = targetAccount ?? 'all';
      set((state) => ({
        messages: { ...state.messages, [key]: messages },
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  setSelectedAccount: (accountId) => set({ selectedAccountId: accountId }),
  setFolder: (folder) => set({ folder }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  markRead: async (messageId, read) => {
    await api(`/api/inbox/messages/${messageId}/read`, {
      method: 'POST',
      body: JSON.stringify({ read }),
    });
    set((state) => ({
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([key, list]) => [
          key,
          list.map((m) => (m.id === messageId ? { ...m, read } : m)),
        ])
      ),
    }));
  },

  toggleStar: async (messageId, starred) => {
    await api(`/api/inbox/messages/${messageId}/star`, {
      method: 'POST',
      body: JSON.stringify({ starred }),
    });
    set((state) => ({
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([key, list]) => [
          key,
          list.map((m) => (m.id === messageId ? { ...m, starred } : m)),
        ])
      ),
    }));
  },

  moveMessage: async (messageId, folder) => {
    await api(`/api/inbox/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ folder }),
    });
    set((state) => ({
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([key, list]) => [
          key,
          list
            .filter((m) => m.id !== messageId)
            .map((m) => (m.id === messageId ? { ...m, folder } : m)),
        ])
      ),
    }));
  },

  loadSummary: async () => {
    try {
      const summary = await api<InboxSummary>('/api/inbox/summary');
      set({ summary });
    } catch {
      // ignore
    }
  },
}));