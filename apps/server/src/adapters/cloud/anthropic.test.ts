import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicAdapter } from './anthropic.js';

describe('AnthropicAdapter', () => {
  const apiKey = 'anthropic-key';
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

  it('sends x-api-key header for validateConnection', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const adapter = new AnthropicAdapter(apiKey);
    const ok = await adapter.validateConnection();
    expect(ok).toBe(true);
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['x-api-key'] || opts.headers['X-Api-Key']).toBe(apiKey);
  });

  it('sends x-api-key for chat and returns content', async () => {
    const fakeJson = { content: [{ text: 'anthropic-text' }] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => fakeJson });
    const adapter = new AnthropicAdapter(apiKey);
    const out = await adapter.chat('claude-test', [{ id: 'u', role: 'user', content: 'hi' } as any], {}, undefined as any);
    expect(out).toBe('anthropic-text');
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(_url).toContain('/messages');
    expect(opts.headers['x-api-key'] || opts.headers['X-Api-Key']).toBe(apiKey);
  });
});
