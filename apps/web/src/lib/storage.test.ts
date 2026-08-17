import { describe, expect, it, vi } from 'vitest';
import { readJsonStorage, writeJsonStorage } from './storage';

describe('storage helpers', () => {
  it('returns fallback for missing or invalid JSON', () => {
    expect(readJsonStorage('missing', ['fallback'], { getItem: () => null })).toEqual(['fallback']);
    expect(readJsonStorage('bad', { ok: true }, { getItem: () => '{' })).toEqual({ ok: true });
  });

  it('writes JSON and ignores storage failures', () => {
    const setItem = vi.fn();
    writeJsonStorage('key', { value: 1 }, { setItem });
    expect(setItem).toHaveBeenCalledWith('key', '{"value":1}');

    expect(() => writeJsonStorage('key', { value: 1 }, { setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });
});
