import { describe, expect, it } from 'vitest';
import { isPcmWav } from '../domain/voice-audio.policy';

/**
 * Which bytes a dictation may be: 16-bit PCM WAV only, judged by the bytes,
 * so a provider is never handed something it will choke on and a script
 * cannot send it anything else under a WAV label.
 */

/** A WAV header and `samples` of silence, with the fields the policy reads overridable. */
function wav({
  format = 1,
  channels = 1,
  bits = 16,
  samples = 160,
  extraChunk = false,
}: {
  format?: number;
  channels?: number;
  bits?: number;
  samples?: number;
  extraChunk?: boolean;
} = {}): Buffer {
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(format, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(16_000, 12);
  fmt.writeUInt32LE(16_000 * channels * (bits / 8), 16);
  fmt.writeUInt16LE(channels * (bits / 8), 20);
  fmt.writeUInt16LE(bits, 22);
  // An odd-sized chunk before `data`, which the walk must step over with its padding.
  const list = extraChunk
    ? Buffer.concat([Buffer.from('LIST'), Buffer.from([3, 0, 0, 0, 1, 2, 3, 0])])
    : Buffer.alloc(0);
  const data = Buffer.alloc(8 + samples * 2);
  data.write('data', 0, 'ascii');
  data.writeUInt32LE(samples * 2, 4);
  const body = Buffer.concat([Buffer.from('WAVE'), fmt, list, data]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

describe('isPcmWav', () => {
  it('takes 16-bit PCM, mono or stereo, past a chunk it does not read', () => {
    expect(isPcmWav(wav())).toBe(true);
    expect(isPcmWav(wav({ channels: 2 }))).toBe(true);
    expect(isPcmWav(wav({ extraChunk: true }))).toBe(true);
  });

  it('refuses compressed or 8-bit WAV, and a WAV with no sound in it', () => {
    expect(isPcmWav(wav({ format: 3 }))).toBe(false);
    expect(isPcmWav(wav({ bits: 8 }))).toBe(false);
    expect(isPcmWav(wav({ samples: 0 }))).toBe(false);
  });

  it('refuses what is not a WAV at all, whatever it was labelled', () => {
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(60)]);
    expect(isPcmWav(webm)).toBe(false);
    expect(isPcmWav(Buffer.from('RIFF'))).toBe(false);
  });
});
