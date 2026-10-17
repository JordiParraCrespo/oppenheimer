/**
 * A recording as the WAV the API takes (`VOICE_SAMPLE_RATE`, 16-bit PCM,
 * mono): the microphone's float samples, averaged down to the target rate
 * and clipped to 16 bits, behind a 44-byte RIFF header.
 */
export function encodeWav(
  chunks: readonly Float32Array[],
  inputRate: number,
  outputRate: number,
): Blob {
  const samples = downsample(chunks, inputRate, outputRate);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * The chunks as one run at `outputRate`: above it, each output sample the
 * mean of the input it covers; below it (a headset in call mode records at
 * 8 kHz), each one interpolated between its two neighbours, so the header's
 * rate is always the samples' rate.
 */
function downsample(
  chunks: readonly Float32Array[],
  inputRate: number,
  outputRate: number,
): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const input = new Float32Array(total);
  let at = 0;
  for (const chunk of chunks) {
    input.set(chunk, at);
    at += chunk.length;
  }
  if (inputRate === outputRate) return input;
  if (inputRate < outputRate) return upsample(input, inputRate / outputRate);
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < output.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(total, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    output[i] = to > from ? sum / (to - from) : 0;
  }
  return output;
}

/** `input` at `1 / step` times its rate, each sample between its two neighbours. */
function upsample(input: Float32Array, step: number): Float32Array {
  const output = new Float32Array(Math.floor(input.length / step));
  for (let i = 0; i < output.length; i++) {
    const at = i * step;
    const before = Math.floor(at);
    const after = Math.min(input.length - 1, before + 1);
    output[i] = input[before] + (input[after] - input[before]) * (at - before);
  }
  return output;
}

/** A chunk's loudness for the waveform, 0–1: its RMS, lifted so speech fills the bar. */
export function levelOf(chunk: Float32Array): number {
  if (chunk.length === 0) return 0;
  let sum = 0;
  for (const sample of chunk) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / chunk.length) * 4);
}
