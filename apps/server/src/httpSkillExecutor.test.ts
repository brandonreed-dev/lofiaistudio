import { describe, it, expect } from 'vitest';
import { resolveSkillFetchUrl } from './httpSkillExecutor';

describe('resolveSkillFetchUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveSkillFetchUrl('https://example.com/foo')).toBe('https://example.com/foo');
  });

  it('prefixes leading slash with LOFIAI_API_SELF_ORIGIN env', () => {
    process.env.LOFIAI_API_SELF_ORIGIN = 'http://127.0.0.1:4000/';
    expect(resolveSkillFetchUrl('/api/test')).toBe('http://127.0.0.1:4000/api/test');
    delete process.env.LOFIAI_API_SELF_ORIGIN;
  });

  it('prefixes leading slash with PORT env fallback', () => {
    delete process.env.LOFIAI_API_SELF_ORIGIN;
    process.env.PORT = '5000';
    expect(resolveSkillFetchUrl('/api/x')).toBe('http://127.0.0.1:5000/api/x');
    delete process.env.PORT;
  });

  it('returns relative paths unchanged', () => {
    expect(resolveSkillFetchUrl('relative/path')).toBe('relative/path');
  });
});
