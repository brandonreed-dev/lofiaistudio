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
  ttsModels?: Array<{
    id: string;
    name?: string;
    languages?: string[];
    sampleRate?: number;
    metadata?: Record<string, unknown>;
  }>;
  voices?: Array<{
    id: string;
    name?: string;
    language?: string;
    sample_rate?: number;
    metadata?: Record<string, unknown>;
  }>;
}

interface Qwen3SynthesizeResponse {
  audio?: string;
  audioFile?: string;
  duration?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export class Qwen3TTSAdapter extends BaseRuntimeAdapter implements AudioAdapter {
  readonly type = 'qwen3-tts' as const;

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
      console.error('Failed to connect to Qwen3 TTS service:', error);
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
      console.error('Failed to get Qwen3 TTS status:', error);
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
      console.error('Failed to fetch Qwen3 TTS models:', error);
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

  async transcribe(): Promise<{ text: string; duration: number }> {
    throw new Error('Qwen3 TTS does not support speech-to-text. Use a Qwen3 ASR model.');
  }

  async synthesize(
    modelId: string,
    text: string,
    params: AudioParams
  ): Promise<{ audioFile: string; duration: number }> {
    const response = await fetch(`${this._endpoint}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        text,
        speed: params.speed,
        pitch: params.pitch,
        format: params.outputFormat,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen3 TTS synthesis failed: HTTP ${response.status} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const result = await response.json() as Qwen3SynthesizeResponse;
      if (result.audioFile) {
        return {
          audioFile: result.audioFile,
          duration: result.duration ?? 0,
        };
      }

      if (!result.audio) {
        throw new Error('Qwen3 TTS response did not include audio data.');
      }

      const format = result.format ?? params.outputFormat ?? 'wav';
      return {
        audioFile: `data:audio/${format};base64,${result.audio}`,
        duration: result.duration ?? 0,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const base64Audio = audioBuffer.toString('base64');
    const format = contentType.includes('mp3')
      ? 'mp3'
      : contentType.includes('ogg')
        ? 'ogg'
        : 'wav';

    return {
      audioFile: `data:audio/${format};base64,${base64Audio}`,
      duration: 0,
    };
  }

  private normalizeModels(data: Qwen3AudioModelResponse): AudioModel[] {
    const ttsModels = data.models
      ?.filter((model) => model.type === 'tts')
      .map((model) => this.toAudioModel(model))
      ?? [];

    if (ttsModels.length > 0) {
      return ttsModels;
    }

    if (data.ttsModels && data.ttsModels.length > 0) {
      return data.ttsModels.map((model) => this.toAudioModel(model));
    }

    if (data.voices && data.voices.length > 0) {
      return data.voices.map((voice) => this.toAudioModel({
        id: voice.id,
        name: voice.name,
        languages: voice.language ? [voice.language] : ['en'],
        sampleRate: voice.sample_rate,
        metadata: voice.metadata,
      }));
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
      type: 'tts',
      status: 'loaded',
      runtime: 'qwen3-tts',
      languages: model.languages ?? ['en'],
      sampleRate: model.sampleRate,
      metadata: model.metadata,
    };
  }

  private getDefaultModels(): AudioModel[] {
    return [
      {
        id: 'qwen3-tts',
        name: 'Qwen3 TTS',
        modality: 'audio',
        type: 'tts',
        status: 'loaded',
        runtime: 'qwen3-tts',
        languages: ['en'],
      },
    ];
  }
}
