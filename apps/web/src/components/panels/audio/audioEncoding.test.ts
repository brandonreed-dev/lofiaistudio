import { describe, expect, it } from 'vitest';
import { encodeWav } from './audioEncoding';

describe('encodeWav', () => {
  it('writes a valid 16-bit PCM WAV header', async () => {
    const samples = new Float32Array([0, 1, -1]);
    const blob = encodeWav({
      numberOfChannels: 1,
      sampleRate: 16000,
      length: samples.length,
      getChannelData: () => samples,
    } as unknown as AudioBuffer);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

    expect(blob.type).toBe('audio/wav');
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(samples.length * 2);
  });
});
