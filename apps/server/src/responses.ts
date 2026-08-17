import { v4 as uuidv4 } from 'uuid';
import type {
  AudioParams,
  ChatMessage,
  ImageGenerationParams,
  Model,
  Model3DGenerationParams,
  RuntimeType,
  StudioAudioSpeech,
  StudioAudioSpeechRequest,
  StudioAudioTranscription,
  StudioAudioTranscriptionRequest,
  StudioResponse,
  StudioResponseContent,
  StudioResponseInputItem,
  StudioResponseOutputItem,
  StudioResponseRequest,
  TextGenerationParams,
  VideoGenerationParams,
} from '@lofiaistudio/shared';
import type { AdapterRegistry } from './adapters/index.js';
import type { AudioAdapter, ImageAdapter, TextAdapter, VideoAdapter, Model3DAdapter } from './adapters/base.js';

type RunOptions = {
  onTextDelta?: (delta: string) => void;
};

// Local result shapes (structurally identical to the shared package types).
// Declared locally to keep responses.ts self-contained and avoid cross-package
// resolution surprises in the server build.
type AudioTranscriptionResult = {
  type: 'audio_transcription';
  text: string;
  duration?: number;
};

function now(): string {
  return new Date().toISOString();
}

function responseBase(request: StudioResponseRequest, output: StudioResponseOutputItem[]): StudioResponse {
  return {
    id: uuidv4(),
    object: 'response',
    createdAt: now(),
    model: request.model,
    status: 'completed',
    output,
    outputText: output
      .flatMap((item) => item.type === 'message' ? item.content.map((part: { type: string; text?: string }) => part.text ?? '') : [])
      .join(''),
    provider: request.provider ?? 'local',
    runtime: request.runtime ?? request.providerOptions?.localai?.runtime,
    modality: request.modality ?? request.providerOptions?.localai?.modality,
  };
}

function textParams(request: StudioResponseRequest): TextGenerationParams {
  return {
    temperature: request.temperature ?? request.providerOptions?.localai?.text?.temperature,
    topP: request.topP ?? request.providerOptions?.localai?.text?.topP,
    maxTokens: request.maxOutputTokens ?? request.providerOptions?.localai?.text?.maxTokens,
    seed: request.seed ?? request.providerOptions?.localai?.text?.seed,
    topK: request.providerOptions?.localai?.text?.topK,
    repeatPenalty: request.providerOptions?.localai?.text?.repeatPenalty,
    stop: request.providerOptions?.localai?.text?.stop,
  };
}

function contentText(content: string | StudioResponseContent[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((part) => part.type === 'input_text')
    .map((part) => part.text)
    .join('\n');
}

function contentImage(content: string | StudioResponseContent[]): string | undefined {
  if (typeof content === 'string') return undefined;
  return content.find((part) => part.type === 'input_image')?.imageUrl;
}

function inputItems(input: StudioResponseRequest['input']): StudioResponseInputItem[] {
  return typeof input === 'string'
    ? [{ type: 'message', role: 'user', content: input }]
    : input;
}

function promptFromRequest(request: StudioResponseRequest): string {
  if (typeof request.input === 'string') return request.input;
  const lastMessage = [...request.input]
    .reverse()
    .find((item) => item.type === 'message' && item.role !== 'system');
  return lastMessage?.type === 'message' ? contentText(lastMessage.content) : '';
}

function referenceImageFromRequest(request: StudioResponseRequest): string | undefined {
  if (request.providerOptions?.localai?.referenceImage) return request.providerOptions.localai.referenceImage;
  if (typeof request.input === 'string') return undefined;
  const lastMessage = [...request.input]
    .reverse()
    .find((item) => item.type === 'message' && contentImage(item.content));
  return lastMessage?.type === 'message' ? contentImage(lastMessage.content) : undefined;
}

function messagesFromRequest(request: StudioResponseRequest): ChatMessage[] {
  const items = inputItems(request.input).filter((item) => item.type === 'message');
  const messages = items
    .filter((item): item is StudioResponseInputItem & { role: 'system' | 'user' | 'assistant' } =>
      item.role === 'system' || item.role === 'user' || item.role === 'assistant')
    .map((item): ChatMessage => ({
      id: item.id ?? uuidv4(),
      role: item.role,
      content: contentText(item.content),
      timestamp: new Date(),
    }));

  if (request.instructions) {
    return [
      {
        id: 'instructions',
        role: 'system',
        content: request.instructions,
        timestamp: new Date(),
      },
      ...messages,
    ];
  }

  return messages;
}

async function findModel(
  adapterRegistry: AdapterRegistry,
  modelId: string,
  modality: Model['modality'],
  runtime?: RuntimeType
) {
  const direct = await adapterRegistry.findModel(modelId, runtime);
  if (direct && direct.model.modality === modality) return direct;

  if (runtime) return undefined;

  // ponytail: fallback is an O(n) scan over local adapters; upgrade to indexed registry if model counts get large.
  for (const adapter of adapterRegistry.getAll()) {
    if (!adapter.getSupportedModalities().includes(modality)) continue;
    const model = (await adapter.getModels()).find((entry) => entry.modality === modality && (!modelId || entry.id === modelId));
    if (model) return { adapter, model };
  }

  return undefined;
}

export async function runStudioResponse(
  adapterRegistry: AdapterRegistry,
  request: StudioResponseRequest,
  options: RunOptions = {}
): Promise<StudioResponse> {
  const modality = request.modality ?? request.providerOptions?.localai?.modality ?? 'text';
  const runtime = request.runtime ?? request.providerOptions?.localai?.runtime;

  if (modality === 'text') {
    const match = await findModel(adapterRegistry, request.model, 'text', runtime);
    if (!match) throw new Error(`Text model not found: ${request.model}`);
    if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

    const adapter = match.adapter as TextAdapter;
    const operation = request.providerOptions?.localai?.operation;
    const text = operation === 'completion' || typeof request.input === 'string'
      ? await adapter.complete(match.model.id, promptFromRequest(request), textParams(request), options.onTextDelta)
      : await adapter.chat(match.model.id, messagesFromRequest(request), textParams(request), options.onTextDelta);

    return responseBase(request, [
      {
        type: 'message',
        id: uuidv4(),
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      },
    ]);
  }

  if (modality === 'image') {
    const match = await findModel(adapterRegistry, request.model, 'image', runtime);
    if (!match) throw new Error(`Image model not found: ${request.model}`);
    if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

    const adapter = match.adapter as ImageAdapter;
    const prompt = promptFromRequest(request);
    const referenceImage = referenceImageFromRequest(request);
    const params = request.providerOptions?.localai?.image ?? {};
    const negativePrompt = request.providerOptions?.localai?.negativePrompt ?? null;
    const result = referenceImage
      ? await adapter.imageToImage(match.model.id, prompt, negativePrompt, referenceImage, params as ImageGenerationParams)
      : await adapter.textToImage(match.model.id, prompt, negativePrompt, params as ImageGenerationParams);

    return responseBase(request, result.images.map((image, index) => ({
      type: 'image_generation_call',
      id: uuidv4(),
      result: image,
      seed: result.seeds[index],
    })));
  }

  if (modality === 'video') {
    const match = await findModel(adapterRegistry, request.model, 'video', runtime);
    if (!match) throw new Error(`Video model not found: ${request.model}`);
    if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

    const adapter = match.adapter as VideoAdapter;
    const prompt = promptFromRequest(request);
    const referenceImage = referenceImageFromRequest(request);
    const params = request.providerOptions?.localai?.video ?? {};
    const result = referenceImage
      ? await adapter.imageToVideo(match.model.id, prompt, referenceImage, params as VideoGenerationParams)
      : await adapter.textToVideo(match.model.id, prompt, params as VideoGenerationParams);

    return responseBase(request, [
      {
        type: 'output_video',
        id: uuidv4(),
        videoFile: result.videoFile,
        duration: result.duration,
        frames: result.frames,
      },
    ]);
  }

  if (modality === '3d') {
    const match = await findModel(adapterRegistry, request.model, '3d', runtime);
    if (!match) throw new Error(`3D model not found: ${request.model}`);
    if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

    const adapter = match.adapter as Model3DAdapter;
    const prompt = promptFromRequest(request);
    const referenceImage = referenceImageFromRequest(request);
    const params = (request.providerOptions?.localai?.model3d ?? {}) as Model3DGenerationParams;
    const negativePrompt = request.providerOptions?.localai?.negativePrompt ?? null;
    const result = referenceImage
      ? await adapter.imageTo3D(match.model.id, prompt, negativePrompt, referenceImage, params)
      : await adapter.textTo3D(match.model.id, prompt, negativePrompt, params);

    return responseBase(request, result.modelFiles.map((modelFile, index) => ({
      type: '3d_generation_call',
      id: uuidv4(),
      result: modelFile,
      seed: result.seeds[index],
    })));
  }

  throw new Error(`Responses do not handle ${modality} requests yet; use the audio endpoints for STT/TTS.`);
}

export async function runStudioAudioTranscription(
  adapterRegistry: AdapterRegistry,
  request: StudioAudioTranscriptionRequest
) {
  const match = await findModel(adapterRegistry, request.model, 'audio', request.runtime);
  if (!match) throw new Error(`Audio STT model not found: ${request.model}`);
  if (match.model.modality !== 'audio' || match.model.type !== 'stt') {
    throw new Error(`Model ${request.model} does not support speech-to-text`);
  }
  if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

  const params: AudioParams = {
    language: request.language,
    translate: request.translate,
  };
    return {
      type: 'audio_transcription',
      text: await (match.adapter as AudioAdapter).transcribe(match.model.id, request.file, params),
      duration: 0,
    };
}

export async function runStudioAudioSpeech(
  adapterRegistry: AdapterRegistry,
  request: StudioAudioSpeechRequest
  ) {
    const match = await findModel(adapterRegistry, request.model, 'audio', request.runtime);
    if (!match) throw new Error(`Audio TTS model not found: ${request.model}`);
    if (match.model.modality !== 'audio' || match.model.type !== 'tts') {
      throw new Error(`Model ${request.model} does not support text-to-speech`);
    }
    if (!match.adapter.isConnected()) throw new Error(`${match.model.runtime} adapter not connected`);

    const params: AudioParams = {
      speed: request.speed,
      pitch: request.pitch,
      outputFormat: request.responseFormat,
    };
    return {
      type: 'audio_speech',
      audioFile: await (match.adapter as AudioAdapter).synthesize(match.model.id, request.input, params),
      duration: 0,
    };
  }

