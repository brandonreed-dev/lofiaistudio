import { create } from 'zustand';
import type { VideoGenerationParams } from '@lofiaistudio/shared';
import { DEFAULT_VIDEO_PARAMS } from '@lofiaistudio/shared';
import { readJsonStorage, writeJsonStorage } from '@/lib/storage';

export interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  params: VideoGenerationParams;
  modelId: string;
  timestamp: Date;
  duration: number;
  frames: number;
}

export type VideoResult = { type: 'video'; data: GeneratedVideo };

export interface SavedVideoConfig {
  id: string;
  name: string;
  prompt: string;
  negativePrompt?: string;
  params: VideoGenerationParams;
  modelId: string;
  createdAt: Date;
}

export interface VideoPromptTemplate {
  id: string;
  name: string;
  prompt: string;
  negativePrompt?: string;
  createdAt: Date;
}

export type SortOption = 'newest' | 'oldest' | 'duration-asc' | 'duration-desc' | 'frames-asc' | 'frames-desc';
export type Density = 'compact' | 'comfortable' | 'spacious';

interface VideoState {
  // Input state
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt: string;
  setNegativePrompt: (prompt: string) => void;
  params: VideoGenerationParams;
  setParams: (params: Partial<VideoGenerationParams>) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  
  // Current results
  videos: GeneratedVideo[];
  addVideo: (video: GeneratedVideo) => void;
  clearVideos: () => void;
  selectedVideo: GeneratedVideo | null;
  setSelectedVideo: (video: GeneratedVideo | null) => void;
  
  // History (persistent)
  history: GeneratedVideo[];
  addToHistory: (video: GeneratedVideo) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  
  // Starring
  starredIds: Set<string>;
  toggleStar: (id: string) => void;
  isStarred: (id: string) => boolean;
  
  // Tags
  videoTags: Record<string, string[]>;
  addTagToVideo: (id: string, tag: string) => void;
  removeTagFromVideo: (id: string, tag: string) => void;
  getVideoTags: (id: string) => string[];
  
  // Search & sort
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  showStarsOnly: boolean;
  setShowStarsOnly: (show: boolean) => void;
  
  // Saved configs
  savedConfigs: SavedVideoConfig[];
  saveConfig: (name: string, prompt: string, negativePrompt: string | undefined, params: VideoGenerationParams, modelId: string) => void;
  deleteConfig: (id: string) => void;
  loadConfigIntoGenerator: (config: SavedVideoConfig) => void;
  
  // Prompt templates
  promptTemplates: VideoPromptTemplate[];
  addPromptTemplate: (name: string, prompt: string, negativePrompt?: string) => void;
  deletePromptTemplate: (id: string) => void;
  
  // Density and view
  density: Density;
  setDensity: (density: Density) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  
  // Lightbox
  lightboxZoom: number;
  setLightboxZoom: (zoom: number) => void;
  lightboxPan: { x: number; y: number };
  setLightboxPan: (pan: { x: number; y: number }) => void;
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;
  panStart: { x: number; y: number };
  setPanStart: (start: { x: number; y: number }) => void;
  
  // Selected result for detail
  selectedResult: VideoResult | null;
  setSelectedResult: (result: VideoResult | null) => void;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  return readJsonStorage<T>(`localai-video-${key}`, fallback);
}

function saveToStorage(key: string, value: unknown): void {
  writeJsonStorage(`localai-video-${key}`, value);
}

export const useVideoStore = create<VideoState>((set, get) => ({
  // Input state
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
  negativePrompt: '',
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  params: DEFAULT_VIDEO_PARAMS,
  setParams: (newParams) =>
    set((state) => ({
      params: { ...state.params, ...newParams },
    })),
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  
  // Current results
  videos: [],
  addVideo: (video) =>
    set((state) => ({
      videos: [video, ...state.videos],
      selectedVideo: state.selectedVideo ?? video,
    })),
  clearVideos: () => set({ videos: [], selectedVideo: null }),
  selectedVideo: null,
  setSelectedVideo: (selectedVideo) => set({ selectedVideo }),
  
  // History (persistent)
  history: loadFromStorage<GeneratedVideo[]>('history', []),
  addToHistory: (video) => {
    set((state) => {
      const newHistory = [video, ...state.history].slice(0, 200);
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
      const newHistory = state.history.filter((v) => v.id !== id);
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
  videoTags: loadFromStorage<Record<string, string[]>>('tags', {}),
  addTagToVideo: (id, tag) => {
    set((state) => {
      const existing = state.videoTags[id] || [];
      if (existing.includes(tag)) return state;
      const newTags = { ...state.videoTags, [id]: [...existing, tag] };
      saveToStorage('tags', newTags);
      return { videoTags: newTags };
    });
  },
  removeTagFromVideo: (id, tag) => {
    set((state) => {
      const existing = state.videoTags[id] || [];
      const newTags = { ...state.videoTags, [id]: existing.filter((t) => t !== tag) };
      saveToStorage('tags', newTags);
      return { videoTags: newTags };
    });
  },
  getVideoTags: (id) => get().videoTags[id] || [],
  
  // Search & sort
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  sortBy: 'newest',
  setSortBy: (sort) => set({ sortBy: sort }),
  showStarsOnly: false,
  setShowStarsOnly: (show) => set({ showStarsOnly: show }),
  
  // Saved configs
  savedConfigs: loadFromStorage<SavedVideoConfig[]>('savedConfigs', []),
  saveConfig: (name, prompt, negativePrompt, params, modelId) => {
    const config: SavedVideoConfig = {
      id: crypto.randomUUID(),
      name,
      prompt,
      negativePrompt,
      params: { ...params },
      modelId,
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
      prompt: config.prompt,
      negativePrompt: config.negativePrompt || '',
      params: { ...config.params },
    });
  },
  
  // Prompt templates
  promptTemplates: loadFromStorage<VideoPromptTemplate[]>('promptTemplates', []),
  addPromptTemplate: (name, prompt, negativePrompt) => {
    const template: VideoPromptTemplate = {
      id: crypto.randomUUID(),
      name,
      prompt,
      negativePrompt,
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
  
  // Density and view
  density: 'comfortable',
  setDensity: (density) => set({ density }),
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),
  
  // Lightbox
  lightboxZoom: 1,
  setLightboxZoom: (lightboxZoom) => set({ lightboxZoom }),
  lightboxPan: { x: 0, y: 0 },
  setLightboxPan: (lightboxPan) => set({ lightboxPan }),
  isPanning: false,
  setIsPanning: (isPanning) => set({ isPanning }),
  panStart: { x: 0, y: 0 },
  setPanStart: (panStart) => set({ panStart }),
  
  // Selected result for detail
  selectedResult: null,
  setSelectedResult: (selectedResult) => set({ selectedResult }),
}));
