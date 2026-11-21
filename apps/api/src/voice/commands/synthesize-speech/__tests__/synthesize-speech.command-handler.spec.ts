import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@oppenheimer/shared';
import { oggOpus } from '../../../__tests__/ogg-opus.spec-support';
import type { Synthesizer } from '../../../application/synthesis-provider.port';
import { SynthesisProviderRegistry } from '../../../application/synthesis-provider.registry';
import { VoiceSynthesisResolver } from '../../../application/voice-synthesis.resolver';
import type { VoiceSettingsRepositoryPort } from '../../../database/voice-settings.repository.port';
import { SynthesizeSpeechCommand } from '../synthesize-speech.command';
import { SynthesizeSpeechCommandHandler } from '../synthesize-speech.command-handler';

/**
 * Speaking a bot's text over a double of one voice and the workspace's
 * settings: the text judged before anything is spent, the answer judged by
 * its bytes after, so only a playable Ogg/Opus note of a voice note's length
 * comes back. Who speaks is `VoiceSynthesisResolver`'s spec; the HTTP is each
 * gateway's.
 */
function speech(
  answer: Buffer | Error,
  { configured = true, settings = DEFAULT_VOICE_SETTINGS } = {} as {
    configured?: boolean;
    settings?: VoiceSettings;
  },
) {
  const voice: Synthesizer<null> = {
    id: 'speech_key',
    availableFor: async () => configured,
    grantFor: async () => null,
    synthesize: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  const repository: VoiceSettingsRepositoryPort = {
    find: async () => settings,
    put: vi.fn(),
  };
  const resolver = new VoiceSynthesisResolver(new SynthesisProviderRegistry([voice]));
  return { voice, handler: new SynthesizeSpeechCommandHandler(resolver, repository) };
}

const speak = (text: string) => new SynthesizeSpeechCommand({ organizationId: 'org-1', text });

describe('SynthesizeSpeechCommandHandler', () => {
  it('speaks the trimmed text and answers the audio with how long it runs', async () => {
    const audio = oggOpus(312 + 48_000 * 4);
    const { voice, handler } = speech(audio);
    await expect(handler.execute(speak('  See you Tuesday.  '))).resolves.toEqual({
      data: audio,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 4,
    });
    expect(voice.synthesize).toHaveBeenCalledWith('See you Tuesday.', null, {
      model: null,
      voice: null,
    });
  });

  it('refuses an empty or too long text with VOICE_011, spending nothing', async () => {
    const { voice, handler } = speech(oggOpus(96_000));
    await expect(handler.execute(speak('   '))).rejects.toMatchObject({ code: 'VOICE_011' });
    await expect(handler.execute(speak('a'.repeat(601)))).rejects.toMatchObject({
      code: 'VOICE_011',
    });
    expect(voice.synthesize).not.toHaveBeenCalled();
  });

  it('refuses with VOICE_008 when the workspace has no provider that speaks', async () => {
    const { voice, handler } = speech(oggOpus(96_000), { configured: false });
    await expect(handler.execute(speak('Hi.'))).rejects.toMatchObject({ code: 'VOICE_008' });
    expect(voice.synthesize).not.toHaveBeenCalled();
  });

  // What breaks this: an MP3 from a misconfigured server sent as a voice note nobody can play.
  it('refuses audio that is not Ogg/Opus, or runs past two minutes, with VOICE_009', async () => {
    await expect(
      speech(Buffer.from('ID3 mp3')).handler.execute(speak('Hi.')),
    ).rejects.toMatchObject({ code: 'VOICE_009' });
    await expect(
      speech(oggOpus(312 + 48_000 * 121)).handler.execute(speak('Hi.')),
    ).rejects.toMatchObject({ code: 'VOICE_009' });
  });
});
