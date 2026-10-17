import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, UpstreamLimiter } from '@oppenheimer/backend-core';
import { VoiceErrors } from '../domain/voice.errors';
import {
  readSpeechRefusal,
  SPEECH_TIMEOUT_MS,
  speechForm,
  transcriptOf,
} from './speech-request.util';
import type { KeyedSpeechPort, VoiceClip } from './speech-to-text.port';

/**
 * OpenAI counts audio requests per minute against the key's organization;
 * Groq counts requests and audio seconds per hour against the key; a
 * self-hosted Whisper counts nothing but its own GPU. All of them are one key
 * for the whole deployment, so there is one bucket, and a refusal for rate
 * (a `429`, or a body naming the limit) stops every workspace's dictation on
 * the key until the reset. Eight in flight per process keeps a self-hosted
 * server from being queued into its own timeout.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 10_000 };
const KEY_BUCKET = 'key';

/**
 * Transcription on the deployment's own speech-to-text server
 * (`VOICE_STT_BASE_URL`, `VOICE_STT_MODEL`, `VOICE_STT_API_KEY`): the
 * OpenAI-compatible `POST {base}/audio/transcriptions` with `file`, `model`
 * and `language`, answering `{ "text": "…" }`.
 */
@Injectable()
export class OpenAiCompatibleSpeechGateway implements KeyedSpeechPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly config: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter('Speech-to-text', VoiceErrors.RATE_LIMITED, cache, LIMITS);
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.model);
  }

  async transcribe(clip: VoiceClip): Promise<string> {
    const { baseUrl, model } = this;
    if (!baseUrl || !model) throw new AppError(VoiceErrors.NOT_CONFIGURED);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    let exchanged: { response: Response; errorBody: string | null };
    try {
      exchanged = await this.limiter.exchange(
        [KEY_BUCKET],
        () =>
          fetch(`${baseUrl.replace(/\/+$/, '')}/audio/transcriptions`, {
            method: 'POST',
            headers,
            body: speechForm(clip, { model, language: clip.language }),
            signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
          }),
        readSpeechRefusal,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `The speech-to-text server could not be reached: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }

    const { response, errorBody } = exchanged;
    if (errorBody !== null) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `The speech-to-text server answered ${response.status}.`,
      });
    }
    const text = transcriptOf(await response.text());
    if (text === null) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: 'The speech-to-text server answered something that is not a transcript.',
      });
    }
    return text;
  }

  private get baseUrl(): string | undefined {
    return this.config.get<string>('voice.sttBaseUrl');
  }

  private get model(): string | undefined {
    return this.config.get<string>('voice.sttModel');
  }

  private get apiKey(): string | undefined {
    return this.config.get<string>('voice.sttApiKey');
  }
}
