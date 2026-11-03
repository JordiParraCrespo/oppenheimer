import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiLiveSpeechGateway } from '../openai-live-speech.gateway';

/**
 * Live dictation's gateway against a `fetch` double: it mints a
 * transcription session on the deployment's OpenAI key and hands back only
 * the short-lived secret (the key never leaves the API), it finds that key in
 * `VOICE_LIVE_API_KEY` or an OpenAI `VOICE_STT_*`, and a refusal for rate is
 * `VOICE_007`, anything else that is not a secret `VOICE_006`
 * (`.agents/rules/integrations.md`).
 */

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

const LIVE = config({ 'voice.liveApiKey': 'sk-live', 'voice.liveModel': 'gpt-live-transcribe' });

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiLiveSpeechGateway', () => {
  it('mints a transcription session with the names to expect and hands back only its secret', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(200, { value: 'ek_123', expires_at: 1_800_000_000 }));
    vi.stubGlobal('fetch', fetch);

    const ticket = await new OpenAiLiveSpeechGateway(LIVE).open({
      keywords: ['apps/web', 'bad<name>'],
      language: 'es',
    });

    expect(ticket).toEqual({
      url: 'wss://api.openai.com/v1/realtime?intent=transcription',
      secret: 'ek_123',
      expiresAt: new Date(1_800_000_000_000),
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect(init.headers.authorization).toBe('Bearer sk-live');
    const body = JSON.parse(init.body);
    expect(body.session).toEqual({
      type: 'transcription',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24_000 },
          transcription: {
            model: 'gpt-live-transcribe',
            keywords: ['apps/web', 'bad name'],
            languages: ['es'],
          },
          turn_detection: null,
        },
      },
    });
  });

  it("uses the speech server's key when that server is OpenAI's own, and no other", () => {
    const openai = config({
      'voice.sttBaseUrl': 'https://api.openai.com/v1',
      'voice.sttApiKey': 'sk-stt',
    });
    const groq = config({
      'voice.sttBaseUrl': 'https://api.groq.com/openai/v1',
      'voice.sttApiKey': 'gsk-stt',
    });
    expect(new OpenAiLiveSpeechGateway(openai).isConfigured()).toBe(true);
    expect(new OpenAiLiveSpeechGateway(groq).isConfigured()).toBe(false);
  });

  it('refuses with VOICE_008 and calls nothing when there is no key', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      new OpenAiLiveSpeechGateway(config({})).open({ keywords: [] }),
    ).rejects.toMatchObject({ code: 'VOICE_008' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads a refusal or an answer with no secret as VOICE_006', async () => {
    for (const answer of [
      json(401, { error: { message: 'bad key' } }),
      json(200, { id: 'sess' }),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer));
      await expect(new OpenAiLiveSpeechGateway(LIVE).open({ keywords: [] })).rejects.toMatchObject({
        code: 'VOICE_006',
      });
    }
  });

  it('reads a rate refusal as VOICE_007 and does not call again until the reset', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded' } }), {
        status: 429,
        headers: { 'retry-after': '30' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const gateway = new OpenAiLiveSpeechGateway(LIVE);

    await expect(gateway.open({ keywords: [] })).rejects.toMatchObject({ code: 'VOICE_007' });
    await expect(gateway.open({ keywords: [] })).rejects.toMatchObject({ code: 'VOICE_007' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
