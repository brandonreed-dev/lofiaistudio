import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { Router } from 'express';
import { createApiRouteHelpers } from '../routes/api/context.js';
import { registerApiRoutes } from '../routes/api/registerApiRoutes.js';
import { makeFakeTextAdapter, makeFakeAdapterRegistry, testLoadShared } from '../test-utils/sharedTestLoaders.js';

// Fake image adapter extends text adapter with image methods
function makeFakeImageAdapter() {
  const base = makeFakeTextAdapter();
  return {
    ...base,
    textToImage: async (id: string, prompt: string) => ({ images: [`image-for-${prompt}`], seeds: [123] }),
    imageToImage: async (id: string, prompt: string, negativePrompt: string | null, referenceImage: string) => ({ images: [`transformed-${referenceImage}`], seeds: [456] }),
    getSupportedModalities: () => ['image', 'text'],
    getModels: async () => [{ id: 'fake-image-model', modality: 'image', runtime: 'local' }],
  } as any;
}

describe('API integration (image modality)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const router = Router();
    const helpers = createApiRouteHelpers(router);

    const fakeAdapter = makeFakeImageAdapter();
    const fakeRegistry = makeFakeAdapterRegistry(fakeAdapter);

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

  it('POST /api/responses with image modality (textToImage) returns images', async () => {
    const payload = {
      model: 'fake-image-model',
      input: 'a sunset over a lake',
      providerOptions: { localai: { modality: 'image' } },
    };

    const res = await request(app).post('/api/responses').send(payload).expect(200);
    expect(res.body.success).toBe(true);
    const images = res.body.data.output?.filter((i: any) => i.type === 'image_generation_call').map((it: any) => it.result) ?? [];
    expect(images.length).toBeGreaterThan(0);
  });

  it('POST /api/responses with image modality (imageToImage) returns transformed image', async () => {
    const payload = {
      model: 'fake-image-model',
      input: 'modify this image',
      providerOptions: { localai: { modality: 'image', referenceImage: 'ref-123' } },
    };

    const res = await request(app).post('/api/responses').send(payload).expect(200);
    expect(res.body.success).toBe(true);
    const images = res.body.data.output?.filter((i: any) => i.type === 'image_generation_call').map((it: any) => it.result) ?? [];
    expect(images.length).toBeGreaterThan(0);
    // Each image result is a string like 'transformed-ref-123'
    expect(images[0]).toContain('transformed-ref-123');
  });

  it('POST /api/responses returns 404 or error for missing model', async () => {
    const payload = {
      model: 'nonexistent-model',
      input: 'foo',
      providerOptions: { localai: { modality: 'image' } },
    };

    const res = await request(app).post('/api/responses').send(payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
