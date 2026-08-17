// ============================================
// API Types
// ============================================

import type { Modality, RuntimeType } from './modality.js';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Studio AI Types (for OpenAI API compatibility)
// ============================================

export interface StudioAudioSpeechRequest {
  model: string;
  input: string;
  runtime?: RuntimeType;
  speed?: number;
  pitch?: number;
  responseFormat?: 'mp3' | 'wav' | 'ogg';
}

export interface StudioAudioTranscriptionRequest {
  model: string;
  file: string;
  runtime?: RuntimeType;
  language?: string;
  translate?: boolean;
  responseFormat?: string;
}

export interface StudioAudioSpeech {
  type: 'audio_speech';
  data?: string;
  duration?: number;
  audioFile?: string;
}

export interface StudioAudioTranscription {
  type: 'audio_transcription';
  text: string;
  duration?: number;
}

export interface StudioResponseContent {
  type: string;
  [key: string]: any;
}

export interface StudioFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StudioResponseInputItem {
  id?: string;
  type: string;
  role?: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: string;
    text?: string;
    imageUrl?: string;
  }>;
}

export interface StudioResponseOutputItem {
  type: string;
  id?: string;
  [key: string]: any;
}

export interface StudioResponse {
  id: string;
  object: string;
  created?: number;
  model: string;
  status: string;
  choices?: Array<{
    index: number;
    message: {
      role: 'assistant' | 'user';
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  createdAt?: string;
  outputText?: string;
  output?: StudioResponseOutputItem[];
  provider?: string;
  runtime?: RuntimeType;
  modality?: Modality;
  providerOptions?: Record<string, any>;
}

export interface StudioResponseRequest {
  model: string;
  input: string | Array<{
    type: string;
    role?: 'system' | 'user' | 'assistant';
    content: string | Array<{
      type: string;
      text?: string;
      imageUrl?: string;
    }>;
  }>;
  stream?: boolean;
  tools?: any[];
  runtime?: RuntimeType;
  modality: 'text' | 'image' | 'audio' | 'video' | '3d';
  provider: string;
  providerOptions?: Record<string, any>;
  [key: string]: any;
}