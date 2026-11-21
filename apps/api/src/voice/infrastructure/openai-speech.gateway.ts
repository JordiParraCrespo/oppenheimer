import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { UpstreamLimiter } from '@oppenheimer/backend-core';
import { TRANSCRIPTION_MODELS, voiceModelFor } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import {
  exchangeSpeech,
  speechForm,
  synthesizeOpenAiCompatible,
  workspaceKeyBucket,
} from './speech-request.util';
import type { VoiceClip } from './speech-to-text.port';
import type { OpenAiSpeechPort, SynthesisVoiceChoice } from './workspace-speech.port';

const BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI counts audio requests per minute against the key's organization, so
 * the bucket is the key (a digest of it), one each for hearing and speaking:
 * a refusal for rate pauses that workspace's key until the reset, nobody
 * else's. A person dictates a few times a minute and a bot speaks a reply at
 * a time, so eight and four in flight per process are plenty.
 */
const HEAR_LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 10_000 };
const SPEAK_LIMITS = { maxInFlight: 4, maxQueued: 20, maxWaitMs: 10_000 };

/** OpenAI's audio API on a workspace's own key: `prompt` carries the names to expect. */
@Injectable()
export class OpenAiSpeechGateway implements OpenAiSpeechPort {
  private readonly hearing: UpstreamLimiter;
  private readonly speaking: UpstreamLimiter;

  constructor(@Optional() cache?: CacheService) {
    this.hearing = new UpstreamLimiter(
      'OpenAI speech-to-text',
      VoiceErrors.RATE_LIMITED,
      cache,
      HEAR_LIMITS,
    );
    this.speaking = new UpstreamLimiter(
      'OpenAI text-to-speech',
      VoiceErrors.SYNTHESIS_RATE_LIMITED,
      cache,
      SPEAK_LIMITS,
    );
  }

  transcribe(clip: VoiceClip, apiKey: string): Promise<string> {
    const model = clip.model ?? voiceModelFor(TRANSCRIPTION_MODELS.openai, null) ?? 'whisper-1';
    return exchangeSpeech(this.hearing, {
      url: `${BASE_URL}/audio/transcriptions`,
      headers: { accept: 'application/json', authorization: `Bearer ${apiKey}` },
      bucket: workspaceKeyBucket(apiKey),
      form: speechForm(clip, { model, language: clip.language, prompt: clip.prompt }),
      who: "OpenAI's speech-to-text",
    });
  }

  synthesize(
    text: string,
    apiKey: string,
    { model, voice }: SynthesisVoiceChoice,
  ): Promise<Buffer> {
    return synthesizeOpenAiCompatible(this.speaking, {
      baseUrl: BASE_URL,
      apiKey,
      model,
      voice,
      text,
      bucket: workspaceKeyBucket(apiKey),
      who: "OpenAI's text-to-speech",
    });
  }
}
