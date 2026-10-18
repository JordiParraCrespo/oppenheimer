/**
 * A recording as the WAV the API takes (`VOICE_SAMPLE_RATE`, 16-bit PCM,
 * mono): the microphone's float samples, averaged down to the target rate,
 * the silence before the first word and after the last cut off
 * ({@link trimSilence}), and clipped to 16 bits, behind a 44-byte RIFF
 * header.
 */
export function encodeWav(
  chunks: readonly Float32Array[],
  inputRate: number,
  outputRate: number,
): Blob {
  const samples = trimSilence(downsample(chunks, inputRate, outputRate), outputRate);
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

/** The window speech is told from silence in: 20 ms, about one syllable's attack. */
const FRAME_SECONDS = 0.02;

/**
 * How much quiet is kept either side of the speech: 300 ms, longer than a
 * soft first or last consonant ("f", "s") that sits under the threshold.
 */
const PAD_SECONDS = 0.3;

/**
 * Below this RMS a frame is silence, however quiet the rest is: about
 * -50 dBFS, under a laptop fan.
 */
const SILENCE_FLOOR = 0.003;

/**
 * How far under the loudest frame a frame may be and still count as speech:
 * a tenth of its RMS, 20 dB down, which is where a room's hum sits under a
 * speaking voice whatever the microphone's gain.
 */
const SPEECH_RELATIVE_TO_LOUDEST = 0.1;

/**
 * The samples from just before the first frame that sounds like speech to
 * just after the last one, {@link PAD_SECONDS} either side. The pause while
 * the person reaches for the mic and the one before they press stop are
 * what speech models fill with "Thanks for watching!", and they are upload
 * and wait for nothing. A clip with no frame above {@link SILENCE_FLOOR} is
 * sent whole: what to make of it is the API's call, not a guess here.
 */
export function trimSilence(samples: Float32Array, rate: number): Float32Array {
  const frame = Math.max(1, Math.round(rate * FRAME_SECONDS));
  const frames = Math.ceil(samples.length / frame);
  const levelAt = (f: number) => rms(samples.subarray(f * frame, (f + 1) * frame));

  let loudest = 0;
  for (let f = 0; f < frames; f++) loudest = Math.max(loudest, levelAt(f));
  const threshold = Math.max(SILENCE_FLOOR, loudest * SPEECH_RELATIVE_TO_LOUDEST);
  if (loudest < threshold) return samples;

  let first = 0;
  while (levelAt(first) < threshold) first++;
  let last = frames - 1;
  while (levelAt(last) < threshold) last--;

  const pad = Math.round(rate * PAD_SECONDS);
  return samples.subarray(
    Math.max(0, first * frame - pad),
    Math.min(samples.length, (last + 1) * frame + pad),
  );
}

/** A chunk's loudness for the waveform, 0–1: its RMS, lifted so speech fills the bar. */
export function levelOf(chunk: Float32Array): number {
  return Math.min(1, rms(chunk) * 4);
}

function rms(chunk: Float32Array): number {
  if (chunk.length === 0) return 0;
  let sum = 0;
  for (const sample of chunk) sum += sample * sample;
  return Math.sqrt(sum / chunk.length);
}
