import type {
  AudioParams,
  ChatMessage,
  ImageGenerationParams,
  Model3DGenerationParams,
  RuntimeType,
  StudioAudioSpeechRequest,
  StudioAudioTranscriptionRequest,
  StudioFunctionTool,
  StudioResponse,
  StudioResponseInputItem,
  StudioResponseRequest,
  TextGenerationParams,
  VideoGenerationParams,
} from './types/index.js';

function textParams(params: TextGenerationParams = {}): Pick<StudioResponseRequest, 'temperature' | 'topP' | 'maxOutputTokens' | 'seed'> {
  return {
    temperature: params.temperature,
    topP: params.topP,
    maxOutputTokens: params.maxTokens,
    seed: params.seed,
  };
}

export function chatToResponseRequest(input: {
  modelId: string;
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>;
  params?: TextGenerationParams;
  systemPrompt?: string;
  runtime?: RuntimeType;
  stream?: boolean;
  tools?: StudioFunctionTool[];
}): StudioResponseRequest {
  const messages: StudioResponseInputItem[] = input.messages.map((message) => ({
    type: 'message',
    role: message.role,
    content: message.content,
  }));

  return {
    model: input.modelId,
    input: input.systemPrompt
      ? [{ type: 'message', role: 'system', content: input.systemPrompt }, ...messages]
      : messages,
    stream: input.stream,
    tools: input.tools,
    runtime: input.runtime,
    modality: 'text',
    provider: 'local',
    providerOptions: {
      localai: {
        modality: 'text',
        runtime: input.runtime,
        operation: 'chat',
        text: input.params,
      },
    },
    ...textParams(input.params),
  };
}

export function completionToResponseRequest(input: {
  modelId: string;
  prompt: string;
  params?: TextGenerationParams;
  runtime?: RuntimeType;
  stream?: boolean;
}): StudioResponseRequest {
  return {
    model: input.modelId,
    input: input.prompt,
    stream: input.stream,
    runtime: input.runtime,
    modality: 'text',
    provider: 'local',
    providerOptions: {
      localai: {
        modality: 'text',
        runtime: input.runtime,
        operation: 'completion',
        text: input.params,
      },
    },
    ...textParams(input.params),
  };
}

export function imageToResponseRequest(input: {
  modelId: string;
  prompt: string;
  negativePrompt?: string | null;
  referenceImage?: string;
  params?: ImageGenerationParams;
  runtime?: RuntimeType;
}): StudioResponseRequest {
  return {
    model: input.modelId,
    input: input.referenceImage
      ? [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: input.prompt },
              { type: 'input_image', imageUrl: input.referenceImage },
            ],
          },
        ]
      : input.prompt,
    tools: [{ type: 'image_generation' }],
    runtime: input.runtime,
    modality: 'image',
    provider: 'local',
    providerOptions: {
      localai: {
        modality: 'image',
        runtime: input.runtime,
        operation: input.referenceImage ? 'image-to-image' : 'text-to-image',
        negativePrompt: input.negativePrompt,
        referenceImage: input.referenceImage,
        image: input.params,
      },
    },
  };
}

export function videoToResponseRequest(input: {
  modelId: string;
  prompt: string;
  referenceImage?: string;
  params?: VideoGenerationParams;
  runtime?: RuntimeType;
}): StudioResponseRequest {
  return {
    model: input.modelId,
    input: input.referenceImage
      ? [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: input.prompt },
              { type: 'input_image', imageUrl: input.referenceImage },
            ],
          },
        ]
      : input.prompt,
    runtime: input.runtime,
    modality: 'video',
    provider: 'local',
    providerOptions: {
      localai: {
        modality: 'video',
        runtime: input.runtime,
        operation: input.referenceImage ? 'image-to-video' : 'text-to-video',
        referenceImage: input.referenceImage,
        video: input.params,
      },
    },
  };
}

export function audioTranscriptionToRequest(input: {
  modelId: string;
  audioData: string;
  params?: AudioParams;
  runtime?: RuntimeType;
}): StudioAudioTranscriptionRequest {
  return {
    model: input.modelId,
    file: input.audioData,
    runtime: input.runtime,
    language: input.params?.language,
    translate: input.params?.translate,
    responseFormat: 'json',
  };
}

export function audioSpeechToRequest(input: {
  modelId: string;
  text: string;
  params?: AudioParams;
  runtime?: RuntimeType;
}): StudioAudioSpeechRequest {
  return {
    model: input.modelId,
    input: input.text,
    runtime: input.runtime,
    speed: input.params?.speed,
    pitch: input.params?.pitch,
    responseFormat: input.params?.outputFormat,
  };
}

export function responseOutputText(response: StudioResponse): string {
  return response.outputText ?? (response.output ?? [])
    .flatMap((item) => item.type === 'message' ? (item.content ?? []).map((part: Record<string, unknown>) => part.text as string) : [])
    .join('');
}

export function responseImages(response: StudioResponse): { images: string[]; seeds: number[] } {
  const imageItems = (response.output ?? []).filter((item) => item.type === 'image_generation_call');
  return {
    images: imageItems.map((item) => (item as Record<string, unknown>).result as string),
    seeds: imageItems.map((item) => (item as Record<string, unknown>).seed).filter((seed): seed is number => typeof seed === 'number'),
  };
}

export function responseVideo(response: StudioResponse): { videoFile: string; duration: number; frames: number } | undefined {
  const item = (response.output ?? []).find((entry: Record<string, unknown>) => entry.type === 'output_video');
  if (!item || item.type !== 'output_video') return undefined;
  return {
    videoFile: (item.videoFile ?? '') as string,
    duration: (item.duration ?? 0) as number,
    frames: (item.frames ?? 0) as number,
  };
}

export function model3DToResponseRequest(input: {
  modelId: string;
  prompt: string;
  negativePrompt?: string | null;
  referenceImage?: string;
  params?: Model3DGenerationParams;
  runtime?: RuntimeType;
}): StudioResponseRequest {
  return {
    model: input.modelId,
    input: input.referenceImage
      ? [
          {
            type: 'message',
            role: 'user',
            content: [
              { type: 'input_text', text: input.prompt },
              { type: 'input_image', imageUrl: input.referenceImage },
            ],
          },
        ]
      : input.prompt,
    tools: [{ type: '3d_generation' }],
    runtime: input.runtime,
    modality: '3d',
    provider: 'local',
    providerOptions: {
      localai: {
        modality: '3d',
        runtime: input.runtime,
        operation: input.referenceImage ? 'image-to-3d' : 'text-to-3d',
        negativePrompt: input.negativePrompt,
        referenceImage: input.referenceImage,
        model3d: input.params,
      },
    },
  };
}

export function responseModel3D(response: StudioResponse): { modelFiles: string[]; seeds: number[] } {
  const modelItems = (response.output ?? []).filter((item) => item.type === '3d_generation_call');
  return {
    modelFiles: modelItems.map((item) => (item as Record<string, unknown>).result as string),
    seeds: modelItems.map((item) => (item as Record<string, unknown>).seed).filter((seed): seed is number => typeof seed === 'number'),
  };
}

