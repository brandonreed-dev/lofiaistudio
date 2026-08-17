// ============================================
// Modality Types
// ============================================

export type Modality = 'text' | 'image' | 'audio' | 'video' | '3d';

export interface ModalityConfig {
  id: Modality;
  label: string;
  icon: string;
  description: string;
}

// ============================================
// Execution Mode Types
// ============================================

export type ExecutionMode = 'local' | 'cloud';

export interface ExecutionModeState {
  mode: ExecutionMode;
  provider?: CloudProvider;
}

export type CloudProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'stability-ai'
  | 'elevenlabs'
  | 'replicate'
  | 'fal-ai'
  | 'together-ai';

export interface CloudProviderConfig {
  id: CloudProvider;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  supportedModalities: Modality[];
}

// ============================================
// Runtime Types (shared across multiple domains)
// ============================================

export type RuntimeType =
  | 'ollama'
  | 'llama-cpp'
  | 'comfyui'
  | 'a1111'
  | 'qwen3-asr'
  | 'qwen3-tts'
  | 'svd'
  | 'animatediff';
