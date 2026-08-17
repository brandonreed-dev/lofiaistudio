// ============================================
// Generation Parameters
// ============================================

export interface TextGenerationParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  maxTokens?: number;
  seed?: number;
  stop?: string[];
}

export interface ImageGenerationParams {
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  width?: number;
  height?: number;
  batchSize?: number;
  clipSkip?: number;
  vae?: string;
  strength?: number;
  hiresFix?: boolean;
  hiresUpscaler?: string;
  denoisingStrength?: number;
}

export interface VideoGenerationParams {
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  scheduler?: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  seed?: number;
}

export interface AudioParams {
  language?: string;
  translate?: boolean;
  voice?: string;
  speed?: number;
  pitch?: number;
  outputFormat?: 'mp3' | 'wav' | 'ogg';
}

export interface Model3DGenerationParams {
  steps?: number;
  cfgScale?: number;
  seed?: number;
  format?: 'glb' | 'obj' | 'ply' | 'splat';
  textureResolution?: number;
  batchSize?: number;
  guidanceScale?: number;
  octreeResolution?: number;
  denoisingStrength?: number;
}
