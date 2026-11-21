import { DEFAULT_VOICE_SETTINGS } from '@oppenheimer/shared/schemas/voice';
import { describe, expect, it } from 'vitest';
import {
  polishModels,
  providerChoices,
  shownModel,
  transcriptionModels,
  withSynthesisProvider,
} from '../lib/voice-settings';

/**
 * What the Voice rows offer. What breaks this: a provider chosen and then
 * disconnected vanishing from its select (it would read as automatic while
 * it is still saved), or a voice id from one provider kept after switching
 * to another, which the API refuses.
 */
describe('Voice settings options', () => {
  it('offers the providers available now, and keeps a chosen one whose key is gone', () => {
    expect(providerChoices(['chatgpt', 'openai'], 'openai')).toEqual([
      { value: 'chatgpt', available: true },
      { value: 'openai', available: true },
    ]);
    expect(providerChoices(['chatgpt'], 'groq')).toEqual([
      { value: 'chatgpt', available: true },
      { value: 'groq', available: false },
    ]);
  });

  it('drops the model and voice when the voice-note provider changes', () => {
    const before = {
      ...DEFAULT_VOICE_SETTINGS,
      synthesisProvider: 'openai' as const,
      synthesisModel: 'tts-1',
      synthesisVoice: 'nova',
    };
    expect(withSynthesisProvider(before, 'elevenlabs')).toMatchObject({
      synthesisProvider: 'elevenlabs',
      synthesisModel: null,
      synthesisVoice: null,
    });
  });

  it("shows the provider's default model until one is chosen, and none where there is no choice", () => {
    expect(shownModel(transcriptionModels('groq'), null)).toBe('whisper-large-v3-turbo');
    expect(transcriptionModels('chatgpt')).toEqual([]);
    expect(polishModels('off')).toEqual([]);
    expect(polishModels('xai').map((row) => row.id)).toContain('grok-4.6');
  });
});
