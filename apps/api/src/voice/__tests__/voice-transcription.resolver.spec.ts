import { AppError } from '@oppenheimer/backend-core';
import type { TurnCredentialsPort } from '../../bots/application/turn-credentials.port';
import { BotErrors } from '../../bots/domain/bots.errors';
import { VoiceTranscriptionResolver } from '../application/voice-transcription.resolver';
import { VoiceErrors } from '../domain/voice.errors';
import type { ChatgptSpeechPort, KeyedSpeechPort } from '../infrastructure/speech-to-text.port';

/**
 * Who hears a workspace's clip: its ChatGPT sign-in first, the deployment's
 * own server when it has none or ChatGPT cannot transcribe, and a
 * `VOICE_005` when there is neither. The two providers' HTTP is their
 * gateways' specs; this is only the choice between them.
 */

const ORG = 'org-placeholder';
const CLIP = { data: Buffer.from('wav') };
const NOW = new Date('2026-10-17T10:00:00Z');

function setup({ signedIn, keyed }: { signedIn: boolean; keyed: boolean }) {
  const credentials: TurnCredentialsPort = {
    has: vi.fn().mockResolvedValue(signedIn),
    forTurn: vi.fn().mockResolvedValue({ apiKey: 'access-placeholder', accountId: 'acct-1' }),
  };
  const chatgpt: ChatgptSpeechPort = { transcribe: vi.fn().mockResolvedValue('heard by chatgpt') };
  const key: KeyedSpeechPort = {
    isConfigured: () => keyed,
    transcribe: vi.fn().mockResolvedValue('heard by the key'),
  };
  const resolver = new VoiceTranscriptionResolver(credentials, chatgpt, key);
  return { resolver, credentials, chatgpt, key };
}

describe('VoiceTranscriptionResolver', () => {
  it('hears a signed-in workspace on its own ChatGPT account, and hands the sign-in on for the polish', async () => {
    const { resolver, credentials, chatgpt, key } = setup({ signedIn: true, keyed: true });

    await expect(resolver.hear(ORG, CLIP, NOW)).resolves.toEqual({
      raw: 'heard by chatgpt',
      provider: 'chatgpt',
      chatgpt: { apiKey: 'access-placeholder', accountId: 'acct-1' },
    });
    expect(credentials.forTurn).toHaveBeenCalledWith(ORG, 'chatgpt', NOW);
    expect(chatgpt.transcribe).toHaveBeenCalledWith(CLIP, {
      accessToken: 'access-placeholder',
      accountId: 'acct-1',
    });
    expect(key.transcribe).not.toHaveBeenCalled();
  });

  it("hears a workspace with no sign-in on the deployment's key, without touching ChatGPT", async () => {
    const { resolver, credentials, chatgpt } = setup({ signedIn: false, keyed: true });

    await expect(resolver.hear(ORG, CLIP, NOW)).resolves.toEqual({
      raw: 'heard by the key',
      provider: 'speech_key',
      chatgpt: null,
    });
    expect(credentials.has).toHaveBeenCalledWith(ORG, 'chatgpt');
    expect(credentials.forTurn).not.toHaveBeenCalled();
    expect(chatgpt.transcribe).not.toHaveBeenCalled();
  });

  it('answers VOICE_005 when there is nobody to hear it', async () => {
    const { resolver } = setup({ signedIn: false, keyed: false });
    await expect(resolver.hear(ORG, CLIP, NOW)).rejects.toMatchObject({ code: 'VOICE_005' });
  });

  it("falls back to the key when ChatGPT's route refuses or the sign-in has lapsed", async () => {
    const refused = setup({ signedIn: true, keyed: true });
    vi.mocked(refused.chatgpt.transcribe).mockRejectedValue(
      new AppError(VoiceErrors.PROVIDER_UNAVAILABLE),
    );
    await expect(refused.resolver.hear(ORG, CLIP, NOW)).resolves.toMatchObject({
      provider: 'speech_key',
    });

    const lapsed = setup({ signedIn: true, keyed: true });
    vi.mocked(lapsed.credentials.forTurn).mockRejectedValue(
      new AppError(BotErrors.PROVIDER_KEY_MISSING),
    );
    await expect(lapsed.resolver.hear(ORG, CLIP, NOW)).resolves.toMatchObject({
      provider: 'speech_key',
    });
  });

  it("does not spend the deployment's key on a ChatGPT rate limit, and says why it failed without one", async () => {
    const limited = setup({ signedIn: true, keyed: true });
    vi.mocked(limited.chatgpt.transcribe).mockRejectedValue(new AppError(VoiceErrors.RATE_LIMITED));
    await expect(limited.resolver.hear(ORG, CLIP, NOW)).rejects.toMatchObject({
      code: 'VOICE_007',
    });
    expect(limited.key.transcribe).not.toHaveBeenCalled();

    const noKey = setup({ signedIn: true, keyed: false });
    vi.mocked(noKey.credentials.forTurn).mockRejectedValue(
      new AppError(BotErrors.PROVIDER_KEY_MISSING),
    );
    await expect(noKey.resolver.hear(ORG, CLIP, NOW)).rejects.toMatchObject({
      code: BotErrors.PROVIDER_KEY_MISSING.code,
    });
  });
});
