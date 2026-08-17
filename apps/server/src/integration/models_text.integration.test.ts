import { vi } from 'vitest';

// Mock the shared helpers used by /api/text handlers so dynamic imports resolve reliably in tests
vi.mock('@lofiaistudio/shared', () => ({
  completionToResponseRequest: ({ modelId, prompt, params }: any) => ({
    model: modelId,
    input: prompt,
    providerOptions: { localai: { operation: 'completion', ...params } },
  }),
  chatToResponseRequest: ({ modelId, messages, params }: any) => ({
    model: modelId,
    input: messages,
    providerOptions: { localai: { ...params } },
  }),
  responseOutputText: (studioResponse: any) => studioResponse.outputText ?? '',
}));

import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { Router } from 'express';
import { createApiRouteHelpers } from '../routes/api/context.js';
import { registerApiRoutes } from '../routes/api/registerApiRoutes.js';

import { makeFakeTextAdapter, makeFakeAdapterRegistry } from '../test-utils/sharedTestLoaders.js';

describe('API integration (models, runtimes, text endpoints)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const router = Router();
    const helpers = createApiRouteHelpers(router);

    const fakeAdapter = makeFakeTextAdapter();
    const fakeRegistry = makeFakeAdapterRegistry(fakeAdapter);

    const context = {
      router,
      adapterRegistry: fakeRegistry,
      ...helpers,
      runWorkflow: async () => ({ id: 'wf', trigger: 'test', status: 'completed' }),
      getAudioModel: async () => undefined,
      getVideoModel: async () => undefined,
    } as any;

    // Provide a simple loadShared implementation for tests to avoid runtime package resolution
    const testLoadShared = async () => ({
      completionToResponseRequest: ({ modelId, prompt, params }: any) => ({ model: modelId, input: prompt, providerOptions: { localai: { operation: 'completion', ...params } } }),
      chatToResponseRequest: ({ modelId, messages, params }: any) => ({
        model: modelId,
        // Convert ChatMessage[] into StudioResponseInputItem[] expected by runStudioResponse
        input: (messages || []).map((m: any) => ({ type: 'message', role: m.role, content: [{ type: 'input_text', text: typeof m.content === 'string' ? m.content : (m.content?.text ?? '') }] })),
        providerOptions: { localai: { ...params } },
      }),
      responseOutputText: (studioResponse: any) => studioResponse.outputText ?? '',
    });

    registerApiRoutes(context, { loadShared: testLoadShared });
    app.use('/api', router);
  });

  it('GET /api/models/text returns text models from adapters', async () => {
    const res = await request(app).get('/api/models/text').expect(200);
    expect(res.body.success).toBe(true);
    const models = res.body.data as any[];
    expect(models.some((m) => m.modality === 'text')).toBe(true);
  });

  it('GET /api/runtimes returns adapter statuses', async () => {
    const res = await request(app).get('/api/runtimes').expect(200);
    expect(res.body.success).toBe(true);
    const statuses = res.body.data as any[];
    expect(Array.isArray(statuses)).toBe(true);
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('POST /api/runtimes/connect triggers connectAll and returns statuses', async () => {
    const res = await request(app).post('/api/runtimes/connect').expect(200);
    expect(res.body.success).toBe(true);
    const statuses = res.body.data as any[];
    expect(statuses[0].connected).toBe(true);
  });

  it('POST /api/text/complete returns completion text', async () => {
    const payload = { modelId: 'fake-text-model', prompt: 'say hi', params: {} };
    const res = await request(app).post('/api/text/complete').send(payload);
    if (res.status !== 200) console.error('debug /api/text/complete response:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.text).toContain('say hi');
  });

  it('POST /api/text/chat returns chat text output', async () => {
    const payload = { modelId: 'fake-text-model', messages: [{ role: 'user', content: 'how are you?' }], params: {} };
    const res = await request(app).post('/api/text/chat').send(payload);
    if (res.status !== 200) console.error('debug /api/text/chat response:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.text).toContain('how are you?');
  });
});
