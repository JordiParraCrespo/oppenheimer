import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleSpeechSynthesisGateway } from '../openai-compatible-speech-synthesis.gateway';

/**
 * The text-to-speech gateway against a `fetch` double: what it sends (the
 * text, the model, the voice, Ogg/Opus asked for), which key goes to which
 * host (the speech-to-text key never leaves its own host), that a refusal is
 * `VOICE_009` without repeating the body, and that a rate limit is
 * `VOICE_010` and pauses the next call before it reaches the network.
 */

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

function audio(status = 200, body: BodyInit = new Uint8Array([0x4f, 0x67, 0x67, 0x53])): Response {
  return new Response(body, { status, headers: { 'content-type': 'audio/ogg' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleSpeechSynthesisGateway', () => {
  it('posts the text to {base}/audio/speech as Ogg/Opus with the model, the voice and its key', async () => {
    const fetch = vi.fn().mockResolvedValue(audio());
    vi.stubGlobal('fetch', fetch);
    const gateway = new OpenAiCompatibleSpeechSynthesisGateway(
      config({
        'voice.ttsBaseUrl': 'https://tts.example/v1/',
        'voice.ttsApiKey': 'tts-key-placeholder',
        'voice.ttsModel': 'tts-placeholder',
        'voice.ttsVoice': 'nova',
      }),
    );

    await expect(gateway.synthesize('See you Tuesday.')).resolves.toEqual(Buffer.from('OggS'));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://tts.example/v1/audio/speech');
    expect(init.headers.authorization).toBe('Bearer tts-key-placeholder');
    expect(JSON.parse(init.body)).toEqual({
      model: 'tts-placeholder',
      voice: 'nova',
      input: 'See you Tuesday.',
      response_format: 'opus',
    });
  });

  // What breaks this: one OpenAI key no longer serving both, or the speech-to-text key sent to another host.
  it('borrows the speech-to-text server and its key only when it has no host of its own', async () => {
    const fetch = vi.fn().mockImplementation(async () => audio());
    vi.stubGlobal('fetch', fetch);
    const stt = {
      'voice.sttBaseUrl': 'https://api.openai.example/v1',
      'voice.sttApiKey': 'stt-key-placeholder',
      'voice.ttsModel': 'tts-placeholder',
    };

    await new OpenAiCompatibleSpeechSynthesisGateway(config(stt)).synthesize('Hi.');
    expect(fetch.mock.calls[0][0]).toBe('https://api.openai.example/v1/audio/speech');
    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer stt-key-placeholder');

    await new OpenAiCompatibleSpeechSynthesisGateway(
      config({ ...stt, 'voice.ttsBaseUrl': 'https://tts.self-hosted.example' }),
    ).synthesize('Hi.');
    expect(fetch.mock.calls[1][0]).toBe('https://tts.self-hosted.example/audio/speech');
    expect(fetch.mock.calls[1][1].headers.authorization).toBeUndefined();
  });

  it('is configured only with a model and a base URL, and refuses with VOICE_008 otherwise', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const noModel = new OpenAiCompatibleSpeechSynthesisGateway(
      config({ 'voice.sttBaseUrl': 'https://speech.example/v1' }),
    );
    expect(noModel.isConfigured()).toBe(false);
    await expect(noModel.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_008' });
    expect(
      new OpenAiCompatibleSpeechSynthesisGateway(config({ 'voice.ttsModel': 'm' })).isConfigured(),
    ).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers a refusal, an unreachable server or an empty answer with VOICE_009, never repeating the body', async () => {
    const gateway = new OpenAiCompatibleSpeechSynthesisGateway(
      config({ 'voice.ttsBaseUrl': 'https://tts.example', 'voice.ttsModel': 'm' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":"bad input: See you Tuesday."}', {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const refusal = await gateway.synthesize('See you Tuesday.').catch((error) => error);
    expect(refusal).toMatchObject({ code: 'VOICE_009' });
    expect(refusal.detail).toContain('400');
    expect(refusal.detail).not.toContain('See you Tuesday');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(gateway.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_009' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(audio(200, new Uint8Array())));
    await expect(gateway.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_009' });
  });

  it('answers a rate limit with VOICE_010 and stops calling the server until it resets', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429 }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new OpenAiCompatibleSpeechSynthesisGateway(
      config({ 'voice.ttsBaseUrl': 'https://tts.example', 'voice.ttsModel': 'm' }),
    );
    await expect(gateway.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_010' });
    await expect(gateway.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_010' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // What breaks this: a faulty server's endless body filling the API's memory before the refusal.
  it('stops reading an answer past the cap, cancels the rest, and answers VOICE_009', async () => {
    let pulled = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(256 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(audio(200, endless)));
    const gateway = new OpenAiCompatibleSpeechSynthesisGateway(
      config({ 'voice.ttsBaseUrl': 'https://tts.example', 'voice.ttsModel': 'm' }),
    );
    await expect(gateway.synthesize('Hi.')).rejects.toMatchObject({ code: 'VOICE_009' });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10);
  });

  // What breaks this: a streamed answer letting more syntheses run than the server is given.
  it('holds its slot until the audio is read, so a fifth call waits for one to finish', async () => {
    const opened: Array<ReadableStreamDefaultController<Uint8Array>> = [];
    const fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              opened.push(controller);
            },
          }),
          { status: 200, headers: { 'content-type': 'audio/ogg' } },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const gateway = new OpenAiCompatibleSpeechSynthesisGateway(
      config({ 'voice.ttsBaseUrl': 'https://tts.example', 'voice.ttsModel': 'm' }),
    );
    const calls = Array.from({ length: 5 }, () => gateway.synthesize('Hi.'));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).toHaveBeenCalledTimes(4);

    opened[0].enqueue(new Uint8Array([0x4f, 0x67, 0x67, 0x53]));
    opened[0].close();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    for (const controller of opened.slice(1)) {
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    }
    await Promise.all(calls);
  });
});
