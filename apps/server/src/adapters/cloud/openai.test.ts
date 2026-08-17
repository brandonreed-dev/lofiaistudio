import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAdapter } from './openai.js';

describe('OpenAIAdapter', () => {
  const apiKey = 'test-openai-key';
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error -- deleting mocked fetch -- assigning test mock fetch to globalThis
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error -- deleting mocked fetch
    delete (globalThis as any).fetch;
  });

  it('sends Bearer authorization header for validateConnection', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const adapter = new OpenAIAdapter(apiKey);
    const ok = await adapter.validateConnection();
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(typeof _url).toBe('string');
    expect(opts).toHaveProperty('headers');
    expect(opts.headers['Authorization'] || opts.headers.Authorization).toBe('Bearer ' + apiKey);
  });

  it('includes Bearer authorization and content-type on chat requests', async () => {
    // mock non-streaming response
    const fakeJson = { choices: [{ message: { content: 'hello' } }] };
    fetchMock.mockResolvedValue({ ok: true, json: async () => fakeJson });

    const adapter = new OpenAIAdapter(apiKey);
    const result = await adapter.chat('gpt-test', [{ id: 'u1', role: 'user', content: 'hi' } as any], {}, undefined as any);
    expect(result).toBe('hello');

    expect(fetchMock).toHaveBeenCalled();
    const [_url, opts] = fetchMock.mock.calls[0];
    expect(_url).toContain('/chat/completions');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type'] || opts.headers['content-type']).toBe('application/json');
    expect(opts.headers['Authorization'] || opts.headers.Authorization).toBe('Bearer ' + apiKey);
  });
});
