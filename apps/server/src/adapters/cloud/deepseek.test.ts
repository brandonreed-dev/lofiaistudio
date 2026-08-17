import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepseekAdapter } from './deepseek.js';

describe('DeepseekAdapter', () => {
  const apiKey = 'deepseek-key';
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error -- assigning/deleting mocked fetch
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error -- assigning/deleting mocked fetch
    delete (globalThis as any).fetch;
  });

  it('sends Bearer authorization for validateConnection', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const adapter = new DeepseekAdapter(apiKey);
    const ok = await adapter.validateConnection();
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization || opts.headers['Authorization']).toBe('Bearer ' + apiKey);
  });

  it('sends Bearer authorization for chat and returns content', async () => {
    const fakeJson = { choices: [{ message: { content: 'ds-response' } }] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => fakeJson });
    const adapter = new DeepseekAdapter(apiKey);
    const out = await adapter.chat('model-x', [{ id: 'm', role: 'user', content: 'hey' } as any], {}, undefined as any);
    expect(out).toBe('ds-response');
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(_url).toContain('/chat/completions');
    expect(opts.headers.Authorization || opts.headers['Authorization']).toBe('Bearer ' + apiKey);
  });
});
