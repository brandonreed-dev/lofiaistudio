// ============================================
// Model Types
// ============================================

import type { Modality } from './modality.js';
import type { RuntimeType } from './modality.js';

export type ModelStatus = 'loaded' | 'unloaded' | 'loading' | 'error';

export interface BaseModel {
  id: string;
  name: string;
  modality: Modality;
  status: ModelStatus;
  runtime: RuntimeType;
  metadata?: Record<string, unknown>;
  type?: string;
}

export interface TextModel extends BaseModel {
  modality: 'text';
  contextLength?: number;
  supportsStreaming?: boolean;
  supportsVision?: boolean;
}

export interface ImageModel extends BaseModel {
  modality: 'image';
  defaultWidth?: number;
  defaultHeight?: number;
  maxBatchSize?: number;
}

export interface AudioModel extends BaseModel {
  modality: 'audio';
  type: 'stt' | 'tts';
  sampleRate?: number;
  languages?: string[];
}

export interface VideoModel extends BaseModel {
  modality: 'video';
  defaultWidth?: number;
  defaultHeight?: number;
  maxFps?: number;
  durationLimit?: number;
  defaultFps?: number;
  maxFrames?: number;
}

export interface Model3DModel extends BaseModel {
  modality: '3d';
  defaultFormat?: 'glb' | 'obj' | 'ply' | 'splat';
  supportsTexturing?: boolean;
  supportsImageTo3D?: boolean;
  maxBatchSize?: number;
}

export type Model = TextModel | ImageModel | AudioModel | VideoModel | Model3DModel;
