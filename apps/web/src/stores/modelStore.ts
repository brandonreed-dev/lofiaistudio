import { create } from 'zustand';
import type { Modality, Model } from '@lofiaistudio/shared';
import { api } from '@/lib/api';

interface ModelState {
  models: Record<Modality, Model[]>;
  setModels: (modality: Modality, models: Model[]) => void;
  selectedModel: Record<Modality, string | null>;
  setSelectedModel: (modality: Modality, modelId: string | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  fetchModels: (modality: Modality) => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: { text: [], image: [], audio: [], video: [], '3d': [] },
  setModels: (modality, models) => set((state) => ({
    models: { ...state.models, [modality]: models },
  })),
  selectedModel: { text: null, image: null, audio: null, video: null, '3d': null },
  setSelectedModel: (modality, modelId) => set((state) => ({
    selectedModel: { ...state.selectedModel, [modality]: modelId },
  })),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  fetchModels: async (modality) => {
    set({ isLoading: true });
    try {
      const models = await api<Model[]>(`/api/models/${modality}`);
      set((state) => ({
        models: { ...state.models, [modality]: models },
        isLoading: false,
      }));
      const currentSelected = get().selectedModel[modality];
      if (!currentSelected && models.length > 0) {
        set((state) => ({
          selectedModel: { ...state.selectedModel, [modality]: models[0].id },
        }));
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
