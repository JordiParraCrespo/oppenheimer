import { AppError } from '@oppenheimer/backend-core';
import type { SynthesisProvider } from '@oppenheimer/shared';
import type { Synthesizer } from '../application/synthesis-provider.port';
import { SynthesisProviderRegistry } from '../application/synthesis-provider.registry';
import { VoiceSynthesisResolver } from '../application/voice-synthesis.resolver';
import { VoiceErrors } from '../domain/voice.errors';

/**
 * Who speaks a workspace's voice note, over fake providers: the one it chose
 * first, with the model and voice it chose, the others after it in their
 * defaults; the fallback rule dictation's walk keeps (a rate limit answered at
 * once, the first failure when all failed, `VOICE_008` when none is there).
 */

const ORG = 'org-placeholder';
const NOW = new Date('2026-11-21T10:00:00Z');
const AUTOMATIC = { provider: null, model: null, voice: null };

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
      return Buffer.from(`spoken by ${id}`);
    }),
  } satisfies Synthesizer<string>;
}

const over = (...voices: Synthesizer[]) =>
  new VoiceSynthesisResolver(new SynthesisProviderRegistry(voices));

describe('VoiceSynthesisResolver', () => {
  it('speaks on the first voice available, in its default model and voice, when none was chosen', async () => {
    const openai = voice('openai', { available: false });
    const elevenlabs = voice('elevenlabs');

    await expect(over(openai, elevenlabs).speak(ORG, 'Hola', NOW, AUTOMATIC)).resolves.toEqual({
      audio: Buffer.from('spoken by elevenlabs'),
      provider: 'elevenlabs',
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
});
