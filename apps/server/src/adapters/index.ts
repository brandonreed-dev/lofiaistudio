export { BaseRuntimeAdapter } from './base.js';
export type { RuntimeAdapter, TextAdapter, ImageAdapter, AudioAdapter, VideoAdapter, Model3DAdapter } from './base.js';
export { OllamaAdapter } from './ollama.js';
export { ComfyUIAdapter } from './comfyui.js';
export { Qwen3ASRAdapter } from './qwen3-asr.js';
export { Qwen3TTSAdapter } from './qwen3-tts.js';

import type { Model, RuntimeType, RuntimeStatus } from '@lofiaistudio/shared';
import { OllamaAdapter } from './ollama.js';
import { ComfyUIAdapter } from './comfyui.js';
import { Qwen3ASRAdapter } from './qwen3-asr.js';
import { Qwen3TTSAdapter } from './qwen3-tts.js';
import type { RuntimeAdapter } from './base.js';

// Adapter registry - manages all runtime adapters
export class AdapterRegistry {
  private adapters: Map<RuntimeType, RuntimeAdapter> = new Map();
  
  // Register an adapter
  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }
  
  // Get an adapter by type
  get<T extends RuntimeAdapter>(type: RuntimeType): T | undefined {
    return this.adapters.get(type) as T | undefined;
  }
  
  // Get all registered adapters
  getAll(): RuntimeAdapter[] {
    return Array.from(this.adapters.values());
  }

  async findModel(
    modelId: string,
    runtime?: RuntimeType
  ): Promise<{ adapter: RuntimeAdapter; model: Model } | undefined> {
    if (runtime) {
      const adapter = this.get(runtime);
      if (!adapter) {
        return undefined;
      }

      const model = (await adapter.getModels()).find((entry) => entry.id === modelId);
      return model ? { adapter, model } : undefined;
    }

    for (const adapter of this.adapters.values()) {
      const model = (await adapter.getModels()).find((entry) => entry.id === modelId);
      if (model) {
        return { adapter, model };
      }
    }

    return undefined;
  }
  
  // Connect to all adapters and return their statuses
  async connectAll(): Promise<RuntimeStatus[]> {
    const statuses: RuntimeStatus[] = [];
    
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.connect();
        const status = await adapter.getStatus();
        statuses.push(status);
      } catch (error) {
        console.error(`Failed to connect to ${adapter.type}:`, error);
        statuses.push({
          type: adapter.type,
          connected: false,
          endpoint: adapter.endpoint,
          models: [],
        });
      }
    }
    
    return statuses;
  }
  
  // Get status of all adapters
  async getStatuses(): Promise<RuntimeStatus[]> {
    const statuses: RuntimeStatus[] = [];
    
    for (const adapter of this.adapters.values()) {
      try {
        const status = await adapter.getStatus();
        statuses.push(status);
      } catch (error) {
        console.error(`Failed to get status for ${adapter.type}:`, error);
        statuses.push({
          type: adapter.type,
          connected: false,
          endpoint: adapter.endpoint,
          models: [],
        });
      }
    }
    
    return statuses;
  }
}

// Create and configure the default adapter registry
export function createAdapterRegistry(config: {
  ollamaEndpoint?: string;
  comfyuiEndpoint?: string;
  qwen3AudioEndpoint?: string;
}): AdapterRegistry {
  const registry = new AdapterRegistry();
  
  // Register Ollama adapter (Text)
  registry.register(new OllamaAdapter(config.ollamaEndpoint));
  
  // Register ComfyUI adapter (Image)
  registry.register(new ComfyUIAdapter(config.comfyuiEndpoint));
  
  // Register Qwen3 adapters (Audio)
  registry.register(new Qwen3ASRAdapter(config.qwen3AudioEndpoint));

  registry.register(new Qwen3TTSAdapter(config.qwen3AudioEndpoint));
  
  return registry;
}
