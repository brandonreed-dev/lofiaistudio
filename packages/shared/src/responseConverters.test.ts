import { describe, expect, it } from 'vitest';
import {
  chatToResponseRequest,
  imageToResponseRequest,
  responseImages,
  responseOutputText,
  videoToResponseRequest,
} from './responseConverters';

describe('response converters', () => {
  it('maps chat, image, and video inputs into response requests', () => {
    const chat = chatToResponseRequest({
      modelId: 'llama3',
      systemPrompt: 'Be direct.',
      messages: [{ role: 'user', content: 'Hello' }],
      params: { temperature: 0.2, maxTokens: 64 },
    });
    expect(chat.modality).toBe('text');
    expect(chat.providerOptions.localai.operation).toBe('chat');
    expect(chat.maxOutputTokens).toBe(64);
    expect(Array.isArray(chat.input)).toBe(true);

    expect(imageToResponseRequest({ modelId: 'sdxl', prompt: 'desk' }).providerOptions.localai.operation).toBe('text-to-image');
    expect(videoToResponseRequest({ modelId: 'wan', prompt: 'pan', referenceImage: 'data:image/png;base64,abc' }).providerOptions.localai.operation).toBe('image-to-video');
  });

  it('extracts response outputs', () => {
    expect(responseOutputText({
      id: 'r',
      object: 'response',
      createdAt: new Date(0).toISOString(),
      model: 'm',
      status: 'completed',
      provider: 'local',
      output: [{ type: 'message', id: 'o', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }],
    })).toBe('ok');

    expect(responseImages({
      id: 'r',
      object: 'response',
      createdAt: new Date(0).toISOString(),
      model: 'm',
      status: 'completed',
      provider: 'local',
      output: [{ type: 'image_generation_call', id: 'i', result: 'data:image/png;base64,x', seed: 7 }],
    })).toEqual({ images: ['data:image/png;base64,x'], seeds: [7] });
  });
});
