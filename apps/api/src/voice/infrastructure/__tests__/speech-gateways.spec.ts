import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatgptSpeechGateway } from '../chatgpt-speech.gateway';
import { OpenAiCompatibleSpeechGateway } from '../openai-compatible-speech.gateway';

/**
 * Both speech gateways against a `fetch` double: what each sends (ChatGPT's
 * route gets the sign-in and Oppenheimer's own name, never a browser's or the
 * Codex app's), that a transcript is read from `{ text }` and anything else
 * is `VOICE_006`, and that a refusal for rate is `VOICE_007` and pauses the
 * next call without reaching the network (`.agents/rules/integrations.md`).
 */

const CLIP = { data: Buffer.from('RIFF-wav-bytes'), language: 'es' };
const ACCESS = { accessToken: 'access-placeholder', accountId: 'acct-1' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

afterEach(() => vi.unstubAllGlobals());

describe('ChatgptSpeechGateway', () => {
  it('posts the clip to the dictation route as itself, with the sign-in and its account', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { text: ' fix the login page ' }));
    vi.stubGlobal('fetch', fetch);

    await expect(new ChatgptSpeechGateway().transcribe(CLIP, ACCESS)).resolves.toBe(
      'fix the login page',
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://chatgpt.com/backend-api/transcribe');
    expect(init.headers).toEqual({
      authorization: 'Bearer access-placeholder',
      accept: 'application/json',
      originator: 'oppenheimer',
      'user-agent': 'oppenheimer',
      'chatgpt-account-id': 'acct-1',
    });
    const body = init.body as FormData;
    expect((body.get('file') as File).type).toBe('audio/wav');
    expect(body.get('language')).toBe('es');
  });

  it('reads a refusal, a challenge page or an answer with no text as VOICE_006', async () => {
    for (const answer of [
      json(403, { detail: 'forbidden' }),
      new Response('<html>Just a moment…</html>', { status: 200 }),
      json(200, { transcript: 'renamed field' }),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer));
      await expect(new ChatgptSpeechGateway().transcribe(CLIP, ACCESS)).rejects.toMatchObject({
        code: 'VOICE_006',
      });
    }
  });

  it('says in the refusal which status came back and as what, and not what the body said', async () => {
    for (const [answer, detail] of [
      [
        new Response('<html>Just a moment…</html>', {
          status: 403,
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        }),
        "ChatGPT's dictation route answered 403 (as text/html).",
      ],
      [
        // Bytes, not a string: a string body is given `text/plain` by `Response` itself.
        new Response(new TextEncoder().encode('{"detail":"echoed access-placeholder"}'), {
          status: 401,
        }),
        "ChatGPT's dictation route answered 401 (no content type).",
      ],
    ] as const) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer));
      await expect(new ChatgptSpeechGateway().transcribe(CLIP, ACCESS)).rejects.toMatchObject({
        code: 'VOICE_006',
        detail,
      });
    }
  });

  it('answers a rate limit with VOICE_007 and stops calling for that account', async () => {
    const fetch = vi.fn().mockResolvedValue(json(429, { error: { code: 'rate_limit_exceeded' } }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new ChatgptSpeechGateway();

    await expect(gateway.transcribe(CLIP, ACCESS)).rejects.toMatchObject({ code: 'VOICE_007' });
    await expect(gateway.transcribe(CLIP, ACCESS)).rejects.toMatchObject({ code: 'VOICE_007' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('OpenAiCompatibleSpeechGateway', () => {
  const configured = config({
    'voice.sttBaseUrl': 'https://speech.example/v1/',
    'voice.sttModel': 'whisper-placeholder',
    'voice.sttApiKey': 'key-placeholder',
  });

  it('posts to {base}/audio/transcriptions with the model and the key', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { text: 'hello' }));
    vi.stubGlobal('fetch', fetch);

    await expect(new OpenAiCompatibleSpeechGateway(configured).transcribe(CLIP)).resolves.toBe(
      'hello',
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://speech.example/v1/audio/transcriptions');
    expect(init.headers.authorization).toBe('Bearer key-placeholder');
    expect((init.body as FormData).get('model')).toBe('whisper-placeholder');
  });

  it('is configured only with a base URL and a model, and refuses with VOICE_005 otherwise', async () => {
    const bare = new OpenAiCompatibleSpeechGateway(config({}));
    expect(bare.isConfigured()).toBe(false);
    expect(new OpenAiCompatibleSpeechGateway(configured).isConfigured()).toBe(true);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(bare.transcribe(CLIP)).rejects.toMatchObject({ code: 'VOICE_005' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
