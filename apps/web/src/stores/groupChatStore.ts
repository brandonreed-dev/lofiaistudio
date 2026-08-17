import { create } from 'zustand';
import type { GroupChatRoom, GroupChatMessage } from '@lofiaistudio/shared';

interface GroupChatState {
  rooms: Record<string, GroupChatRoom>;
  currentRoomId: string | null;
  isGenerating: boolean;
  streamingContents: Record<string, string>;

  conversationRounds: number;
  setConversationRounds: (rounds: number) => void;
  currentSpeakingAgentId: string | null;
  currentRound: number;
  totalRounds: number;
  turnProgress: string;

  createRoom: (name: string, description: string, agentIds: string[]) => string;
  deleteRoom: (roomId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  addAgentToRoom: (roomId: string, agentId: string) => void;
  removeAgentFromRoom: (roomId: string, agentId: string) => void;
  addMessage: (roomId: string, message: GroupChatMessage) => void;
  updateLastMessage: (roomId: string, content: string, agentId?: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setStreamingContent: (agentId: string, content: string) => void;
  appendStreamingContent: (agentId: string, token: string) => void;
  clearStreamingContents: () => void;
  addReaction: (roomId: string, messageId: string, emoji: string) => void;
  removeReaction: (roomId: string, messageId: string, emoji: string) => void;

  setCurrentSpeakingAgent: (agentId: string | null) => void;
  setCurrentRound: (round: number) => void;
  setTotalRounds: (total: number) => void;
  setTurnProgress: (progress: string) => void;
  updateRoomFromServer: (roomId: string, finalMessages: GroupChatMessage[]) => void;
}

const ORCHESTRATOR_DEFAULTS = {
  conversationRounds: 1,
  currentSpeakingAgentId: null as string | null,
  currentRound: 0,
  totalRounds: 0,
  turnProgress: '',
};

export const useGroupChatStore = create<GroupChatState>((set, get) => ({
  rooms: {},
  currentRoomId: null,
  isGenerating: false,
  streamingContents: {},

  ...ORCHESTRATOR_DEFAULTS,

  setConversationRounds: (rounds) => set({ conversationRounds: Math.max(1, Math.min(rounds, 10)) }),

  setCurrentSpeakingAgent: (agentId) => set({ currentSpeakingAgentId: agentId }),

  setCurrentRound: (round) => set({ currentRound: round }),

  setTotalRounds: (total) => set({ totalRounds: total }),

  setTurnProgress: (progress) => set({ turnProgress: progress }),

  updateRoomFromServer: (roomId, finalMessages) => set((state) => {
    const room = state.rooms[roomId];
    if (!room) return state;
    return {
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, messages: finalMessages, updatedAt: new Date() },
      },
    };
  }),

  createRoom: (name, description, agentIds) => {
    const roomId = crypto.randomUUID();
    const room: GroupChatRoom = {
      id: roomId,
      name,
      description,
      agentIds,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      systemPrompt: '',
    };
    set((state) => ({
      rooms: { ...state.rooms, [roomId]: room },
      currentRoomId: roomId,
    }));
    return roomId;
  },

  deleteRoom: (roomId) => set((state) => {
    const { [roomId]: _, ...rest } = state.rooms;
    return {
      rooms: rest,
      currentRoomId: state.currentRoomId === roomId ? null : state.currentRoomId,
    };
  }),

  setCurrentRoom: (roomId) => set({ currentRoomId: roomId }),

  addAgentToRoom: (roomId, agentId) => set((state) => {
    const room = state.rooms[roomId];
    if (!room || room.agentIds.includes(agentId)) return state;
    return {
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, agentIds: [...room.agentIds, agentId], updatedAt: new Date() },
      },
    };
  }),

  removeAgentFromRoom: (roomId, agentId) => set((state) => {
    const room = state.rooms[roomId];
    if (!room) return state;
    return {
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, agentIds: room.agentIds.filter(id => id !== agentId), updatedAt: new Date() },
      },
    };
  }),

  addMessage: (roomId, message) => set((state) => {
    const room = state.rooms[roomId];
    if (!room) return state;
    return {
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, messages: [...room.messages, message], updatedAt: new Date() },
      },
    };
  }),

  updateLastMessage: (roomId, content, agentId) => set((state) => {
    const room = state.rooms[roomId];
    if (!room || room.messages.length === 0) return state;
    const messages = [...room.messages];
    let idx = messages.length - 1;
    if (agentId) {
      idx = messages.map((m, i) => m.agentId === agentId ? i : -1).filter(i => i >= 0).pop() ?? idx;
    }
    messages[idx] = { ...messages[idx], content };
    return {
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, messages, updatedAt: new Date() },
      },
    };
  }),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  setStreamingContent: (agentId, content) => set((state) => ({
    streamingContents: { ...state.streamingContents, [agentId]: content },
  })),

  appendStreamingContent: (agentId, token) => set((state) => ({
    streamingContents: {
      ...state.streamingContents,
      [agentId]: (state.streamingContents[agentId] || '') + token,
    },
  })),

  clearStreamingContents: () => set({ streamingContents: {} }),

  addReaction: (roomId, messageId, emoji) => set((state) => {
    const room = state.rooms[roomId];
    if (!room) return state;
    const messages = room.messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      const users = [...(reactions[emoji] || [])];
      if (!users.includes('self')) users.push('self');
      reactions[emoji] = users;
      return { ...msg, reactions };
    });
    return { rooms: { ...state.rooms, [roomId]: { ...room, messages } } };
  }),

  removeReaction: (roomId, messageId, emoji) => set((state) => {
    const room = state.rooms[roomId];
    if (!room) return state;
    const messages = room.messages.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(u => u !== 'self');
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }
      return { ...msg, reactions };
    });
    return { rooms: { ...state.rooms, [roomId]: { ...room, messages } } };
  }),
}));