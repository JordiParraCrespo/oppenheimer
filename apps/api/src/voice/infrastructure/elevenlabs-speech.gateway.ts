import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { UpstreamLimiter } from '@oppenheimer/backend-core';
import { TRANSCRIPTION_MODELS, voiceModelFor } from '@oppenheimer/shared';
import { VoiceErrors } from '../domain/voice.errors';
import {
  exchangeSpeech,
  exchangeSynthesis,
  speechForm,
  workspaceKeyBucket,
} from './speech-request.util';
import type { VoiceClip } from './speech-to-text.port';
import type { ElevenlabsSpeechPort, SynthesisVoiceChoice } from './workspace-speech.port';

const BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Ogg/Opus, the one container WhatsApp plays as a voice note, at 48 kHz and
 * 64 kbit/s: two minutes is under a megabyte, inside what one read takes.
 */
const OUTPUT_FORMAT = 'opus_48000_64';

/**
 * ElevenLabs counts characters and concurrent requests against the account
 * the key belongs to, so the bucket is the key (a digest of it), one each for
 * hearing and speaking; a refusal for rate pauses that workspace's key only.
 * Its lowest plans allow two to three requests at once, so two in flight per
 * process for speech.
 */
const HEAR_LIMITS = { maxInFlight: 4, maxQueued: 20, maxWaitMs: 10_000 };
const SPEAK_LIMITS = { maxInFlight: 2, maxQueued: 20, maxWaitMs: 10_000 };

/**
 * ElevenLabs on a workspace's own key, sent as `xi-api-key`: Scribe hears a
 * clip (`POST /speech-to-text`, `file` and `model_id`, answering a `text`
 * among other fields); a voice speaks a text (`POST /text-to-speech/{voice}`
 * with `text` and `model_id`, answering the audio's bytes). Scribe takes no
 * list of names to expect, so they reach this path through the polish alone.
 */
@Injectable()
export class ElevenlabsSpeechGateway implements ElevenlabsSpeechPort {
  private readonly hearing: UpstreamLimiter;
  private readonly speaking: UpstreamLimiter;

  constructor(@Optional() cache?: CacheService) {
    this.hearing = new UpstreamLimiter(
      'ElevenLabs speech-to-text',
      VoiceErrors.RATE_LIMITED,
      cache,
      HEAR_LIMITS,
    );
    this.speaking = new UpstreamLimiter(
      'ElevenLabs text-to-speech',
      VoiceErrors.SYNTHESIS_RATE_LIMITED,
      cache,
      SPEAK_LIMITS,
    );
  }

  transcribe(clip: VoiceClip, apiKey: string): Promise<string> {
    const model = clip.model ?? voiceModelFor(TRANSCRIPTION_MODELS.elevenlabs, null) ?? 'scribe_v1';
    return exchangeSpeech(this.hearing, {
      url: `${BASE_URL}/speech-to-text`,
      headers: { accept: 'application/json', 'xi-api-key': apiKey },
      bucket: workspaceKeyBucket(apiKey),
      form: speechForm(clip, { model_id: model, language_code: clip.language }),
      who: "ElevenLabs' speech-to-text",
    });
  }

  synthesize(
    text: string,
    apiKey: string,
    { model, voice }: SynthesisVoiceChoice,
  ): Promise<Buffer> {
    return exchangeSynthesis(this.speaking, {
      url: `${BASE_URL}/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT_FORMAT}`,
      headers: {
        'content-type': 'application/json',
        accept: 'audio/ogg, audio/opus, application/octet-stream',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text, model_id: model }),
      bucket: workspaceKeyBucket(apiKey),
      who: "ElevenLabs' text-to-speech",
    });
  }
}
