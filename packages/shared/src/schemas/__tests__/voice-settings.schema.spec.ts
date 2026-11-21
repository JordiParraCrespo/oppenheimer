import { describe, expect, it } from 'vitest';
import { DEFAULT_VOICE_SETTINGS, voiceSettingsSchema } from '../voice.schema.js';

/**
 * The voice choices the API stores and the console sends. What breaks if this
 * regresses: a model one provider lists saved for another (every call then a
 * 400 from the vendor), or a voice id with a slash reaching an ElevenLabs URL.
 */
const valid = (patch: Partial<typeof DEFAULT_VOICE_SETTINGS>) =>
  voiceSettingsSchema.safeParse({ ...DEFAULT_VOICE_SETTINGS, ...patch }).success;

describe('voiceSettingsSchema', () => {
  it('takes everything automatic, and a provider with a model and voice its catalog lists', () => {
    expect(valid({})).toBe(true);
    expect(
      valid({
        transcriptionProvider: 'groq',
        transcriptionModel: 'whisper-large-v3',
        synthesisProvider: 'openai',
        synthesisModel: 'tts-1-hd',
        synthesisVoice: 'nova',
        polishProvider: 'xai',
        polishModel: 'grok-4.6',
      }),
    ).toBe(true);
  });

  it('refuses a model or voice its provider does not list, or with no provider chosen', () => {
    expect(valid({ transcriptionProvider: 'groq', transcriptionModel: 'whisper-1' })).toBe(false);
    expect(valid({ transcriptionModel: 'whisper-1' })).toBe(false);
    expect(valid({ synthesisProvider: 'openai', synthesisVoice: 'Rachel' })).toBe(false);
    expect(valid({ polishProvider: 'off', polishModel: 'grok-4.6' })).toBe(false);
  });

  it("takes any ElevenLabs voice id from the account's library, but only as a path-safe id", () => {
    expect(valid({ synthesisProvider: 'elevenlabs', synthesisVoice: 'my-cloned_Voice1' })).toBe(
      true,
    );
    expect(valid({ synthesisProvider: 'elevenlabs', synthesisVoice: '../voices' })).toBe(false);
  });
});
