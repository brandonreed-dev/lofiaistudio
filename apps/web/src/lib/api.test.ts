import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps successful API responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: { ok: true } }))));
    await expect(api('/api/example')).resolves.toEqual({ ok: true });
  });

  it('throws ApiError for failed API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 400 }))
    );

    await expect(api('/api/example')).rejects.toMatchObject<ApiError>({ name: 'ApiError', message: 'nope', status: 400 });
  });
});
