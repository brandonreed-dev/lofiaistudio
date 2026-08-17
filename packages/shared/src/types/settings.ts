// ============================================
// Settings Types
// ============================================

import type { CloudProviderConfig } from './modality.js';
import type { TextGenerationParams, ImageGenerationParams, AudioParams, VideoGenerationParams } from './params.js';

export interface AppSettings {
  runtimes: {
    ollama?: string;
    comfyui?: string;
    qwen3Audio?: string;
    a1111?: string;
  };
  outputDir: string;
  theme: 'light' | 'dark' | 'system';
  cloudProviders: CloudProviderConfig[];
  defaultParams: {
    text?: TextGenerationParams;
    image?: ImageGenerationParams;
    audio?: AudioParams;
    video?: VideoGenerationParams;
  };
}