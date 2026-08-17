import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { Router } from 'express';
import { createApiRouteHelpers } from '../routes/api/context.js';
import { registerApiRoutes } from '../routes/api/registerApiRoutes.js';
import { makeFakeTextAdapter, makeFakeAdapterRegistry, testLoadShared } from '../test-utils/sharedTestLoaders.js';

// Minimal fake adapter to exercise runStudioResponse for text modality is supplied by sharedTestLoaders

describe('API integration (registerApiRoutes)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const router = Router();
    const helpers = createApiRouteHelpers(router);

    const fakeAdapter = makeFakeTextAdapter();
    const fakeRegistry = makeFakeAdapterRegistry(fakeAdapter);

    // Provide minimal context expected by registerApiRoutes
    const context = {
      router,
      adapterRegistry: fakeRegistry,
      ...helpers,
      runWorkflow: async () => ({ id: 'wf', trigger: 'test', status: 'completed' }),
      getAudioModel: async () => undefined,
      getVideoModel: async () => undefined,
    } as any;

    registerApiRoutes(context, { loadShared: testLoadShared });
    app.use('/api', router);
  });

  it('GET /api/settings returns app settings', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('POST /api/responses for text modality returns generated text', async () => {
    const payload = {
      model: 'fake-text-model',
      input: 'hello world',
      providerOptions: { localai: { modality: 'text' } },
    };

    const res = await request(app).post('/api/responses').send(payload).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('output');
    const outputText = res.body.data.outputText as string;
    expect(outputText).toContain('hello world');
  });
});
