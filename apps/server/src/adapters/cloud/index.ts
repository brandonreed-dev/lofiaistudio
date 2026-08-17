import type { CloudProvider, Modality, TextGenerationParams, ImageGenerationParams, ChatMessage } from '@lofiaistudio/shared';

// ============================================
// Cloud Adapter Interface
// ============================================

export interface CloudAdapter {
  readonly provider: CloudProvider;
  readonly name: string;
  readonly supportedModalities: Modality[];

  // Connection / validation
  validateConnection(): Promise<boolean>;

  // Text generation
  chat(
    modelId: string,
    messages: ChatMessage[],
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string>;

  complete(
    modelId: string,
    prompt: string,
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string>;

  // Image generation (for providers that support it)
  textToImage?(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    params: ImageGenerationParams
  ): Promise<{ images: string[]; seeds: number[] }>;
}

// ============================================
// Cloud Adapter Registry
// ============================================

export class CloudAdapterRegistry {
  private adapters: Map<CloudProvider, CloudAdapter> = new Map();

  register(adapter: CloudAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: CloudProvider): CloudAdapter | undefined {
    return this.adapters.get(provider);
  }

  getAll(): CloudAdapter[] {
    return Array.from(this.adapters.values());
  }

  getForModality(modality: Modality): CloudAdapter[] {
    return this.getAll().filter((a) => a.supportedModalities.includes(modality));
  }
}

// ============================================
// Factory
// ============================================

export function createCloudAdapterRegistry(apiKeys: Record<string, string>): CloudAdapterRegistry {
  const registry = new CloudAdapterRegistry();

  if (apiKeys.openai) {
    const { OpenAIAdapter } = require('./openai.js');
    registry.register(new OpenAIAdapter(apiKeys.openai));
  }

  if (apiKeys.anthropic) {
    const { AnthropicAdapter } = require('./anthropic.js');
    registry.register(new AnthropicAdapter(apiKeys.anthropic));
  }

  if (apiKeys.deepseek) {
    const { DeepseekAdapter } = require('./deepseek.js');
    registry.register(new DeepseekAdapter(apiKeys.deepseek));
  }

  return registry;
}