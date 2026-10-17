import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, UpstreamLimiter } from '@oppenheimer/backend-core';
import { VoiceErrors } from '../domain/voice.errors';
import {
  readSpeechRefusal,
  SPEECH_TIMEOUT_MS,
  speechForm,
  transcriptOf,
} from './speech-request.util';
import type { ChatgptSpeechAccess, ChatgptSpeechPort, VoiceClip } from './speech-to-text.port';

/** ChatGPT's dictation route: what the Codex CLI's push-to-talk posts to. */
const TRANSCRIBE_URL = 'https://chatgpt.com/backend-api/transcribe';

/**
 * Who the requests say they come from: the same honest `originator` the
 * ChatGPT bot engine sends. Oppenheimer does not pose as the Codex app or a
 * browser; if the route only answers those, that is a refusal (`VOICE_006`)
 * and the deployment's own key is the way to dictate.
 */
const ORIGINATOR = 'oppenheimer';

/**
 * ChatGPT does not publish this route's limits. One dictation is one call, a
 * person dictates a few times a minute at most, and the route is counted
 * against the ChatGPT account (the subscription's allowance), so the bucket
 * is the account and a refusal for rate stops that account's dictation on
 * every replica until the reset. Eight in flight per process; past twenty
 * waiting a call answers `VOICE_007` rather than hanging.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 10_000 };

/**
 * Transcription on a workspace's ChatGPT sign-in (`product/next-steps/voice.md`):
 * the clip as multipart `file` (and `language` when known), the access token
 * as bearer and the account it acts for as `ChatGPT-Account-ID`; the answer
 * is `{ "text": "…" }`. The route is undocumented: any other answer, a
 * Cloudflare challenge included, is `VOICE_006`, and a refusal for rate or
 * quota is `VOICE_007` through the limiter.
 */
@Injectable()
export class ChatgptSpeechGateway implements ChatgptSpeechPort {
  private readonly limiter: UpstreamLimiter;

  constructor(@Optional() cache?: CacheService) {
    this.limiter = new UpstreamLimiter(
      'ChatGPT dictation',
      VoiceErrors.RATE_LIMITED,
      cache,
      LIMITS,
    );
  }

  async transcribe(clip: VoiceClip, access: ChatgptSpeechAccess): Promise<string> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${access.accessToken}`,
      accept: 'application/json',
      originator: ORIGINATOR,
      'user-agent': ORIGINATOR,
    };
    if (access.accountId) headers['chatgpt-account-id'] = access.accountId;

    let exchanged: { response: Response; errorBody: string | null };
    try {
      exchanged = await this.limiter.exchange(
        [this.bucketOf(access)],
        () =>
          fetch(TRANSCRIBE_URL, {
            method: 'POST',
            headers,
            body: speechForm(clip, { language: clip.language }),
            signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
          }),
        readSpeechRefusal,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `ChatGPT could not be reached: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }

    const { response, errorBody } = exchanged;
    if (errorBody !== null) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: `ChatGPT's dictation route answered ${response.status}.`,
      });
    }
    const text = transcriptOf(await response.text());
    if (text === null) {
      throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
        detail: "ChatGPT's dictation route answered something that is not a transcript.",
      });
    }
    return text;
  }

  /** The ChatGPT account the call is counted against; a digest of the token when the sign-in names none. */
  private bucketOf(access: ChatgptSpeechAccess): string {
    if (access.accountId) return `account:${access.accountId}`;
    return `token:${createHash('sha256').update(access.accessToken).digest('hex').slice(0, 16)}`;
  }
}
