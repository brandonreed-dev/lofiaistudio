import { create } from 'zustand';
import type { Model3DGenerationParams } from '@lofiaistudio/shared';
import { DEFAULT_3D_PARAMS } from '@lofiaistudio/shared';
import { readJsonStorage, writeJsonStorage } from '@/lib/storage';

interface GeneratedModel3D {
  id: string;
  url: string;
  prompt: string;
  negativePrompt?: string;
  params: Model3DGenerationParams;
  modelId: string;
  timestamp: Date;
  seed?: number;
}

export interface SavedModel3DConfig {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
  mode: 'text-to-3d' | 'image-to-3d';
  params: Model3DGenerationParams;
  createdAt: string;
}

export interface Model3DPromptTemplate {
  id: string;
  name: string;
  prompt: string;
  negativePrompt?: string;
  createdAt: string;
}

export interface Model3DPresetConfig {
  id: string;
  name: string;
  label: string;
  params: Partial<Model3DGenerationParams>;
}

export const MODEL3D_PRESET_CONFIGS: Model3DPresetConfig[] = [
  { id: 'quality', name: 'High Quality', label: 'Quality', params: { steps: 40, cfgScale: 8, textureResolution: 2048 } },
  { id: 'fast', name: 'Fast Draft', label: 'Fast', params: { steps: 15, cfgScale: 6, textureResolution: 512 } },
  { id: 'balanced', name: 'Balanced', label: 'Balanced', params: { steps: 25, cfgScale: 7.5, textureResolution: 1024 } },
];

export type Model3DDensity = 'compact' | 'comfortable' | 'spacious';

const CONFIGS_STORAGE_KEY = 'localai-model3d-configs';
const TEMPLATES_STORAGE_KEY = 'localai-model3d-templates';

function loadConfigs(): SavedModel3DConfig[] {
  return readJsonStorage<SavedModel3DConfig[]>(CONFIGS_STORAGE_KEY, []);
}

function persistConfigs(configs: SavedModel3DConfig[]) {
  writeJsonStorage(CONFIGS_STORAGE_KEY, configs);
}

function loadTemplates(): Model3DPromptTemplate[] {
  return readJsonStorage<Model3DPromptTemplate[]>(TEMPLATES_STORAGE_KEY, []);
}

function persistTemplates(templates: Model3DPromptTemplate[]) {
  writeJsonStorage(TEMPLATES_STORAGE_KEY, templates);
}

interface Model3DState {
  // Parameters
  params: Model3DGenerationParams;
  setParams: (params: Partial<Model3DGenerationParams>) => void;

  // Prompts
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt: string;
  setNegativePrompt: (prompt: string) => void;

  // Mode
  mode: 'text-to-3d' | 'image-to-3d';
  setMode: (mode: 'text-to-3d' | 'image-to-3d') => void;

  // Reference image for image-to-3d
  referenceImage: string | null;
  setReferenceImage: (image: string | null) => void;
  referenceImageFile: File | null;
  setReferenceImageFile: (file: File | null) => void;

  // Generation state
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  // Generated models
  models: GeneratedModel3D[];
  addModels: (models: GeneratedModel3D[]) => void;
  clearModels: () => void;

  // Selected model for viewing
  selectedModel: GeneratedModel3D | null;
  setSelectedModel: (model: GeneratedModel3D | null) => void;

  // Gallery view
  viewMode: 'grid' | 'single';
  setViewMode: (mode: 'grid' | 'single') => void;
  density: Model3DDensity;
  setDensity: (density: Model3DDensity) => void;

  // Starred models
  starredModelIds: Set<string>;
  toggleStar: (id: string) => void;
  isStarred: (id: string) => boolean;

  // Prompt templates
  promptTemplates: Model3DPromptTemplate[];
  addPromptTemplate: (template: Omit<Model3DPromptTemplate, 'id' | 'createdAt'>) => void;
  deletePromptTemplate: (id: string) => void;

  // Saved configs
  savedConfigs: SavedModel3DConfig[];
  saveConfig: (name: string, prompt: string, negativePrompt: string, mode: 'text-to-3d' | 'image-to-3d', params: Model3DGenerationParams) => void;
  deleteConfig: (id: string) => void;
  loadConfigIntoGenerator: (config: SavedModel3DConfig) => void;
}

export const useModel3DStore = create<Model3DState>((set, get) => ({
  // Parameters
  params: { ...DEFAULT_3D_PARAMS },
  setParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams }
  })),

  // Prompts
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
  negativePrompt: '',
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),

  // Mode
  mode: 'text-to-3d',
  setMode: (mode) => set({ mode }),

  // Reference image
  referenceImage: null,
  setReferenceImage: (referenceImage) => set({ referenceImage }),
  referenceImageFile: null,
  setReferenceImageFile: (referenceImageFile) => set({ referenceImageFile }),

  // Generation state
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),

  // Generated models
  models: [],
  addModels: (newModels) => set((state) => ({
    models: [...newModels, ...state.models]
  })),
  clearModels: () => set({ models: [], selectedModel: null }),

  // Selected model
  selectedModel: null,
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  // View mode
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),

  // Gallery density
  density: 'comfortable',
  setDensity: (density) => set({ density }),

  // Starred models
  starredModelIds: new Set<string>(),
  toggleStar: (id) => set((state) => {
    const next = new Set(state.starredModelIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { starredModelIds: next };
  }),
  isStarred: (id) => get().starredModelIds.has(id),

  // Prompt templates
  promptTemplates: loadTemplates(),
  addPromptTemplate: (template) => {
    const newTemplate: Model3DPromptTemplate = {
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

  // Saved configs
  savedConfigs: loadConfigs(),
  saveConfig: (name, prompt, negativePrompt, mode, params) => {
    const newConfig: SavedModel3DConfig = {
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
}));