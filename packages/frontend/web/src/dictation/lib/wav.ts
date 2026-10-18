/**
 * A recording as the WAV the API takes (`VOICE_SAMPLE_RATE`, 16-bit PCM,
 * mono): the microphone's float samples, resampled to the target rate
 * ({@link resample}), the silence before the first word and after the last cut off
 * ({@link trimSilence}), and clipped to 16 bits, behind a 44-byte RIFF
 * header.
 */
export function encodeWav(
  chunks: readonly Float32Array[],
  inputRate: number,
  outputRate: number,
): Blob {
  const samples = trimSilence(resample(joinChunks(chunks), inputRate, outputRate), outputRate);
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

function joinChunks(chunks: readonly Float32Array[]): Float32Array {
  const joined = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  return joined;
}

/**
 * Where the low-pass filter cuts, as a share of the lower rate: 0.45, so at
 * 16 kHz it passes speech to about 7 kHz and stops before the 8 kHz the
 * output can hold.
 */
const CUTOFF = 0.45;

/**
 * The filter's half-width in zero crossings of its sinc: 12 passes 6 kHz
 * whole and has 9 kHz 80 dB down, so a sibilant's hiss is gone before it
 * can fold back into the speech band. Wider costs time on every clip.
 */
const ZERO_CROSSINGS = 12;

/**
 * A polyphase low-pass from `inputRate` to `outputRate`: a Blackman-windowed
 * sinc at {@link CUTOFF} of the lower rate. The rates are whole numbers, so
 * an output sample falls at one of `phases` offsets between input samples
 * (one at 48 kHz, 160 at 44.1 kHz), and `bank` holds the `taps` weights for
 * each, row by row. Output sample `i` sits `i * stride / phases` input
 * samples in, and its window starts `reach - 1` before that.
 */
interface FilterBank {
  bank: Float32Array;
  taps: number;
  reach: number;
  phases: number;
  stride: number;
}

function designFilter(inputRate: number, outputRate: number): FilterBank {
  // The cutoff in cycles per input sample, doubled: the sinc's zero crossings fall 1/band apart.
  const band = (2 * CUTOFF * Math.min(inputRate, outputRate)) / inputRate;
  const reach = Math.ceil(ZERO_CROSSINGS / band);
  const taps = 2 * reach;
  const common = gcd(inputRate, outputRate);
  const phases = outputRate / common;
  const bank = new Float32Array(phases * taps);
  for (let phase = 0; phase < phases; phase++) {
    for (let k = 0; k < taps; k++) {
      const x = (k - reach + 1 - phase / phases) * band;
      bank[phase * taps + k] = band * sinc(x) * blackman(Math.abs(x) / ZERO_CROSSINGS);
    }
  }
  return { bank, taps, reach, phases, stride: inputRate / common };
}

function sinc(x: number): number {
  return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}

/** The Blackman window at `away` of its half-width from the centre: 1 there, 0 at the edge and beyond. */
function blackman(away: number): number {
  if (away >= 1) return 0;
  const w = Math.PI * (away + 1);
  return 0.42 - 0.5 * Math.cos(w) + 0.08 * Math.cos(2 * w);
}

/**
 * `input` at `outputRate`, through {@link designFilter}'s low-pass.
 * Averaging each output sample's share of the input, as this did before,
 * let 10 kHz through at -6 dB on the way from 48 kHz to 16 kHz, so the hiss
 * of an "s" or an "f" folded back over the 2–8 kHz that tells them apart.
 * Going up (a headset in call mode records at 8 kHz), the same filter
 * interpolates, so the header's rate is always the samples' rate.
 */
export function resample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const { bank, taps, reach, phases, stride } = designFilter(inputRate, outputRate);
  const output = new Float32Array(Math.floor((input.length * phases) / stride));
  for (let i = 0; i < output.length; i++) {
    const at = Math.floor((i * stride) / phases);
    const row = (i * stride - at * phases) * taps;
    const first = at - reach + 1;
    const to = Math.min(taps, input.length - first);
    let sum = 0;
    for (let k = Math.max(0, -first); k < to; k++) sum += input[first + k] * bank[row + k];
    output[i] = sum;
  }
  return output;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
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
 * Speech is louder than the room by at least this much: four times the
 * quietest tenth of the clip's frames (12 dB), whatever the microphone's
 * gain.
 */
const SPEECH_OVER_ROOM = 4;

/**
 * Speech may sit this far under the clip's loud frames and still count: a
 * tenth (20 dB). "Loud" is the 90th percentile, not the loudest frame, so a
 * cough or a bump on the mic is not the measure.
 */
const SPEECH_UNDER_LOUD = 0.1;

/**
 * The samples from just before the first frame that sounds like speech to
 * just after the last one, {@link PAD_SECONDS} either side. A frame is
 * speech when it clears {@link SPEECH_OVER_ROOM} or {@link SPEECH_UNDER_LOUD},
 * whichever is lower, so a doubt keeps audio: one loud transient cannot lift
 * the bar over the voice, and a clip that is all speech has no quiet tenth
 * to lift it either. The pause while
 * the person reaches for the mic and the one before they press stop are
 * what speech models fill with "Thanks for watching!", and they are upload
 * and wait for nothing. A clip with no frame above {@link SILENCE_FLOOR} is
 * sent whole: what to make of it is the API's call, not a guess here.
 */
export function trimSilence(samples: Float32Array, rate: number): Float32Array {
  const frame = Math.max(1, Math.round(rate * FRAME_SECONDS));
  const frames = Math.ceil(samples.length / frame);
  const levelAt = (f: number) => rms(samples.subarray(f * frame, (f + 1) * frame));

  const levels = Array.from({ length: frames }, (_, f) => levelAt(f)).sort((a, b) => a - b);
  const room = levels[Math.floor(frames * 0.1)] ?? 0;
  const loud = levels[Math.floor(frames * 0.9)] ?? 0;
  const threshold = Math.max(
    SILENCE_FLOOR,
    Math.min(room * SPEECH_OVER_ROOM, loud * SPEECH_UNDER_LOUD),
  );
  if ((levels[frames - 1] ?? 0) < threshold) return samples;

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
