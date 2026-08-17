import { create } from 'zustand';
import type {
  ChatMessage,
  TextGenerationParams,
  ChatMemoryConfig,
  ToolCallInfo,
} from '@lofiaistudio/shared';
import { DEFAULT_TEXT_PARAMS, DEFAULT_MEMORY_CONFIG } from '@lofiaistudio/shared';

interface ChatState {
  sessions: Record<string, ChatMessage[]>;
  currentSessionId: string | null;
  systemPrompt: string;
  parameters: TextGenerationParams;
  isGenerating: boolean;
  streamingContent: string;

  memory: ChatMemoryConfig;
  setMemory: (config: Partial<ChatMemoryConfig>) => void;

  sttModel: string | null;
  setSttModel: (model: string | null) => void;
  ttsModel: string | null;
  setTtsModel: (model: string | null) => void;

  addReaction: (sessionId: string, messageId: string, emoji: string) => void;
  removeReaction: (sessionId: string, messageId: string, emoji: string) => void;
  editMessage: (sessionId: string, messageId: string, newContent: string) => void;

  setToolCalls: (sessionId: string, messageId: string, toolCalls: ToolCallInfo[]) => void;
  updateToolCall: (sessionId: string, messageId: string, toolName: string, update: Partial<ToolCallInfo>) => void;

  serverLoaded: boolean;
  hydrateFromServer: () => Promise<void>;

  splitActive: boolean;
  setSplitActive: (active: boolean) => void;
  splitSessionId: string | null;
  setSplitSessionId: (id: string | null) => void;

  createSession: () => Promise<string>;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: ChatMessage) => Promise<void>;
  updateLastMessage: (sessionId: string, content: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setParameters: (params: Partial<TextGenerationParams>) => void;
  setIsGenerating: (generating: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (token: string) => void;
  clearStreamingContent: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: {},
  currentSessionId: null,
  serverLoaded: false,

  splitActive: false,
  setSplitActive: (active) => set({ splitActive: active }),
  splitSessionId: null,
  setSplitSessionId: (id) => set({ splitSessionId: id }),

  hydrateFromServer: async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      if (!res.ok) return;
      const json = await res.json() as { success: boolean; data: Array<{ id: string }> };
      if (!json.success) return;

      const sessionEntries: Array<[string, ChatMessage[]]> = [];
      for (const s of json.data) {
        const msgRes = await fetch(`/api/chat/sessions/${s.id}/messages`);
        if (!msgRes.ok) continue;
        const msgJson = await msgRes.json() as { success: boolean; data: ChatMessage[] };
        if (!msgJson.success) continue;
        sessionEntries.push([s.id, msgJson.data]);
      }

      set((state) => {
        const newSessions = { ...state.sessions };
        for (const [id, msgs] of sessionEntries) {
          newSessions[id] = msgs;
        }
        return { sessions: newSessions, serverLoaded: true };
      });
    } catch (err) {
      console.warn('Failed to hydrate chat from server:', err);
    }
  },
  systemPrompt: '',
  parameters: DEFAULT_TEXT_PARAMS,
  isGenerating: false,
  streamingContent: '',

  memory: { ...DEFAULT_MEMORY_CONFIG, enabled: false, mode: 'window', windowSize: 50, summaryFrequency: 30 },
  setMemory: (config) => set((state) => ({
    memory: { ...state.memory, ...config },
  })),

  sttModel: null,
  setSttModel: (model) => set({ sttModel: model }),
  ttsModel: null,
  setTtsModel: (model) => set({ ttsModel: model }),

  addReaction: (sessionId, messageId, emoji) => set((state) => {
    const messages = state.sessions[sessionId];
    if (!messages) return state;
    const updatedMessages = messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      const users = [...(reactions[emoji] || [])];
      if (!users.includes('self')) users.push('self');
      reactions[emoji] = users;
      return { ...msg, reactions };
    });
    return { sessions: { ...state.sessions, [sessionId]: updatedMessages } };
  }),

  removeReaction: (sessionId, messageId, emoji) => set((state) => {
    const messages = state.sessions[sessionId];
    if (!messages) return state;
    const updatedMessages = messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(u => u !== 'self');
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }
      return { ...msg, reactions };
    });
    return { sessions: { ...state.sessions, [sessionId]: updatedMessages } };
  }),

  editMessage: (sessionId, messageId, newContent) => set((state) => {
    const messages = state.sessions[sessionId];
    if (!messages) return state;
    const updatedMessages = messages.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
    );
    return { sessions: { ...state.sessions, [sessionId]: updatedMessages } };
  }),

  setToolCalls: (sessionId, messageId, toolCalls) => set((state) => {
    const messages = state.sessions[sessionId];
    if (!messages) return state;
    const updatedMessages = messages.map(msg =>
      msg.id === messageId ? { ...msg, toolCalls } : msg
    );
    return { sessions: { ...state.sessions, [sessionId]: updatedMessages } };
  }),

  updateToolCall: (sessionId, messageId, toolName, update) => set((state) => {
    const messages = state.sessions[sessionId];
    if (!messages) return state;
    const updatedMessages = messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const toolCalls = (msg.toolCalls || []).map(tc =>
        tc.name === toolName ? { ...tc, ...update } : tc
      );
      return { ...msg, toolCalls };
    });
    return { sessions: { ...state.sessions, [sessionId]: updatedMessages } };
  }),

  createSession: async () => {
    const sessionId = crypto.randomUUID();
    set((state) => ({
      sessions: { ...state.sessions, [sessionId]: [] },
      currentSessionId: sessionId,
    }));
    try {
      await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, name: 'New Chat', modelId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
      });
    } catch { /* ignore */ }
    return sessionId;
  },

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  addMessage: async (sessionId, message) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: [...(state.sessions[sessionId] || []), message],
      },
    }));
    try {
      await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...message,
          timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp,
        }),
      });
    } catch { /* ignore */ }
  },

  updateLastMessage: (sessionId, content) => set((state) => {
    const messages = state.sessions[sessionId] || [];
    if (messages.length > 0) {
      const updatedMessages = [...messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...updatedMessages[updatedMessages.length - 1],
        content,
      };
      return {
        sessions: { ...state.sessions, [sessionId]: updatedMessages },
      };
    }
    return state;
  }),

  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
  setParameters: (params) => set((state) => ({
    parameters: { ...state.parameters, ...params },
  })),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (token) => set((state) => ({
    streamingContent: state.streamingContent + token,
  })),
  clearStreamingContent: () => set({ streamingContent: '' }),
}));