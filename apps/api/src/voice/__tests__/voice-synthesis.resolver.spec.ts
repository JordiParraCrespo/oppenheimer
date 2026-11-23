import { AppError } from '@oppenheimer/backend-core';
import type { SynthesisProvider } from '@oppenheimer/shared';
import type { Synthesizer } from '../application/synthesis-provider.port';
import { SynthesisProviderRegistry } from '../application/synthesis-provider.registry';
import { VoiceSynthesisResolver } from '../application/voice-synthesis.resolver';
import { VoiceErrors } from '../domain/voice.errors';
import type { SpokenAudioPort } from '../infrastructure/spoken-audio.port';
import { oggOpus } from './ogg-opus.spec-support';

/**
 * Who speaks a workspace's voice note, over fake providers: the one it chose
 * first, with the model and voice it chose, the others after it in their
 * defaults; the fallback rule dictation's walk keeps (a rate limit answered at
 * once, the first failure when all failed, `VOICE_008` when none is there).
 */

const ORG = 'org-placeholder';
const NOW = new Date('2026-11-21T10:00:00Z');
const AUTOMATIC = { provider: null, model: null, voice: null };

/** Ogg/Opus of a length of its own per provider, so the answer says who spoke. */
const tags = new Map<string, Buffer>();
function spoken(id: string): Buffer {
  if (!tags.has(id)) tags.set(id, oggOpus(312 + 48_000 * (tags.size + 2)));
  return tags.get(id) as Buffer;
}

function voice(
  id: SynthesisProvider,
  { available = true, fails }: { available?: boolean; fails?: Error } = {},
) {
  return {
    id,
    availableFor: vi.fn().mockResolvedValue(available),
    grantFor: vi.fn().mockResolvedValue(`${id}-access`),
    synthesize: vi.fn(async () => {
      if (fails) throw fails;
      return spoken(id);
    }),
  } satisfies Synthesizer<string>;
}

/** Every answer decodes to speech, except the audio listed as silent. */
const silent = new Set<Buffer>();
const spokenAudio: SpokenAudioPort = {
  peak: async (audio) => (silent.has(audio) ? 0 : 0.5),
};

const over = (...voices: Synthesizer[]) =>
  new VoiceSynthesisResolver(new SynthesisProviderRegistry(voices), spokenAudio);

describe('VoiceSynthesisResolver', () => {
  it('speaks on the first voice available, in its default model and voice, when none was chosen', async () => {
    const openai = voice('openai', { available: false });
    const elevenlabs = voice('elevenlabs');

    await expect(over(openai, elevenlabs).speak(ORG, 'Hola', NOW, AUTOMATIC)).resolves.toEqual({
      audio: spoken('elevenlabs'),
      provider: 'elevenlabs',
      seconds: expect.any(Number),
    });
    expect(elevenlabs.synthesize).toHaveBeenCalledWith('Hola', 'elevenlabs-access', {
      model: 'eleven_multilingual_v2',
      voice: '21m00Tcm4TlvDq8ikWAM',
    });
    expect(openai.grantFor).not.toHaveBeenCalled();
  });

  it('tries the chosen voice first with its model and voice, and the next one in its defaults when it fails', async () => {
    const openai = voice('openai');
    const elevenlabs = voice('elevenlabs', {
      fails: new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE),
    });

    await expect(
      over(openai, elevenlabs).speak(ORG, 'Hola', NOW, {
        provider: 'elevenlabs',
        model: 'eleven_flash_v2_5',
        voice: 'my-voice',
      }),
    ).resolves.toMatchObject({ provider: 'openai' });
    expect(elevenlabs.synthesize).toHaveBeenCalledWith('Hola', 'elevenlabs-access', {
      model: 'eleven_flash_v2_5',
      voice: 'my-voice',
    });
    // A voice id means nothing to another provider: OpenAI speaks in its own default.
    expect(openai.synthesize).toHaveBeenCalledWith('Hola', 'openai-access', {
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
    });
  });

  it('answers a rate limit at once, without spending the next voice', async () => {
    const limited = voice('openai', { fails: new AppError(VoiceErrors.SYNTHESIS_RATE_LIMITED) });
    const next = voice('speech_key');
    await expect(over(limited, next).speak(ORG, 'Hola', NOW, AUTOMATIC)).rejects.toMatchObject({
      code: 'VOICE_010',
    });
    expect(next.synthesize).not.toHaveBeenCalled();
  });

  it('answers the first failure when every voice failed, and VOICE_008 when none is available', async () => {
    const first = new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, { detail: 'first' });
    await expect(
      over(
        voice('openai', { fails: first }),
        voice('speech_key', { fails: new Error('second') }),
      ).speak(ORG, 'Hola', NOW, AUTOMATIC),
    ).rejects.toBe(first);
    await expect(
      over(voice('openai', { available: false })).speak(ORG, 'Hola', NOW, AUTOMATIC),
    ).rejects.toMatchObject({ code: 'VOICE_008' });
  });

  it('refuses two voices with one id', () => {
    expect(() => new SynthesisProviderRegistry([voice('openai'), voice('openai')])).toThrow();
  });

  // What breaks this: a provider answering MP3 or a page with a 200 ends the walk, and no voice note goes out.
  it('tries the next voice when one answers something that is not Ogg/Opus', async () => {
    const mp3 = voice('openai');
    mp3.synthesize.mockResolvedValue(Buffer.from('ID3 not a voice note'));
    const next = voice('speech_key');

    await expect(over(mp3, next).speak(ORG, 'Hola', NOW, AUTOMATIC)).resolves.toMatchObject({
      provider: 'speech_key',
    });
  });

  // What breaks this: a provider answering silent Ogg/Opus of the right length
  // goes out as a voice note that shows its seconds and plays nothing.
  it('tries the next voice when one answers audio that plays no sound, and refuses it when none speaks', async () => {
    const mute = voice('openai');
    const nothing = oggOpus(312 + 48_000 * 9);
    silent.add(nothing);
    mute.synthesize.mockResolvedValue(nothing);
    const next = voice('speech_key');

    await expect(over(mute, next).speak(ORG, 'Hola', NOW, AUTOMATIC)).resolves.toMatchObject({
      provider: 'speech_key',
    });
    await expect(over(mute).speak(ORG, 'Hola', NOW, AUTOMATIC)).rejects.toMatchObject({
      code: 'VOICE_009',
    });
  });

  it("hands OpenAI's older model a voice it speaks, not the chosen one it does not", async () => {
    const openai = voice('openai');
    await over(openai).speak(ORG, 'Hola', NOW, {
      provider: 'openai',
      model: 'tts-1',
      voice: 'verse',
    });
    expect(openai.synthesize).toHaveBeenCalledWith('Hola', 'openai-access', {
      model: 'tts-1',
      voice: 'alloy',
    });
  });
});
