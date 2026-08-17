import { create } from 'zustand';
import type { ImageGenerationParams } from '@lofiaistudio/shared';
import { DEFAULT_IMAGE_PARAMS } from '@lofiaistudio/shared';
import { readJsonStorage, writeJsonStorage } from '@/lib/storage';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  params: ImageGenerationParams;
  modelId: string;
  timestamp: Date;
  seed?: number;
}

export interface SavedImageConfig {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  mode: 'text-to-image' | 'image-to-image';
  params: ImageGenerationParams;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  negativePrompt?: string;
  createdAt: string;
}

export interface AspectRatioPreset {
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { label: '1:1', width: 1024, height: 1024 },
  { label: '16:9', width: 1344, height: 768 },
  { label: '9:16', width: 768, height: 1344 },
  { label: '4:3', width: 1152, height: 896 },
  { label: '3:2', width: 1216, height: 832 },
  { label: '21:9', width: 1536, height: 640 },
];

export interface PresetConfig {
  id: string;
  name: string;
  label: string;
  params: Partial<ImageGenerationParams>;
}

export const PRESET_CONFIGS: PresetConfig[] = [
  { id: 'sdxl-quality', name: 'SDXL Quality', label: 'Quality', params: { steps: 28, cfgScale: 7.5, sampler: 'dpmpp_2m', scheduler: 'karras', batchSize: 1 } },
  { id: 'fast-draft', name: 'Fast Draft', label: 'Fast', params: { steps: 12, cfgScale: 6, sampler: 'euler', scheduler: 'normal', batchSize: 1 } },
  { id: 'anime-style', name: 'Anime Style', label: 'Anime', params: { steps: 22, cfgScale: 7, sampler: 'dpmpp_2m_sde', scheduler: 'karras', batchSize: 1 } },
];

export type Density = 'compact' | 'comfortable' | 'spacious';

const CONFIGS_STORAGE_KEY = 'localai-image-configs';
const TEMPLATES_STORAGE_KEY = 'localai-prompt-templates';
const TAGS_STORAGE_KEY = 'localai-image-tags';

function loadConfigs(): SavedImageConfig[] {
  return readJsonStorage<SavedImageConfig[]>(CONFIGS_STORAGE_KEY, []);
}

function persistConfigs(configs: SavedImageConfig[]) {
  writeJsonStorage(CONFIGS_STORAGE_KEY, configs);
}

function loadTemplates(): PromptTemplate[] {
  return readJsonStorage<PromptTemplate[]>(TEMPLATES_STORAGE_KEY, []);
}

function persistTemplates(templates: PromptTemplate[]) {
  writeJsonStorage(TEMPLATES_STORAGE_KEY, templates);
}

function loadTags(): Record<string, string[]> {
  return readJsonStorage<Record<string, string[]>>(TAGS_STORAGE_KEY, {});
}

function persistTags(tags: Record<string, string[]>) {
  writeJsonStorage(TAGS_STORAGE_KEY, tags);
}

export type SortOption = 'newest' | 'oldest' | 'seed-asc' | 'seed-desc' | 'resolution-asc' | 'resolution-desc' | 'steps-asc' | 'steps-desc';

interface ImageState {
  // Parameters
  params: ImageGenerationParams;
  setParams: (params: Partial<ImageGenerationParams>) => void;
  
  // Prompts
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt: string;
  setNegativePrompt: (prompt: string) => void;
  
  // Mode
  mode: 'text-to-image' | 'image-to-image';
  setMode: (mode: 'text-to-image' | 'image-to-image') => void;
  
  // Reference image for img2img
  referenceImage: string | null;
  setReferenceImage: (image: string | null) => void;
  referenceImageFile: File | null;
  setReferenceImageFile: (file: File | null) => void;
  
  // Generation state
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  
  // Generated images
  images: GeneratedImage[];
  addImages: (images: GeneratedImage[]) => void;
  clearImages: () => void;
  
  // Selected image for viewing
  selectedImage: GeneratedImage | null;
  setSelectedImage: (image: GeneratedImage | null) => void;
  
  // Gallery view
  viewMode: 'grid' | 'single';
  setViewMode: (mode: 'grid' | 'single') => void;
  density: Density;
  setDensity: (density: Density) => void;

  // Starred images
  starredImageIds: Set<string>;
  toggleStar: (id: string) => void;
  isStarred: (id: string) => boolean;
  
  // Prompt templates
  promptTemplates: PromptTemplate[];
  addPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt'>) => void;
  deletePromptTemplate: (id: string) => void;
  
  // Image tags
  imageTags: Record<string, string[]>;
  addTagToImage: (imageId: string, tag: string) => void;
  removeTagFromImage: (imageId: string, tag: string) => void;
  getImageTags: (imageId: string) => string[];
  
  // Workflow integration
  selectedWorkflowId: string | null;
  setSelectedWorkflowId: (id: string | null) => void;
  workflowOverrides: Record<string, unknown>;
  setWorkflowOverrides: (overrides: Record<string, unknown>) => void;
  resetWorkflowOverrides: () => void;
  workflowPresets: { id: string; name: string; workflowId: string; params: Partial<ImageGenerationParams>; overrides: Record<string, unknown> }[];
  addWorkflowPreset: (preset: { name: string; workflowId: string; params: Partial<ImageGenerationParams>; overrides: Record<string, unknown> }) => void;
  deleteWorkflowPreset: (id: string) => void;
  
  // Saved configs
  savedConfigs: SavedImageConfig[];
  saveConfig: (name: string, prompt: string, negativePrompt: string, mode: 'text-to-image' | 'image-to-image', params: ImageGenerationParams) => void;
  deleteConfig: (id: string) => void;
  loadConfigIntoGenerator: (config: SavedImageConfig) => void;
}

export const useImageStore = create<ImageState>((set, get) => ({
  // Parameters
  params: DEFAULT_IMAGE_PARAMS,
  setParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams }
  })),
  
  // Prompts
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
  negativePrompt: '',
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  
  // Mode
  mode: 'text-to-image',
  setMode: (mode) => set({ mode }),
  
  // Reference image
  referenceImage: null,
  setReferenceImage: (referenceImage) => set({ referenceImage }),
  referenceImageFile: null,
  setReferenceImageFile: (referenceImageFile) => set({ referenceImageFile }),
  
  // Generation state
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  
  // Generated images
  images: [],
  addImages: (newImages) => set((state) => ({
    images: [...newImages, ...state.images]
  })),
  clearImages: () => set({ images: [], selectedImage: null }),
  
  // Selected image
  selectedImage: null,
  setSelectedImage: (selectedImage) => set({ selectedImage }),
  
  // View mode
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),
  
  // Gallery density
  density: 'comfortable',
  setDensity: (density) => set({ density }),
  
  // Starred images
  starredImageIds: new Set<string>(),
  toggleStar: (id) => set((state) => {
    const next = new Set(state.starredImageIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { starredImageIds: next };
  }),
  isStarred: (id) => get().starredImageIds.has(id),
  
  // Prompt templates
  promptTemplates: loadTemplates(),
  addPromptTemplate: (template) => {
    const newTemplate: PromptTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().promptTemplates, newTemplate];
    set({ promptTemplates: updated });
    persistTemplates(updated);
  },
  deletePromptTemplate: (id) => {
    const updated = get().promptTemplates.filter((t) => t.id !== id);
    set({ promptTemplates: updated });
    persistTemplates(updated);
  },
  
  // Image tags
  imageTags: loadTags(),
  addTagToImage: (imageId, tag) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    set((state) => {
      const existing = state.imageTags[imageId] || [];
      if (existing.includes(trimmed)) return state;
      return { imageTags: { ...state.imageTags, [imageId]: [...existing, trimmed] } };
    });
    persistTags(get().imageTags);
  },
  removeTagFromImage: (imageId, tag) => {
    const trimmed = tag.trim().toLowerCase();
    set((state) => {
      const existing = state.imageTags[imageId] || [];
      const next = existing.filter((t) => t !== trimmed);
      if (next.length === 0) {
        const { [imageId]: _, ...rest } = state.imageTags;
        return { imageTags: rest };
      }
      return { imageTags: { ...state.imageTags, [imageId]: next } };
    });
    persistTags(get().imageTags);
  },
  getImageTags: (imageId) => get().imageTags[imageId] || [],
  
  // Saved configs
  savedConfigs: loadConfigs(),
  saveConfig: (name, prompt, negativePrompt, mode, params) => {
    const newConfig: SavedImageConfig = {
      id: crypto.randomUUID(),
      name,
      prompt,
      negativePrompt,
      mode,
      params: { ...params },
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().savedConfigs, newConfig];
    set({ savedConfigs: updated });
    persistConfigs(updated);
  },
  deleteConfig: (id) => {
    const updated = get().savedConfigs.filter((c) => c.id !== id);
    set({ savedConfigs: updated });
    persistConfigs(updated);
  },
  loadConfigIntoGenerator: (config) => {
    set({
      prompt: config.prompt,
      negativePrompt: config.negativePrompt,
      mode: config.mode,
      params: { ...config.params },
    });
  },
  
  // Workflow integration
  selectedWorkflowId: null,
  setSelectedWorkflowId: (selectedWorkflowId) => set({ selectedWorkflowId }),
  workflowOverrides: {},
  setWorkflowOverrides: (workflowOverrides) => set({ workflowOverrides }),
  resetWorkflowOverrides: () => set({ workflowOverrides: {} }),
  workflowPresets: [],
  addWorkflowPreset: (preset) => {
    const newPreset = { ...preset, id: crypto.randomUUID() };
    set((state) => ({ workflowPresets: [...state.workflowPresets, newPreset] }));
  },
  deleteWorkflowPreset: (id) => {
    set((state) => ({ workflowPresets: state.workflowPresets.filter((p) => p.id !== id) }));
  },
}));
