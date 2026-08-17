import type { 
  Model, 
  RuntimeStatus, 
  Modality,
  TextModel,
  TextGenerationParams,
  ChatMessage 
} from '@lofiaistudio/shared';
import { BaseRuntimeAdapter, TextAdapter } from './base.js';

// Ollama API types
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    num_predict?: number;
    seed?: number;
    stop?: string[];
  };
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: OllamaGenerateRequest['options'];
}

/** Messages for /api/chat including tool call turns (Ollama native shape). */
export interface OllamaChatApiMessage {
  role: string;
  content?: string;
  tool_name?: string;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function: { name: string; arguments?: string };
  }>;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  response?: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

export class OllamaAdapter extends BaseRuntimeAdapter implements TextAdapter {
  readonly type = 'ollama' as const;
  
  constructor(endpoint: string = 'http://localhost:11434') {
    super(endpoint);
  }
  
  getSupportedModalities(): Modality[] {
    return ['text'];
  }
  
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this._endpoint}/api/tags`);
      if (response.ok) {
        this._connected = true;
        await this.getModels();
        return true;
      }
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
    }
    this._connected = false;
    return false;
  }
  
  async disconnect(): Promise<void> {
    this._connected = false;
    this._models = [];
  }
  
  async getStatus(): Promise<RuntimeStatus> {
    const models = await this.getModels();
    return {
      type: this.type,
      connected: this._connected,
      endpoint: this._endpoint,
      models,
    };
  }
  
  async getModels(): Promise<Model[]> {
    try {
      const response = await fetch(`${this._endpoint}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json() as { models: OllamaModel[] };
      
      this._models = data.models.map((model): TextModel => ({
        id: model.name,
        name: model.name,
        modality: 'text',
        status: 'loaded',
        runtime: 'ollama',
        contextLength: undefined, // Ollama doesn't expose this directly
        supportsStreaming: true,
        metadata: {
          size: model.size,
          digest: model.digest,
          modifiedAt: model.modified_at,
          details: model.details,
        },
      }));
      
      return this._models;
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }
  
  async loadModel(modelId: string): Promise<boolean> {
    try {
      // Ollama loads models on-demand, but we can pull if not present
      const response = await fetch(`${this._endpoint}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: false }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to load Ollama model:', error);
      return false;
    }
  }
  
  async unloadModel(modelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this._endpoint}/api/unload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to unload Ollama model:', error);
      return false;
    }
  }
  
  async chat(
    modelId: string,
    messages: ChatMessage[],
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string> {
    const request: OllamaChatRequest = {
      model: modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: !!onToken,
      options: {
        temperature: params.temperature,
        top_p: params.topP,
        top_k: params.topK,
        repeat_penalty: params.repeatPenalty,
        num_predict: params.maxTokens,
        seed: params.seed,
        stop: params.stop,
      },
    };
    
    if (onToken) {
      // Streaming mode
      return await this.streamChat(request, onToken);
    } else {
      // Non-streaming mode
      const response = await fetch(`${this._endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as OllamaResponse;
      return data.message?.content || '';
    }
  }

  /**
   * Non-streaming /api/chat round. Pass `tools` for function calling; `messages` may include assistant tool_calls and tool results.
   */
  async chatCompleteRound(
    modelId: string,
    messages: OllamaChatApiMessage[],
    params: TextGenerationParams,
    tools?: unknown[]
  ): Promise<{ message: OllamaChatApiMessage }> {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: messages.map((m) => {
        const o: Record<string, unknown> = { role: m.role };
        if (m.content !== undefined) o.content = m.content;
        if (m.tool_name) o.tool_name = m.tool_name;
        if (m.tool_calls) o.tool_calls = m.tool_calls;
        return o;
      }),
      stream: false,
      options: {
        temperature: params.temperature,
        top_p: params.topP,
        top_k: params.topK,
        repeat_penalty: params.repeatPenalty,
        num_predict: params.maxTokens,
        seed: params.seed,
        stop: params.stop,
      },
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch(`${this._endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama chat ${response.status}: ${errText.slice(0, 400)}`);
    }

    const data = (await response.json()) as { message?: OllamaChatApiMessage };
    if (!data.message) {
      throw new Error('Ollama returned no message');
    }
    return { message: data.message };
  }
  
  private async streamChat(
    request: OllamaChatRequest,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this._endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaResponse;
          if (data.message?.content) {
            fullContent += data.message.content;
            onToken(data.message.content);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
    
    return fullContent;
  }
  
  async complete(
    modelId: string,
    prompt: string,
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: modelId,
      prompt,
      stream: !!onToken,
      options: {
        temperature: params.temperature,
        top_p: params.topP,
        top_k: params.topK,
        repeat_penalty: params.repeatPenalty,
        num_predict: params.maxTokens,
        seed: params.seed,
        stop: params.stop,
      },
    };
    
    if (onToken) {
      return await this.streamGenerate(request, onToken);
    } else {
      const response = await fetch(`${this._endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as OllamaResponse;
      return data.response || '';
    }
  }
  
  private async streamGenerate(
    request: OllamaGenerateRequest,
    onToken: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this._endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaResponse;
          if (data.response) {
            fullContent += data.response;
            onToken(data.response);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
    
    return fullContent;
  }
}