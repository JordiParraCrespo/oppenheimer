import { Injectable } from '@nestjs/common';
import type { VoiceNoteDecoderPort } from './voice-note-decoder.port';

/**
 * `ogg-opus-decoder` is ESM-only and the API compiles to CommonJS, whose
 * module resolution cannot read its types: it is loaded by name, which Node 22
 * resolves from CommonJS and Vitest from ESM, and typed by the part this
 * adapter calls.
 */
const OGG_OPUS_DECODER = 'ogg-opus-decoder';

/** The part of `ogg-opus-decoder` this adapter calls. */
interface OggOpusModule {
  OggOpusDecoder: new () => {
    ready: Promise<void>;
    decodeFile(data: Uint8Array): Promise<{ channelData: Float32Array[]; sampleRate: number }>;
    free(): void;
  };
}

/** What speech models are trained on; a third of Opus's 48 kHz, so a third of the bytes. */
const SAMPLE_RATE = 16_000;

/**
 * Voice notes decoded in process, in WebAssembly: no `ffmpeg` on the API's
 * machine, nothing written to disk. Opus always decodes at 48 kHz; the first
 * channel is kept (a voice note is mono) and averaged down to 16 kHz. A note
 * that is not whole Ogg/Opus is null; anything else the decoder throws is
 * left to fail the turn.
 */
@Injectable()
export class OggOpusVoiceNoteDecoderAdapter implements VoiceNoteDecoderPort {
  async toWav(note: Buffer): Promise<Buffer | null> {
    if (note.length < 4 || note.toString('ascii', 0, 4) !== 'OggS') return null;
    const { OggOpusDecoder } = (await import(OGG_OPUS_DECODER)) as OggOpusModule;
    const decoder = new OggOpusDecoder();
    try {
      await decoder.ready;
      const decoded = await decoder.decodeFile(new Uint8Array(note)).catch((error: unknown) => {
        // Its Ogg parser reads past the end of a cut-off file; any other throw is a bug.
        if (error instanceof RangeError) return null;
        throw error;
      });
      // Damaged pages decode to no samples rather than throwing.
      const samples = decoded?.channelData[0];
      if (!decoded || !samples?.length) return null;
      return wav(resample(samples, decoded.sampleRate, SAMPLE_RATE), SAMPLE_RATE);
    } finally {
      decoder.free();
    }
  }
}

/** `samples` at `to` Hz, each output sample the mean of the input samples it spans. */
function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j] ?? 0;
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Mono 16-bit PCM WAV of `samples` in [-1, 1]. */
function wav(samples: Float32Array, rate: number): Buffer {
  const data = samples.length * 2;
  const out = Buffer.alloc(44 + data);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + data, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28); // bytes a second
  out.writeUInt16LE(2, 32); // bytes a frame
  out.writeUInt16LE(16, 34); // bits a sample
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(data, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return out;
}
