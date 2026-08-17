// Core types
export * from './types/index.js';
export * from './converters.js';
export * from './skillHttp.js';
export * from './responseConverters.js';

// Constants
export const MODALITIES = {
  text: {
    id: 'text',
    label: 'Text',
    icon: 'MessageSquare',
    description: 'Chat and text generation with LLMs',
  },
  image: {
    id: 'image',
    label: 'Image',
    icon: 'Image',
    description: 'Text-to-image and image-to-image generation',
  },
  audio: {
    id: 'audio',
    label: 'Audio',
    icon: 'Music',
    description: 'Speech-to-text and text-to-speech',
  },
  video: {
    id: 'video',
    label: 'Video',
    icon: 'Video',
    description: 'Text-to-video and image-to-video generation',
  },
  '3d': {
    id: '3d',
    label: '3D Models',
    icon: 'Box',
    description: 'Text-to-3D and image-to-3D model generation',
  },
} as const;

export const CLOUD_PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    supportedModalities: ['text', 'image', 'audio'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    supportedModalities: ['text'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'Deepseek',
    supportedModalities: ['text'],
  },
  'stability-ai': {
    id: 'stability-ai',
    name: 'Stability AI',
    supportedModalities: ['image', 'video'],
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    supportedModalities: ['audio'],
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    supportedModalities: ['text', 'image', 'audio', 'video'],
  },
  'fal-ai': {
    id: 'fal-ai',
    name: 'Fal.ai',
    supportedModalities: ['image', 'audio', 'video'],
  },
  'together-ai': {
    id: 'together-ai',
    name: 'Together.ai',
    supportedModalities: ['text', 'image'],
  },
} as const;

export const DEFAULT_RUNTIME_ENDPOINTS = {
  ollama: 'http://localhost:11434',
  comfyui: 'http://localhost:8188',
  qwen3Audio: 'http://localhost:8001',
  a1111: 'http://localhost:7860',
} as const;

export const DEFAULT_TEXT_PARAMS = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  maxTokens: 2048,
} as const;

export const DEFAULT_MEMORY_CONFIG = {
  enabled: false,
  mode: 'window' as const,
  windowSize: 50,
  summaryFrequency: 30,
} as const;

export const DEFAULT_IMAGE_PARAMS = {
  steps: 20,
  cfgScale: 7.5,
  sampler: 'euler',
  scheduler: 'normal',
  width: 512,
  height: 512,
  batchSize: 1,
} as const;

export const DEFAULT_AUDIO_PARAMS = {
  language: 'auto',
  speed: 1.0,
  pitch: 1.0,
  outputFormat: 'wav',
} as const;

export const DEFAULT_VIDEO_PARAMS = {
  steps: 15,
  cfgScale: 5,
  sampler: 'uni_pc',
  scheduler: 'simple',
  width: 768,
  height: 512,
  frames: 16,
  fps: 20,
} as const;

export const DEFAULT_3D_PARAMS = {
  steps: 25,
  cfgScale: 7.5,
  seed: undefined as number | undefined,
  format: 'glb' as 'glb' | 'obj' | 'ply' | 'splat',
  textureResolution: 1024,
  batchSize: 1,
  guidanceScale: 7.5,
  octreeResolution: 256,
  denoisingStrength: 1.0,
} as const;
