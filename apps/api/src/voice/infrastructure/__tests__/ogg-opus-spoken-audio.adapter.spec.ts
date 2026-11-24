import { oggOpus } from '../../__tests__/ogg-opus.spec-support';
import { spokenSilence, spokenSpeech } from '../../__tests__/spoken-audio.spec-support';
import { oggOpusSeconds, SPEECH_SILENCE_PEAK } from '../../domain/voice-synthesis.policy';
import { OggOpusSpokenAudioAdapter } from '../ogg-opus-spoken-audio.adapter';

/**
 * Spoken audio decoded for real, in the WebAssembly decoder, over synthetic
 * Ogg/Opus (`spoken-audio.spec-support.ts`): speech and silence of the same
 * length, which only the decoded samples tell apart.
 * `voice-synthesis.resolver.spec.ts` is what the walk does with the answer.
 */

describe('OggOpusSpokenAudioAdapter', () => {
  const adapter = new OggOpusSpokenAudioAdapter();

  it('hears speech above the silence line and silence below it, at the same length', async () => {
    expect(oggOpusSeconds(spokenSpeech())).toBe(oggOpusSeconds(spokenSilence()));
    expect(await adapter.peak(spokenSpeech())).toBeGreaterThan(0.1);
    expect(await adapter.peak(spokenSilence())).toBeLessThan(SPEECH_SILENCE_PEAK);
  });

  it('answers null for Ogg/Opus whose packets do not decode', async () => {
    expect(await adapter.peak(oggOpus(312 + 48_000 * 2))).toBeNull();
  });
});
