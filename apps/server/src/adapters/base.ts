import type { 
  Model, 
  RuntimeType, 
  RuntimeStatus, 
  Modality,
  TextGenerationParams,
  ImageGenerationParams,
  AudioParams,
  VideoGenerationParams,
  Model3DGenerationParams,
  ChatMessage 
} from '@lofiaistudio/shared';

// Base adapter interface that all runtime adapters must implement
export interface RuntimeAdapter {
  // Runtime identification
  readonly type: RuntimeType;
  readonly endpoint: string;
  
  // Connection management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Status and health
  getStatus(): Promise<RuntimeStatus>;
  
  // Model management
  getModels(): Promise<Model[]>;
  loadModel(modelId: string): Promise<boolean>;
  unloadModel(modelId: string): Promise<boolean>;
  
  // Modality support
  getSupportedModalities(): Modality[];
}

// Text model adapter interface
export interface TextAdapter extends RuntimeAdapter {
  // Chat completion with streaming support
  chat(
    modelId: string,
    messages: ChatMessage[],
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string>;
  
  // Single completion
  complete(
    modelId: string,
    prompt: string,
    params: TextGenerationParams,
    onToken?: (token: string) => void
  ): Promise<string>;
}

// Image model adapter interface
export interface ImageAdapter extends RuntimeAdapter {
  // Text-to-image generation
  textToImage(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    params: ImageGenerationParams
  ): Promise<{ images: string[]; seeds: number[] }>;
  
  // Image-to-image transformation
  imageToImage(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    referenceImage: string,
    params: ImageGenerationParams
  ): Promise<{ images: string[]; seeds: number[] }>;
}

// Audio model adapter interface
export interface AudioAdapter extends RuntimeAdapter {
  // Speech-to-text (transcription)
  transcribe(
    modelId: string,
    audioFile: string,
    params: AudioParams
  ): Promise<{ text: string; duration: number }>;
  
  // Text-to-speech (synthesis)
  synthesize(
    modelId: string,
    text: string,
    params: AudioParams
  ): Promise<{ audioFile: string; duration: number }>;
}

// Video model adapter interface
export interface VideoAdapter extends RuntimeAdapter {
  // Text-to-video generation
  textToVideo(
    modelId: string,
    prompt: string,
    params: VideoGenerationParams
  ): Promise<{ videoFile: string; duration: number; frames: number }>;
  
  // Image-to-video generation
  imageToVideo(
    modelId: string,
    prompt: string,
    referenceImage: string,
    params: VideoGenerationParams
  ): Promise<{ videoFile: string; duration: number; frames: number }>;
}

// 3D model adapter interface
export interface Model3DAdapter extends RuntimeAdapter {
  // Text-to-3D generation
  textTo3D(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    params: Model3DGenerationParams
  ): Promise<{ modelFiles: string[]; seeds: number[] }>;
  
  // Image-to-3D generation
  imageTo3D(
    modelId: string,
    prompt: string,
    negativePrompt: string | null,
    referenceImage: string,
    params: Model3DGenerationParams
  ): Promise<{ modelFiles: string[]; seeds: number[] }>;
}

// Abstract base class with common functionality
export abstract class BaseRuntimeAdapter implements RuntimeAdapter {
  abstract readonly type: RuntimeType;
  protected _endpoint: string;
  protected _connected: boolean = false;
  protected _models: Model[] = [];
  
  constructor(endpoint: string) {
    this._endpoint = endpoint;
  }
  
  get endpoint(): string {
    return this._endpoint;
  }
  
  isConnected(): boolean {
    return this._connected;
  }
  
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract getStatus(): Promise<RuntimeStatus>;
  abstract getModels(): Promise<Model[]>;
  abstract loadModel(modelId: string): Promise<boolean>;
  abstract unloadModel(modelId: string): Promise<boolean>;
  abstract getSupportedModalities(): Modality[];
  
  // Helper method for making HTTP requests
  protected async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this._endpoint}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  // Helper for streaming responses
  protected async *streamResponse(
    path: string, 
    body: unknown
  ): AsyncGenerator<string> {
    const url = `${this._endpoint}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}