import { AppError } from '@oppenheimer/backend-core';
import type { VoiceProvider } from '@oppenheimer/shared';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { BotErrors } from '../../bots/domain/bots.errors';
import { ChatgptSpeechResolver } from '../application/chatgpt-speech.resolver';
import type { SpeechGrant, SpeechProvider } from '../application/speech-provider.port';
import { SpeechProviderRegistry } from '../application/speech-provider.registry';
import { VoiceTranscriptionResolver } from '../application/voice-transcription.resolver';
import { VoiceErrors } from '../domain/voice.errors';
import type { ChatgptSpeechPort } from '../infrastructure/speech-to-text.port';

/**
 * Who hears a workspace's clip, over the registry's list: the first provider
 * available for the workspace, the next when it fails, never the next on a
 * rate limit, and `VOICE_005` when none is available. Then the ChatGPT
 * provider itself: it is available when the workspace is signed in, and its
 * grant is the sign-in the polish runs on. Each provider's HTTP is its
 * gateway's spec.
 */

const ORG = 'org-placeholder';
const CLIP = { data: Buffer.from('wav') };
const NOW = new Date('2026-10-17T10:00:00Z');

function provider(
  id: VoiceProvider,
  { available = true, heard = `heard by ${id}` }: { available?: boolean; heard?: string } = {},
) {
  const grant: SpeechGrant<string> = { access: `${id}-access`, polishOn: null };
  return {
    id,
    availableFor: vi.fn().mockResolvedValue(available),
    grantFor: vi.fn().mockResolvedValue(grant),
    transcribe: vi.fn().mockResolvedValue(heard),
  } satisfies SpeechProvider<string>;
}

function resolverOver(...providers: SpeechProvider[]) {
  return new VoiceTranscriptionResolver(new SpeechProviderRegistry(providers));
}

describe('VoiceTranscriptionResolver', () => {
  it('hears the clip on the first provider available for the workspace, and touches no other', async () => {
    const off = provider('chatgpt', { available: false });
    const on = provider('speech_key');

    await expect(resolverOver(off, on).hear(ORG, CLIP, NOW)).resolves.toEqual({
      raw: 'heard by speech_key',
      provider: 'speech_key',
      polishOn: null,
    });
    expect(on.transcribe).toHaveBeenCalledWith(CLIP, {
      access: 'speech_key-access',
      polishOn: null,
    });
    expect(off.grantFor).not.toHaveBeenCalled();
  });

  it('answers VOICE_005 when no provider is available', async () => {
    const off = provider('chatgpt', { available: false });
    await expect(resolverOver(off).hear(ORG, CLIP, NOW)).rejects.toMatchObject({
      code: 'VOICE_005',
    });
  });

  it('tries the next provider when one refuses or its grant has lapsed', async () => {
    const refused = provider('chatgpt');
    refused.transcribe.mockRejectedValue(new AppError(VoiceErrors.PROVIDER_UNAVAILABLE));
    const next = provider('speech_key');
    await expect(resolverOver(refused, next).hear(ORG, CLIP, NOW)).resolves.toMatchObject({
      provider: 'speech_key',
    });

    const lapsed = provider('chatgpt');
    lapsed.grantFor.mockRejectedValue(new AppError(BotErrors.PROVIDER_KEY_MISSING));
    await expect(
      resolverOver(lapsed, provider('speech_key')).hear(ORG, CLIP, NOW),
    ).resolves.toMatchObject({ provider: 'speech_key' });
  });

  it('tries the next provider when asking whether one is available fails', async () => {
    const broken = provider('chatgpt');
    broken.availableFor.mockRejectedValue(new Error('connection terminated'));
    const next = provider('speech_key');

    await expect(resolverOver(broken, next).hear(ORG, CLIP, NOW)).resolves.toMatchObject({
      provider: 'speech_key',
    });
    expect(broken.grantFor).not.toHaveBeenCalled();
  });

  it("answers a rate limit at once, without spending the next provider's budget", async () => {
    const limited = provider('chatgpt');
    limited.transcribe.mockRejectedValue(new AppError(VoiceErrors.RATE_LIMITED));
    const next = provider('speech_key');

    await expect(resolverOver(limited, next).hear(ORG, CLIP, NOW)).rejects.toMatchObject({
      code: 'VOICE_007',
    });
    expect(next.grantFor).not.toHaveBeenCalled();
  });

  it('answers the first failure when every available provider failed', async () => {
    const first = provider('chatgpt');
    first.grantFor.mockRejectedValue(new AppError(BotErrors.PROVIDER_KEY_MISSING));
    const second = provider('speech_key');
    second.transcribe.mockRejectedValue(new AppError(VoiceErrors.PROVIDER_UNAVAILABLE));

    await expect(resolverOver(first, second).hear(ORG, CLIP, NOW)).rejects.toMatchObject({
      code: BotErrors.PROVIDER_KEY_MISSING.code,
    });
  });

  it('refuses a list in which two providers share an id', () => {
    expect(() => new SpeechProviderRegistry([provider('chatgpt'), provider('chatgpt')])).toThrow();
  });
});

describe('ChatgptSpeechResolver', () => {
  function chatgptProvider(signedIn: boolean) {
    const credentials: TurnCredentialsPort = {
      has: vi.fn().mockResolvedValue(signedIn),
      forTurn: vi.fn().mockResolvedValue({ apiKey: 'access-placeholder', accountId: 'acct-1' }),
    };
    const gateway: ChatgptSpeechPort = { transcribe: vi.fn().mockResolvedValue('heard') };
    return {
      speech: new ChatgptSpeechResolver(credentials, gateway),
      credentials,
      gateway,
    };
  }

  it('is available exactly when the workspace is signed in to ChatGPT', async () => {
    await expect(chatgptProvider(true).speech.availableFor(ORG)).resolves.toBe(true);
    await expect(chatgptProvider(false).speech.availableFor(ORG)).resolves.toBe(false);
  });

  it('hears on the refreshed sign-in, and offers the same sign-in to the polish', async () => {
    const { speech, credentials, gateway } = chatgptProvider(true);

    const grant = await speech.grantFor(ORG, NOW);
    await speech.transcribe(CLIP, grant);

    expect(credentials.forTurn).toHaveBeenCalledWith(ORG, 'chatgpt', NOW);
    expect(grant.polishOn).toEqual({
      provider: 'chatgpt',
      credential: { apiKey: 'access-placeholder', accountId: 'acct-1' },
    });
    expect(gateway.transcribe).toHaveBeenCalledWith(CLIP, {
      accessToken: 'access-placeholder',
      accountId: 'acct-1',
    });
  });
});
