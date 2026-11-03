import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, UpstreamLimiter } from '@oppenheimer/backend-core';
import { VOICE_LIVE_SAMPLE_RATE } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import { readSpeechRefusal } from './speech-request.util';
import type { LiveSpeechHints, LiveSpeechPort, LiveSpeechTicket } from './speech-to-text.port';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/** Where the console opens the session; `intent=transcription` is the one a transcription session takes. */
const REALTIME_SOCKET_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';

/**
 * How long a minted secret opens a session for. It only has to outlive the
 * socket being opened, which happens as the recording starts.
 */
const SECRET_SECONDS = 60;

/** Minting a secret is one small request; it should answer in well under this. */
const MINT_TIMEOUT_MS = 10_000;

/**
 * OpenAI counts realtime sessions and requests per minute against the key's
 * organization: one key for the whole deployment, so one bucket, and a rate
 * refusal pauses every workspace's live dictation until the reset (the
 * recording still lands when it stops, through `KeyedSpeechPort` or a sign-in).
 */
const LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 5_000 };
const KEY_BUCKET = 'live';

/** A keyword may not hold `<`, `>` or a line break; one longer than this is no name. */
const KEYWORD_MAX = 100;

/**
 * Live dictation on OpenAI's realtime transcription
 * (`POST /v1/realtime/client_secrets`, a `transcription` session): the
 * console streams the recording over the socket the secret opens and shows
 * the words as they come. Turn detection is off: the console commits once,
 * when the recording stops.
 */
@Injectable()
export class OpenAiLiveSpeechGateway implements LiveSpeechPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly config: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter('Live speech', VoiceErrors.RATE_LIMITED, cache, LIMITS);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async open(hints: LiveSpeechHints): Promise<LiveSpeechTicket> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new AppError(VoiceErrors.LIVE_NOT_CONFIGURED);
    const keywords = hints.keywords
      .map((keyword) =>
        keyword
          .replace(/[<>\r\n]/g, ' ')
          .trim()
          .slice(0, KEYWORD_MAX),
      )
      .filter(Boolean);
    const transcription: Record<string, unknown> = { model: this.model };
    if (keywords.length) transcription.keywords = keywords;
    if (hints.language) transcription.languages = [hints.language];

    let exchanged: { response: Response; errorBody: string | null };
    try {
      exchanged = await this.limiter.exchange(
        [KEY_BUCKET],
        () =>
          fetch(`${OPENAI_BASE_URL}/realtime/client_secrets`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              expires_after: { anchor: 'created_at', seconds: SECRET_SECONDS },
              session: {
                type: 'transcription',
                audio: {
                  input: {
                    format: { type: 'audio/pcm', rate: VOICE_LIVE_SAMPLE_RATE },
                    transcription,
                    turn_detection: null,
                  },
                },
              },
            }),
            signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
          }),
        readSpeechRefusal,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `OpenAI's realtime API could not be reached: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
    const { response, errorBody } = exchanged;
    if (errorBody !== null) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `OpenAI's realtime API answered ${response.status} to a live dictation.`,
      });
    }
    const ticket = ticketOf(await response.text());
    if (!ticket) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `OpenAI's realtime API answered ${response.status} with something that is not a client secret.`,
      });
    }
    return { url: REALTIME_SOCKET_URL, ...ticket };
  }

  private get model(): string {
    return this.config.get<string>('voice.liveModel') ?? 'gpt-live-transcribe';
  }

  /** `VOICE_LIVE_API_KEY`, or the speech server's key when that server is OpenAI's own. */
  private get apiKey(): string | undefined {
    const own = this.config.get<string>('voice.liveApiKey');
    if (own) return own;
    const base = this.config.get<string>('voice.sttBaseUrl');
    const sttKey = this.config.get<string>('voice.sttApiKey');
    return base && sttKey && isOpenAi(base) ? sttKey : undefined;
  }
}

function isOpenAi(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === 'api.openai.com';
  } catch {
    return false;
  }
}

/** `{ "value": "ek_…", "expires_at": <seconds> }`, or null for anything else. */
export function ticketOf(body: string): { secret: string; expiresAt: Date } | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { value, expires_at } = parsed as { value?: unknown; expires_at?: unknown };
    if (typeof value !== 'string' || !value || typeof expires_at !== 'number') return null;
    return { secret: value, expiresAt: new Date(expires_at * 1000) };
  } catch {
    return null;
  }
}
