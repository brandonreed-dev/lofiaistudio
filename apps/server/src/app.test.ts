import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

const configDir = mkdtempSync(join(tmpdir(), 'lofi-studio-test-'));
process.env.LOFIAISTUDIO_CONFIG_DIR = configDir;

import { vi } from 'vitest';

// Mock the shared package for tests to avoid requiring the built package during test discovery
vi.mock('@lofiaistudio/shared', () => ({
  audioSpeechToRequest: () => ({}),
  audioTranscriptionToRequest: () => ({}),
  chatToResponseRequest: () => ({}),
  completionToResponseRequest: () => ({}),
  imageToResponseRequest: () => ({}),
  responseImages: () => [],
  responseOutputText: () => '',
  responseVideo: () => '',
  videoToResponseRequest: () => ({}),
}));

const { createApp } = await import('./app');

describe('createApp', () => {
  afterAll(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it('serves health and settings without touching the user config dir', async () => {
    const { app } = createApp();

    await request(app).get('/health').expect(200).expect((res) => {
      expect(res.body.status).toBe('ok');
    });

    await request(app).get('/api/settings').expect(200).expect((res) => {
      expect(res.body.success).toBe(true);
    });
  });
});
