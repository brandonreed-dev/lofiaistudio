// ============================================
// Job Types
// ============================================

import type { Modality, ExecutionMode, CloudProvider } from './modality.js';
import type { ChatMessage } from './chat.js';
import type { TextGenerationParams, ImageGenerationParams, VideoGenerationParams, AudioParams } from './params.js';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BaseJob {
  id: string;
  status: JobStatus;
  modality: Modality;
  executionMode: ExecutionMode;
  provider?: CloudProvider;
  modelId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TextJob extends BaseJob {
  modality: 'text';
  input: {
    prompt: string;
    systemPrompt?: string;
    messages?: ChatMessage[];
    parameters: TextGenerationParams;
  };
  output?: {
    text: string;
    tokensUsed?: number;
  };
}

export interface ImageJob extends BaseJob {
  modality: 'image';
  input: {
    prompt: string;
    negativePrompt?: string;
    parameters: ImageGenerationParams;
    referenceImage?: string;
  };
  output?: {
    images: string[];
    seeds?: number[];
  };
}

export interface AudioJob extends BaseJob {
  modality: 'audio';
  input: {
    type: 'stt' | 'tts';
    audioFile?: string;
    text?: string;
    parameters: AudioParams;
  };
  output?: {
    text?: string;
    audioFile?: string;
    duration?: number;
  };
}

export interface VideoJob extends BaseJob {
  modality: 'video';
  input: {
    prompt: string;
    parameters: VideoGenerationParams;
    referenceImage?: string;
  };
  output?: {
    videoFile: string;
    duration: number;
    frames: number;
  };
}

export type Job = TextJob | ImageJob | AudioJob | VideoJob;