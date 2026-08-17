import { create } from 'zustand';

export type NeovimBuffer = {
  id: string;
  name: string;
  modifiable: boolean;
  modified: boolean;
  lineCount: number;
  content: string[];
};

export type NeovimMode = 'normal' | 'insert' | 'visual' | 'replace';

export interface NeovimState {
  connected: boolean;
  host?: string;
  buffers: NeovimBuffer[];
  activeBufferId: string | null;
  mode: NeovimMode;
  cursor: { line: number; column: number };
  lastError: string | null;
  setConnected: (connected: boolean, host?: string) => void;
  setBuffers: (buffers: NeovimBuffer[]) => void;
  setActiveBuffer: (id: string | null) => void;
  updateBuffer: (id: string, content: string[]) => void;
  setMode: (mode: NeovimMode) => void;
  setCursor: (cursor: { line: number; column: number }) => void;
  setLastError: (error: string | null) => void;
}

export const useNeovimStore = create<NeovimState>((set) => ({
  connected: false,
  buffers: [],
  activeBufferId: null,
  mode: 'normal',
  cursor: { line: 1, column: 1 },
  lastError: null,
  setConnected: (connected, host) => set({ connected, host }),
  setBuffers: (buffers) => set({ buffers }),
  setActiveBuffer: (id) => set({ activeBufferId: id }),
  updateBuffer: (id, content) =>
    set((state) => ({
      buffers: state.buffers.map((b) => (b.id === id ? { ...b, content, modified: true } : b)),
    })),
  setMode: (mode) => set({ mode }),
  setCursor: (cursor) => set({ cursor }),
  setLastError: (lastError) => set({ lastError }),
}));