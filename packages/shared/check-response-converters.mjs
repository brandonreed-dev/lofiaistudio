import assert from 'node:assert/strict';
import {
  audioSpeechToRequest,
  audioTranscriptionToRequest,
  chatToResponseRequest,
  completionToResponseRequest,
  imageToResponseRequest,
  responseImages,
  responseOutputText,
  responseVideo,
  videoToResponseRequest,
} from './dist/responseConverters.js';

const chat = chatToResponseRequest({
  modelId: 'llama3',
  systemPrompt: 'Be direct.',
  messages: [{ role: 'user', content: 'Hello' }],
  params: { temperature: 0.2, maxTokens: 64 },
});
assert.equal(chat.modality, 'text');
assert.equal(chat.providerOptions.localai.operation, 'chat');
assert.equal(chat.maxOutputTokens, 64);
assert.equal(Array.isArray(chat.input), true);

const completion = completionToResponseRequest({ modelId: 'llama3', prompt: 'Finish this' });
assert.equal(completion.input, 'Finish this');

const image = imageToResponseRequest({
  modelId: 'sdxl.safetensors',
  prompt: 'A workshop desk',
  negativePrompt: 'blur',
  params: { width: 512, height: 512 },
});
assert.equal(image.tools[0].type, 'image_generation');
assert.equal(image.providerOptions.localai.operation, 'text-to-image');

const video = videoToResponseRequest({
  modelId: 'wan.safetensors',
  prompt: 'Camera pan',
  referenceImage: 'data:image/png;base64,abc',
});
assert.equal(video.providerOptions.localai.operation, 'image-to-video');

const transcription = audioTranscriptionToRequest({
  modelId: 'qwen3-asr',
  audioData: 'data:audio/wav;base64,abc',
  params: { language: 'en', translate: true },
});
assert.equal(transcription.language, 'en');
assert.equal(transcription.translate, true);

const speech = audioSpeechToRequest({
  modelId: 'qwen3-tts',
  text: 'Hi',
  params: { speed: 1.1, outputFormat: 'wav' },
});
assert.equal(speech.input, 'Hi');
assert.equal(speech.responseFormat, 'wav');

assert.equal(responseOutputText({
  id: 'r',
  object: 'response',
  createdAt: new Date(0).toISOString(),
  model: 'm',
  status: 'completed',
  provider: 'local',
  output: [{ type: 'message', id: 'o', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }],
}), 'ok');

assert.deepEqual(responseImages({
  id: 'r',
  object: 'response',
  createdAt: new Date(0).toISOString(),
  model: 'm',
  status: 'completed',
  provider: 'local',
  output: [{ type: 'image_generation_call', id: 'i', result: 'data:image/png;base64,x', seed: 7 }],
}), { images: ['data:image/png;base64,x'], seeds: [7] });

assert.deepEqual(responseVideo({
  id: 'r',
  object: 'response',
  createdAt: new Date(0).toISOString(),
  model: 'm',
  status: 'completed',
  provider: 'local',
  output: [{ type: 'output_video', id: 'v', videoFile: 'video.mp4', duration: 1, frames: 20 }],
}), { videoFile: 'video.mp4', duration: 1, frames: 20 });

console.log('response converter self-check passed');
