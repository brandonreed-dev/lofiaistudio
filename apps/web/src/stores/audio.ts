import { create } from 'zustand';
import type { AudioParams } from '@lofiaistudio/shared';
import { readJsonStorage, writeJsonStorage } from '@/lib/storage';

export type AudioMode = 'stt' | 'tts';
export type SortOption = 'newest' | 'oldest' | 'duration-asc' | 'duration-desc';
export type Density = 'compact' | 'comfortable' | 'spacious';

export interface TranscriptionResult {
  id: string;
  text: string;
  duration: number;
  audioFileName: string;
  timestamp: Date;
  language?: string;
}

export interface SynthesisResult {
  id: string;
  text: string;
  audioUrl: string;
  duration: number;
  timestamp: Date;
  voice: string;
}

export type AudioResult = 
  | { type: 'transcription'; data: TranscriptionResult }
  | { type: 'synthesis'; data: SynthesisResult };

export interface SavedAudioConfig {
  id: string;
  name: string;
  mode: AudioMode;
  params: AudioParams;
  sttModelId?: string | null;
  ttsModelId?: string | null;
  text?: string;
  createdAt: Date;
}

export interface AudioPromptTemplate {
  id: string;
  name: string;
  text: string;
  createdAt: Date;
}

interface AudioState {
  // Mode
  mode: AudioMode;
  setMode: (mode: AudioMode) => void;
  selectedSttModel: string | null;
  setSelectedSttModel: (modelId: string | null) => void;
  selectedTtsModel: string | null;
  setSelectedTtsModel: (modelId: string | null) => void;
  
  // STT state
  audioFile: File | null;
  audioDataUrl: string | null;
  isRecording: boolean;
  setAudioFile: (file: File | null) => void;
  setAudioDataUrl: (url: string | null) => void;
  setIsRecording: (recording: boolean) => void;
  
  // TTS state
  text: string;
  setText: (text: string) => void;
  
  // Parameters
  params: AudioParams;
  setParams: (params: Partial<AudioParams>) => void;
  
  // Processing state
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  
  // Results (current session)
  transcriptions: TranscriptionResult[];
  addTranscription: (result: TranscriptionResult) => void;
  clearTranscriptions: () => void;
  
  syntheses: SynthesisResult[];
  addSynthesis: (result: SynthesisResult) => void;
  clearSyntheses: () => void;
  
  // History (persistent)
  history: AudioResult[];
  addToHistory: (result: AudioResult) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  
  // Starring
  starredIds: Set<string>;
  toggleStar: (id: string) => void;
  isStarred: (id: string) => boolean;
  
  // Tags
  imageTags: Record<string, string[]>;
  addTagToResult: (id: string, tag: string) => void;
  removeTagFromResult: (id: string, tag: string) => void;
  getResultTags: (id: string) => string[];
  
  // Search & sort
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  showStarsOnly: boolean;
  setShowStarsOnly: (show: boolean) => void;
  
  // Saved configs
  savedConfigs: SavedAudioConfig[];
  saveConfig: (name: string, mode: AudioMode, params: AudioParams, sttModelId?: string | null, ttsModelId?: string | null, text?: string) => void;
  deleteConfig: (id: string) => void;
  loadConfigIntoGenerator: (config: SavedAudioConfig) => void;
  
  // Prompt templates
  promptTemplates: AudioPromptTemplate[];
  addPromptTemplate: (name: string, text: string) => void;
  deletePromptTemplate: (id: string) => void;
  
  // Audio playback
  currentlyPlaying: string | null;
  setCurrentlyPlaying: (id: string | null) => void;
  
  // Selected detail
  selectedResult: AudioResult | null;
  setSelectedResult: (result: AudioResult | null) => void;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  return readJsonStorage<T>(`localai-audio-${key}`, fallback);
}

function saveToStorage(key: string, value: unknown): void {
  writeJsonStorage(`localai-audio-${key}`, value);
}

export const useAudioStore = create<AudioState>((set, get) => ({
  // Mode
  mode: 'stt',
  setMode: (mode) => set({ mode }),
  selectedSttModel: null,
  setSelectedSttModel: (modelId) => set({ selectedSttModel: modelId }),
  selectedTtsModel: null,
  setSelectedTtsModel: (modelId) => set({ selectedTtsModel: modelId }),
  
  // STT state
  audioFile: null,
  audioDataUrl: null,
  isRecording: false,
  setAudioFile: (file) => set({ audioFile: file }),
  setAudioDataUrl: (url) => set({ audioDataUrl: url }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  
  // TTS state
  text: '',
  setText: (text) => set({ text }),
  
  // Parameters
  params: {
    language: 'auto',
    translate: false,
    speed: 1.0,
    pitch: 1.0,
    outputFormat: 'wav',
  },
  setParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams },
  })),
  
  // Processing state
  isProcessing: false,
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  
  // Results (current session)
  transcriptions: [],
  addTranscription: (result) => {
    set((state) => ({
      transcriptions: [result, ...state.transcriptions],
    }));
    get().addToHistory({ type: 'transcription', data: result });
  },
  clearTranscriptions: () => set({ transcriptions: [] }),
  
  syntheses: [],
  addSynthesis: (result) => {
    set((state) => ({
      syntheses: [result, ...state.syntheses],
    }));
    get().addToHistory({ type: 'synthesis', data: result });
  },
  clearSyntheses: () => set({ syntheses: [] }),
  
  // History (persistent)
  history: loadFromStorage<AudioResult[]>('history', []),
  addToHistory: (result) => {
    set((state) => {
      const newHistory = [result, ...state.history].slice(0, 500);
      saveToStorage('history', newHistory);
      return { history: newHistory };
    });
  },
  clearHistory: () => {
    set({ history: [] });
    saveToStorage('history', []);
  },
  removeFromHistory: (id) => {
    set((state) => {
      const newHistory = state.history.filter(
        (r) => (r.type === 'transcription' ? r.data.id : r.data.id) !== id
      );
      saveToStorage('history', newHistory);
      return { history: newHistory };
    });
  },
  
  // Starring
  starredIds: new Set(loadFromStorage<string[]>('starredIds', [])),
  toggleStar: (id) => {
    set((state) => {
      const newSet = new Set(state.starredIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      saveToStorage('starredIds', Array.from(newSet));
      return { starredIds: newSet };
    });
  },
  isStarred: (id) => get().starredIds.has(id),
  
  // Tags
  imageTags: loadFromStorage<Record<string, string[]>>('tags', {}),
  addTagToResult: (id, tag) => {
    set((state) => {
      const existing = state.imageTags[id] || [];
      if (existing.includes(tag)) return state;
      const newTags = { ...state.imageTags, [id]: [...existing, tag] };
      saveToStorage('tags', newTags);
      return { imageTags: newTags };
    });
  },
  removeTagFromResult: (id, tag) => {
    set((state) => {
      const existing = state.imageTags[id] || [];
      const newTags = { ...state.imageTags, [id]: existing.filter((t) => t !== tag) };
      saveToStorage('tags', newTags);
      return { imageTags: newTags };
    });
  },
  getResultTags: (id) => get().imageTags[id] || [],
  
  // Search & sort
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  sortBy: 'newest',
  setSortBy: (sort) => set({ sortBy: sort }),
  showStarsOnly: false,
  setShowStarsOnly: (show) => set({ showStarsOnly: show }),
  
  // Saved configs
  savedConfigs: loadFromStorage<SavedAudioConfig[]>('savedConfigs', []),
  saveConfig: (name, mode, params, sttModelId, ttsModelId, text) => {
    const config: SavedAudioConfig = {
      id: crypto.randomUUID(),
      name,
      mode,
      params: { ...params },
      sttModelId,
      ttsModelId,
      text,
      createdAt: new Date(),
    };
    set((state) => {
      const newConfigs = [config, ...state.savedConfigs];
      saveToStorage('savedConfigs', newConfigs);
      return { savedConfigs: newConfigs };
    });
  },
  deleteConfig: (id) => {
    set((state) => {
      const newConfigs = state.savedConfigs.filter((c) => c.id !== id);
      saveToStorage('savedConfigs', newConfigs);
      return { savedConfigs: newConfigs };
    });
  },
  loadConfigIntoGenerator: (config) => {
    set({
      mode: config.mode,
      params: { ...config.params },
      selectedSttModel: config.sttModelId ?? null,
      selectedTtsModel: config.ttsModelId ?? null,
      text: config.text || '',
    });
  },
  
  // Prompt templates
  promptTemplates: loadFromStorage<AudioPromptTemplate[]>('promptTemplates', []),
  addPromptTemplate: (name, text) => {
    const template: AudioPromptTemplate = {
      id: crypto.randomUUID(),
      name,
      text,
      createdAt: new Date(),
    };
    set((state) => {
      const newTemplates = [template, ...state.promptTemplates];
      saveToStorage('promptTemplates', newTemplates);
      return { promptTemplates: newTemplates };
    });
  },
  deletePromptTemplate: (id) => {
    set((state) => {
      const newTemplates = state.promptTemplates.filter((t) => t.id !== id);
      saveToStorage('promptTemplates', newTemplates);
      return { promptTemplates: newTemplates };
    });
  },
  
  // Audio playback
  currentlyPlaying: null,
  setCurrentlyPlaying: (id) => set({ currentlyPlaying: id }),
  
  // Selected detail
  selectedResult: null,
  setSelectedResult: (result) => set({ selectedResult: result }),
}));
