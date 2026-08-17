import type {
  AudioModel,
  AudioParams,
  Model,
  Modality,
  RuntimeStatus,
} from '@lofiaistudio/shared';
import { BaseRuntimeAdapter, type AudioAdapter } from './base.js';

interface Qwen3AudioModelResponse {
  models?: Array<{
    id: string;
    name?: string;
    type?: 'stt' | 'tts';
    languages?: string[];
    sampleRate?: number;
    metadata?: Record<string, unknown>;
  }>;
  sttModels?: Array<{
    id: string;
    name?: string;
    languages?: string[];
    sampleRate?: number;
    metadata?: Record<string, unknown>;
  }>;
}

interface Qwen3TranscribeResponse {
  text: string;
  duration?: number;
  language?: string;
}

export class Qwen3ASRAdapter extends BaseRuntimeAdapter implements AudioAdapter {
  readonly type = 'qwen3-asr' as const;

  constructor(endpoint: string = 'http://localhost:8001') {
    super(endpoint);
  }

  getSupportedModalities(): Modality[] {
    return ['audio'];
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this._endpoint}/health`);
      if (response.ok) {
        this._connected = true;
        await this.getModels();
        return true;
      }
    } catch (error) {
      console.error('Failed to connect to Qwen3 ASR service:', error);
    }

    this._connected = false;
    return false;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this._models = [];
  }

  async getStatus(): Promise<RuntimeStatus> {
    try {
      const response = await fetch(`${this._endpoint}/health`);
      if (response.ok) {
        return {
          type: this.type,
          connected: true,
          endpoint: this._endpoint,
          models: await this.getModels(),
        };
      }
    } catch (error) {
      console.error('Failed to get Qwen3 ASR status:', error);
    }

    return {
      type: this.type,
      connected: false,
      endpoint: this._endpoint,
      models: [],
    };
  }

  async getModels(): Promise<Model[]> {
    try {
      const response = await fetch(`${this._endpoint}/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as Qwen3AudioModelResponse;
      this._models = this.normalizeModels(data);
      return this._models;
    } catch (error) {
      console.error('Failed to fetch Qwen3 ASR models:', error);
      this._models = this.getDefaultModels();
      return this._models;
    }
  }

  async loadModel(modelId: string): Promise<boolean> {
    const model = this._models.find((entry) => entry.id === modelId);
    if (model) {
      model.status = 'loaded';
      return true;
    }

    return false;
  }

  async unloadModel(modelId: string): Promise<boolean> {
    const model = this._models.find((entry) => entry.id === modelId);
    if (model) {
      model.status = 'unloaded';
      return true;
    }

    return false;
  }

  async transcribe(
    modelId: string,
    audioData: string,
    params: AudioParams
  ): Promise<{ text: string; duration: number }> {
    const response = await fetch(`${this._endpoint}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        audio: audioData,
        language: params.language,
        translate: params.translate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen3 ASR transcription failed: HTTP ${response.status} - ${errorText}`);
    }

    const result = await response.json() as Qwen3TranscribeResponse;
    return {
      text: result.text.trim(),
      duration: result.duration ?? 0,
    };
  }

  async synthesize(): Promise<{ audioFile: string; duration: number }> {
    throw new Error('Qwen3 ASR does not support text-to-speech. Use a Qwen3 TTS model.');
  }

  private normalizeModels(data: Qwen3AudioModelResponse): AudioModel[] {
    const sttModels = data.models
      ?.filter((model) => model.type === 'stt')
      .map((model) => this.toAudioModel(model))
      ?? [];

    if (sttModels.length > 0) {
      return sttModels;
    }

    if (data.sttModels && data.sttModels.length > 0) {
      return data.sttModels.map((model) => this.toAudioModel(model));
    }

    return this.getDefaultModels();
  }

  private toAudioModel(model: {
    id: string;
    name?: string;
    languages?: string[];
    sampleRate?: number;
    metadata?: Record<string, unknown>;
  }): AudioModel {
    return {
      id: model.id,
      name: model.name || model.id,
      modality: 'audio',
      type: 'stt',
      status: 'loaded',
      runtime: 'qwen3-asr',
      languages: model.languages ?? ['auto', 'en'],
      sampleRate: model.sampleRate,
      metadata: model.metadata,
    };
  }

  private getDefaultModels(): AudioModel[] {
    return [
      {
        id: 'qwen3-asr',
        name: 'Qwen3 ASR',
        modality: 'audio',
        type: 'stt',
        status: 'loaded',
        runtime: 'qwen3-asr',
        languages: ['auto', 'en', 'es', 'fr', 'de', 'ja', 'zh'],
      },
    ];
  }
}
