import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { UpstreamLimiter } from '@oppenheimer/backend-core';
import { TRANSCRIPTION_MODELS, voiceModelFor } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import { exchangeSpeech, speechForm, workspaceKeyBucket } from './speech-request.util';
import type { VoiceClip } from './speech-to-text.port';
import type { GroqSpeechPort } from './workspace-speech.port';

const BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq counts requests and audio seconds per hour against the key, so the
 * bucket is the key (a digest of it): a refusal for rate pauses that
 * workspace's dictation until the reset, nobody else's.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 10_000 };

/**
 * Whisper on a workspace's own Groq key, through Groq's OpenAI-compatible
 * `POST /audio/transcriptions`, which takes the same `file`, `model`,
 * `language` and `prompt` and answers `{ "text": "…" }`.
 */
@Injectable()
export class GroqSpeechGateway implements GroqSpeechPort {
  private readonly limiter: UpstreamLimiter;

  constructor(@Optional() cache?: CacheService) {
    this.limiter = new UpstreamLimiter(
      'Groq speech-to-text',
      VoiceErrors.RATE_LIMITED,
      cache,
      LIMITS,
    );
  }

  transcribe(clip: VoiceClip, apiKey: string): Promise<string> {
    const model =
      clip.model ?? voiceModelFor(TRANSCRIPTION_MODELS.groq, null) ?? 'whisper-large-v3-turbo';
    return exchangeSpeech(this.limiter, {
      url: `${BASE_URL}/audio/transcriptions`,
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
      bucket: workspaceKeyBucket(apiKey),
      form: speechForm(clip, { model, language: clip.language, prompt: clip.prompt }),
      who: "Groq's speech-to-text",
    });
  }
}
