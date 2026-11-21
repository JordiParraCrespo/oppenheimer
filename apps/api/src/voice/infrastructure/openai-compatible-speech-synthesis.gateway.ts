import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, UpstreamLimiter } from '@oppenheimer/backend-core';
import { speechSynthesisIsConfigured } from '../../config/voice.config';
import { VoiceErrors } from '../domain/voice.errors';
import { synthesizeOpenAiCompatible } from './speech-request.util';
import type { SpeechSynthesisPort } from './speech-synthesis.port';

/**
 * OpenAI counts speech requests per minute against the key's organization; a
 * self-hosted server counts nothing but its own GPU. Either way it is one key
 * for the whole deployment, so there is one bucket, and a refusal for rate
 * (a `429`, or a body naming the limit) stops every bot's voice notes on the
 * key until the reset. A bot speaks a reply at a time, so four in flight per
 * process is plenty and keeps a self-hosted server out of its own timeout.
 * One voice note is one call.
 */
const LIMITS = { maxInFlight: 4, maxQueued: 20, maxWaitMs: 10_000 };
const KEY_BUCKET = 'key';

const WHO = 'The text-to-speech server';

/**
 * Speech on the deployment's own text-to-speech server: the OpenAI-compatible
 * `POST {base}/audio/speech` with `model`, `voice`, `input` and
 * `response_format: "opus"` (Ogg/Opus, the one container WhatsApp plays as a
 * voice note), answering the audio's bytes. `VOICE_TTS_BASE_URL` and its key,
 * or else the speech-to-text server's base URL and key (`voice.config.ts`
 * says why the key only follows its own host).
 */
@Injectable()
export class OpenAiCompatibleSpeechSynthesisGateway implements SpeechSynthesisPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly config: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter(
      'Text-to-speech',
      VoiceErrors.SYNTHESIS_RATE_LIMITED,
      cache,
      LIMITS,
    );
  }

  isConfigured(): boolean {
    return speechSynthesisIsConfigured(this.config);
  }

  async synthesize(text: string): Promise<Buffer> {
    const baseUrl = this.baseUrl;
    const model = this.model;
    if (!baseUrl || !model) throw new AppError(VoiceErrors.SYNTHESIS_NOT_CONFIGURED);
    return synthesizeOpenAiCompatible(this.limiter, {
      baseUrl,
      apiKey: this.apiKey,
      model,
      voice: this.voice,
      text,
      bucket: KEY_BUCKET,
      who: WHO,
    });
  }

  private get baseUrl(): string | undefined {
    return (
      this.config.get<string>('voice.ttsBaseUrl') ?? this.config.get<string>('voice.sttBaseUrl')
    );
  }

  /** Its own key with its own host; the speech-to-text key only on the speech-to-text host. */
  private get apiKey(): string | undefined {
    if (this.config.get<string>('voice.ttsBaseUrl'))
      return this.config.get<string>('voice.ttsApiKey');
    return this.config.get<string>('voice.ttsApiKey') ?? this.config.get<string>('voice.sttApiKey');
  }

  private get model(): string | undefined {
    return this.config.get<string>('voice.ttsModel');
  }

  private get voice(): string {
    return this.config.get<string>('voice.ttsVoice') ?? 'alloy';
  }
}
