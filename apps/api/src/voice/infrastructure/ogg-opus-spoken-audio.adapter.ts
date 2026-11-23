import { Injectable } from '@nestjs/common';
import type { SpokenAudioPort } from './spoken-audio.port';

/**
 * `ogg-opus-decoder` is ESM-only and the API compiles to CommonJS, whose
 * module resolution cannot read its types: it is loaded by name, which Node
 * resolves from CommonJS and Vitest from ESM, and typed by the part this
 * adapter calls.
 */
const OGG_OPUS_DECODER = 'ogg-opus-decoder';

interface OggOpusModule {
  OggOpusDecoder: new () => {
    ready: Promise<void>;
    decodeFile(data: Uint8Array): Promise<{ channelData: Float32Array[] }>;
    free(): void;
  };
}

/**
 * Spoken audio decoded in process, in WebAssembly, held in memory for the
 * call and never written to disk. Every channel is read. Audio the decoder
 * cannot read (a cut-off file throws `RangeError`, damaged pages decode to
 * no samples) is null; anything else it throws is left to fail the call.
 */
@Injectable()
export class OggOpusSpokenAudioAdapter implements SpokenAudioPort {
  async peak(audio: Buffer): Promise<number | null> {
    const { OggOpusDecoder } = (await import(OGG_OPUS_DECODER)) as OggOpusModule;
    const decoder = new OggOpusDecoder();
    try {
      await decoder.ready;
      const decoded = await decoder.decodeFile(new Uint8Array(audio)).catch((error: unknown) => {
        if (error instanceof RangeError) return null;
        throw error;
      });
      if (!decoded || !decoded.channelData[0]?.length) return null;
      let peak = 0;
      for (const channel of decoded.channelData) {
        for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
      }
      return peak;
    } finally {
      decoder.free();
    }
  }
}
