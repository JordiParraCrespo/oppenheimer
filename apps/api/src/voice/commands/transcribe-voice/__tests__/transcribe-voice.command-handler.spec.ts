import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@oppenheimer/shared';
import type { PolishModelResolver, PolishTarget } from '../../../application/polish-model.resolver';
import type { VoicePolishResolver } from '../../../application/voice-polish.resolver';
import type { VoiceTranscriptionResolver } from '../../../application/voice-transcription.resolver';
import type { VoiceSettingsRepositoryPort } from '../../../database/voice-settings.repository.port';
import { TranscribeVoiceCommand } from '../transcribe-voice.command';
import { TranscribeVoiceCommandHandler } from '../transcribe-voice.command-handler';

/**
 * One dictation end to end over doubles of its resolvers and the workspace's
 * settings: the bytes are judged before anyone hears them, the walk gets the
 * provider and model the workspace chose, the polish gets the vocabulary as
 * terms and the model its settings pick (none at all when off), and the
 * answer says whether the text is the polish or the words as heard.
 */

/** The smallest 16-bit mono PCM WAV with one sample in it. */
function wav(): Buffer {
  const out = Buffer.alloc(46);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(38, 4);
  out.write('WAVEfmt ', 8, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16_000, 24);
  out.writeUInt32LE(32_000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(2, 40);
  return out;
}

const CHATGPT = {
  provider: 'chatgpt',
  credential: { apiKey: 'access-placeholder', accountId: 'acct-1' },
};

function setup(
  polished: string | null,
  {
    settings = DEFAULT_VOICE_SETTINGS,
    target = { polish: true, model: CHATGPT } as PolishTarget,
  }: { settings?: VoiceSettings; target?: PolishTarget } = {},
) {
  const transcription: Pick<VoiceTranscriptionResolver, 'hear'> = {
    hear: vi
      .fn()
      .mockResolvedValue({ raw: 'um fix the login', provider: 'chatgpt', polishOn: CHATGPT }),
  };
  const polish: Pick<VoicePolishResolver, 'polish'> = {
    polish: vi.fn().mockResolvedValue(polished),
  };
  const polishModels: Pick<PolishModelResolver, 'targetFor'> = {
    targetFor: vi.fn().mockResolvedValue(target),
  };
  const repository: VoiceSettingsRepositoryPort = { find: async () => settings, put: vi.fn() };
  const handler = new TranscribeVoiceCommandHandler(
    transcription as VoiceTranscriptionResolver,
    polish as VoicePolishResolver,
    polishModels as PolishModelResolver,
    repository,
  );
  return { handler, transcription, polish, polishModels };
}

function command(overrides: Partial<ConstructorParameters<typeof TranscribeVoiceCommand>[0]> = {}) {
  return new TranscribeVoiceCommand({
    organizationId: 'org-placeholder',
    audio: wav(),
    vocabulary: 'oppenheimer\n apps/web \noppenheimer',
    language: 'en',
    ...overrides,
  });
}

describe('TranscribeVoiceCommandHandler', () => {
  it('hears the clip with the vocabulary as names to expect, and polishes with it and the sign-in it was heard on', async () => {
    const { handler, transcription, polish } = setup('Fix the login.');

    await expect(handler.execute(command())).resolves.toEqual({
      text: 'Fix the login.',
      raw: 'um fix the login',
      provider: 'chatgpt',
      polished: true,
    });
    expect(transcription.hear).toHaveBeenCalledWith(
      'org-placeholder',
      {
        data: expect.any(Buffer),
        language: 'en',
        prompt: 'oppenheimer, apps/web, Claude Code, Codex, ChatGPT, GitHub, tmux',
      },
      expect.any(Date),
      { provider: null, model: null },
    );
    expect(polish.polish).toHaveBeenCalledWith(
      'um fix the login',
      ['oppenheimer', 'apps/web'],
      CHATGPT,
    );
  });

  it('hears on the provider and model the workspace chose, and tidies on the model its settings pick', async () => {
    const settings = {
      ...DEFAULT_VOICE_SETTINGS,
      transcriptionProvider: 'groq' as const,
      transcriptionModel: 'whisper-large-v3',
      polishProvider: 'anthropic' as const,
    };
    const claude = { provider: 'anthropic' as const, credential: { apiKey: 'key-placeholder' } };
    const { handler, transcription, polish, polishModels } = setup('Fix the login.', {
      settings,
      target: { polish: true, model: claude },
    });

    await handler.execute(command());
    expect(transcription.hear).toHaveBeenCalledWith(
      'org-placeholder',
      expect.anything(),
      expect.any(Date),
      { provider: 'groq', model: 'whisper-large-v3' },
    );
    expect(polishModels.targetFor).toHaveBeenCalledWith(
      'org-placeholder',
      settings,
      CHATGPT,
      expect.any(Date),
    );
    expect(polish.polish).toHaveBeenCalledWith('um fix the login', expect.any(Array), claude);
  });

  // What breaks this: a workspace that turned the polish off still gets its words rewritten.
  it('answers the words as heard, polishing nothing, when the workspace turned the polish off', async () => {
    const { handler, polish } = setup('Fix the login.', { target: { polish: false } });
    await expect(handler.execute(command())).resolves.toMatchObject({
      text: 'um fix the login',
      polished: false,
    });
    expect(polish.polish).not.toHaveBeenCalled();
  });

  it('answers the words as heard when no polish came back', async () => {
    const { handler } = setup(null);
    await expect(handler.execute(command())).resolves.toMatchObject({
      text: 'um fix the login',
      polished: false,
    });
  });

  it('refuses what is not a WAV, and a request with no audio or no workspace, before anyone hears it', async () => {
    const { handler, transcription } = setup(null);

    await expect(
      handler.execute(
        command({ audio: Buffer.from('OggS not a wav at all, long enough to judge') }),
      ),
    ).rejects.toMatchObject({ code: 'VOICE_004' });
    await expect(handler.execute(command({ audio: undefined }))).rejects.toMatchObject({
      code: 'VOICE_002',
    });
    await expect(handler.execute(command({ organizationId: null }))).rejects.toMatchObject({
      code: 'TENANT_001',
    });
    expect(transcription.hear).not.toHaveBeenCalled();
  });
});
