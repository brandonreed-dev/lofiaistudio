import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relativeTime, triggerDownload } from './panelPrimitives';

describe('relativeTime', () => {
  const RealDate = Date;

  beforeEach(() => {
    const fixedNow = new Date('2024-01-15T12:00:00Z').getTime();
    global.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) return new RealDate(fixedNow);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (RealDate as any)(...args);
      }
      static now() {
        return fixedNow;
      }
    } as typeof Date;
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('returns "now" for a recent future timestamp', () => {
    const ts = new Date(Date.now() + 10_000).toISOString();
    expect(relativeTime(ts)).toBe('now');
  });

  it('returns "just now" for a recent past timestamp', () => {
    const ts = new Date(Date.now() - 10_000).toISOString();
    expect(relativeTime(ts)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const ts = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(ts)).toBe('5m ago');
  });

  it('returns hours from now', () => {
    const ts = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    expect(relativeTime(ts)).toBe('3h from now');
  });

  it('falls back to locale date for >24h', () => {
    const ts = new Date(Date.now() - 2 * 24 * 60 * 60_000 + 1_000).toISOString();
    const result = relativeTime(ts);
    expect(typeof result).toBe('string');
    expect(result).not.toContain('ago');
    expect(result).not.toContain('from now');
  });
});

describe('triggerDownload', () => {
  const realDocument = global.document;
  const realCreateObjectURL = global.URL.createObjectURL;
  const realRevokeObjectURL = global.URL.revokeObjectURL;

  afterEach(() => {
    global.document = realDocument;
    global.URL.createObjectURL = realCreateObjectURL;
    global.URL.revokeObjectURL = realRevokeObjectURL;
  });

  it('creates and clicks an anchor element', () => {
    const clickMock = vi.fn();
    global.document = {
      createElement: vi.fn(() => ({ click: clickMock, href: '', download: '', style: {} })),
    } as unknown as Document;

    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();

    triggerDownload('test.json', { hello: 'world' });

    expect(global.document.createElement).toHaveBeenCalledWith('a');
    expect(clickMock).toHaveBeenCalledOnce();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });
});
