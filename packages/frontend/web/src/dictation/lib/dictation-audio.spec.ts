import { describe, expect, it } from 'vitest';
import { DictationMeter, formatElapsed } from './dictation-meter';
import { encodeWav, levelOf } from './wav';

/**
 * What the recorder hands the API and draws: the microphone's samples as a
 * 16 kHz 16-bit mono WAV (the only format the API takes), and the meter the
 * recorder bar reads. The API's `isPcmWav` is the other half of the WAV
 * contract.
 */

async function bytesOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header at the target rate, the samples averaged down to it', async () => {
    const second = new Float32Array(48_000).fill(0.5);
    const view = await bytesOf(
      encodeWav([second.subarray(0, 24_000), second.subarray(24_000)], 48_000, 16_000),
    );
    const text = (offset: number) =>
      String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)));

    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16_000 * 2);
    expect(view.byteLength).toBe(44 + 16_000 * 2);
    expect(view.getInt16(44, true)).toBe(Math.round(0.5 * 0x7fff - 0.5));
  });

  it('stretches a microphone slower than the target rate, so the header never lies about speed', async () => {
    const ramp = new Float32Array([0, 0.5, 1, 0.5]);
    const view = await bytesOf(encodeWav([ramp], 8_000, 16_000));

    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(40, true)).toBe(8 * 2);
    // Every other sample is the one the microphone gave; the ones between are halfway.
    expect(view.getInt16(44 + 2 * 2, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(view.getInt16(44 + 1 * 2, true)).toBe(Math.trunc(0.25 * 0x7fff));
  });

  it('clips what is louder than full scale instead of wrapping it', async () => {
    const view = await bytesOf(encodeWav([new Float32Array([2, -2])], 16_000, 16_000));
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});

describe('the meter', () => {
  it('keeps the last levels, oldest first, and tells its readers', () => {
    const meter = new DictationMeter(2);
    let told = 0;
    meter.subscribe(() => {
      told += 1;
    });
    meter.push(0.1, 100);
    meter.push(0.2, 200);
    meter.push(0.3, 300);
    expect(meter.read()).toEqual({ levels: [0.2, 0.3], elapsedMs: 300 });
    expect(told).toBe(3);
  });

  it('reads silence as nothing and speech as most of the bar', () => {
    expect(levelOf(new Float32Array(10))).toBe(0);
    expect(levelOf(new Float32Array(10).fill(0.2))).toBeCloseTo(0.8);
    expect(levelOf(new Float32Array(10).fill(1))).toBe(1);
  });

  it('says the time as minutes and seconds', () => {
    expect(formatElapsed(7_400)).toBe('0:07');
    expect(formatElapsed(102_000)).toBe('1:42');
  });
});
