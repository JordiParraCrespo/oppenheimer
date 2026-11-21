import { afterEach, describe, expect, it, vi } from 'vitest';
import { oggOpus } from '../../__tests__/ogg-opus.spec-support';
import { ElevenlabsSpeechGateway } from '../elevenlabs-speech.gateway';
import { GroqSpeechGateway } from '../groq-speech.gateway';
import { OpenAiSpeechGateway } from '../openai-speech.gateway';

/**
 * The gateways on a workspace's own key against a `fetch` double: each sends
 * the key the way its vendor reads it, the model the walk chose (or the
 * catalog's default), and reads the answer the module's way; a refusal for
 * rate pauses that key alone. What breaks if this regresses: a key sent to
 * the wrong header is a 401 on every dictation, or one workspace's rate limit
 * stops another's.
 */

const CLIP = { data: Buffer.from('RIFF-wav-bytes'), language: 'ca', prompt: 'Oppenheimer' };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiSpeechGateway', () => {
  it('hears on the chosen model with the key as bearer and the names as a prompt', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { text: 'arregla el login' }));
    vi.stubGlobal('fetch', fetch);

    await expect(
      new OpenAiSpeechGateway().transcribe({ ...CLIP, model: 'whisper-1' }, 'sk-placeholder'),
    ).resolves.toBe('arregla el login');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.headers.authorization).toBe('Bearer sk-placeholder');
    const body = init.body as FormData;
    expect(body.get('model')).toBe('whisper-1');
    expect(body.get('prompt')).toBe('Oppenheimer');
  });

  it("speaks Ogg/Opus in the chosen voice, and answers the provider's bytes", async () => {
    const audio = oggOpus(96_000);
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array(audio)));
    vi.stubGlobal('fetch', fetch);

    await expect(
      new OpenAiSpeechGateway().synthesize('Hola', 'sk-placeholder', {
        model: 'tts-1',
        voice: 'nova',
      }),
    ).resolves.toEqual(audio);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(JSON.parse(init.body)).toEqual({
      model: 'tts-1',
      voice: 'nova',
      input: 'Hola',
      response_format: 'opus',
    });
  });

  it("pauses the key a rate limit was for, and not another workspace's", async () => {
    const fetch = vi.fn().mockResolvedValue(json(429, { error: { code: 'rate_limit_exceeded' } }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new OpenAiSpeechGateway();

    await expect(gateway.transcribe(CLIP, 'sk-limited')).rejects.toMatchObject({
      code: 'VOICE_007',
    });
    await expect(gateway.transcribe(CLIP, 'sk-limited')).rejects.toMatchObject({
      code: 'VOICE_007',
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockResolvedValue(json(200, { text: 'ok' }));
    await expect(gateway.transcribe(CLIP, 'sk-other')).resolves.toBe('ok');
  });
});

describe('GroqSpeechGateway', () => {
  it("hears on Groq's OpenAI-compatible route, on the catalog's default model when none was chosen", async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { text: 'fix the login' }));
    vi.stubGlobal('fetch', fetch);

    await expect(new GroqSpeechGateway().transcribe(CLIP, 'gsk-placeholder')).resolves.toBe(
      'fix the login',
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.headers.authorization).toBe('Bearer gsk-placeholder');
    expect((init.body as FormData).get('model')).toBe('whisper-large-v3-turbo');
  });
});

describe('ElevenlabsSpeechGateway', () => {
  it('hears with Scribe, the key as xi-api-key and the language as its code', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(200, { language_code: 'cat', text: 'arregla el login', words: [] }));
    vi.stubGlobal('fetch', fetch);

    await expect(new ElevenlabsSpeechGateway().transcribe(CLIP, 'el-placeholder')).resolves.toBe(
      'arregla el login',
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(init.headers['xi-api-key']).toBe('el-placeholder');
    expect(init.headers.authorization).toBeUndefined();
    const body = init.body as FormData;
    expect(body.get('model_id')).toBe('scribe_v1');
    expect(body.get('language_code')).toBe('ca');
  });

  it('speaks in the chosen voice as Ogg/Opus, the voice in the path', async () => {
    const audio = oggOpus(96_000);
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array(audio)));
    vi.stubGlobal('fetch', fetch);

    await expect(
      new ElevenlabsSpeechGateway().synthesize('Hola', 'el-placeholder', {
        model: 'eleven_flash_v2_5',
        voice: 'my-cloned_Voice1',
      }),
    ).resolves.toEqual(audio);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/my-cloned_Voice1?output_format=opus_48000_64',
    );
    expect(JSON.parse(init.body)).toEqual({ text: 'Hola', model_id: 'eleven_flash_v2_5' });
  });

  it('reads a refused voice as VOICE_009, never echoing the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(404, { detail: { message: 'voice Hola not found' } })),
    );
    const refusal = await new ElevenlabsSpeechGateway()
      .synthesize('Hola', 'el-placeholder', { model: 'eleven_multilingual_v2', voice: 'gone' })
      .catch((error) => error);
    expect(refusal).toMatchObject({ code: 'VOICE_009' });
    expect(refusal.detail).not.toContain('Hola');
  });
});
