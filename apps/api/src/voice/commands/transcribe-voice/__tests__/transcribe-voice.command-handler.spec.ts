import type { VoicePolishResolver } from '../../../application/voice-polish.resolver';
import type { VoiceTranscriptionResolver } from '../../../application/voice-transcription.resolver';
import { TranscribeVoiceCommand } from '../transcribe-voice.command';
import { TranscribeVoiceCommandHandler } from '../transcribe-voice.command-handler';

/**
 * One dictation end to end over doubles of its two resolvers: the bytes are
 * judged before anyone hears them, the polish gets the vocabulary as terms
 * and the sign-in the clip was heard on, and the answer says whether the
 * text is the polish or the words as heard.
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

function setup(polished: string | null) {
  const transcription: Pick<VoiceTranscriptionResolver, 'hear'> = {
    hear: vi
      .fn()
      .mockResolvedValue({ raw: 'um fix the login', provider: 'chatgpt', polishOn: CHATGPT }),
  };
  const polish: Pick<VoicePolishResolver, 'polish'> = {
    polish: vi.fn().mockResolvedValue(polished),
  };
  const handler = new TranscribeVoiceCommandHandler(
    transcription as VoiceTranscriptionResolver,
    polish as VoicePolishResolver,
  );
  return { handler, transcription, polish };
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
    );
    expect(polish.polish).toHaveBeenCalledWith(
      'um fix the login',
      ['oppenheimer', 'apps/web'],
      CHATGPT,
    );
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
