import { oggOpus } from '../../../__tests__/ogg-opus.spec-support';
import type { SpeechSynthesisPort } from '../../../infrastructure/speech-synthesis.port';
import { SynthesizeSpeechCommand } from '../synthesize-speech.command';
import { SynthesizeSpeechCommandHandler } from '../synthesize-speech.command-handler';

/**
 * Speaking a bot's text over a double of the speech port: the text judged
 * before anything is spent, the answer judged by its bytes after, so only
 * a playable Ogg/Opus note of a voice note's length comes back. The HTTP is
 * the gateway's spec.
 */
function speech(answer: Buffer | Error, configured = true) {
  const port: SpeechSynthesisPort = {
    isConfigured: () => configured,
    synthesize: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
  return { port, handler: new SynthesizeSpeechCommandHandler(port) };
}

const speak = (text: string) => new SynthesizeSpeechCommand({ organizationId: 'org-1', text });

describe('SynthesizeSpeechCommandHandler', () => {
  it('speaks the trimmed text and answers the audio with how long it runs', async () => {
    const audio = oggOpus(312 + 48_000 * 4);
    const { port, handler } = speech(audio);
    await expect(handler.execute(speak('  See you Tuesday.  '))).resolves.toEqual({
      data: audio,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 4,
    });
    expect(port.synthesize).toHaveBeenCalledWith('See you Tuesday.');
  });

  it('refuses an empty or too long text with VOICE_011, spending nothing', async () => {
    const { port, handler } = speech(oggOpus(96_000));
    await expect(handler.execute(speak('   '))).rejects.toMatchObject({ code: 'VOICE_011' });
    await expect(handler.execute(speak('a'.repeat(601)))).rejects.toMatchObject({
      code: 'VOICE_011',
    });
    expect(port.synthesize).not.toHaveBeenCalled();
  });

  it('refuses with VOICE_008 when the deployment has no text-to-speech server', async () => {
    const { port, handler } = speech(oggOpus(96_000), false);
    await expect(handler.execute(speak('Hi.'))).rejects.toMatchObject({ code: 'VOICE_008' });
    expect(port.synthesize).not.toHaveBeenCalled();
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
