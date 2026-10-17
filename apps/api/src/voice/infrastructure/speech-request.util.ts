import { AppError, type RefusalReader, type UpstreamLimiter } from '@oppenheimer/backend-core';
import { VoiceErrors } from '../domain/voice.errors';
import type { VoiceClip } from './speech-to-text.port';

/** How long one transcription may take: a two-minute clip is a few seconds of work. */
const SPEECH_TIMEOUT_MS = 60_000;

/** The largest answer read: a transcript of two minutes is a few kilobytes. */
const MAX_ANSWER_BYTES = 1024 * 1024;

/** The multipart body both routes take: the clip under `file`, as a WAV, and the fields beside it. */
export function speechForm(clip: VoiceClip, fields: Record<string, string | undefined>): FormData {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(clip.data)], { type: 'audio/wav' }),
    'dictation.wav',
  );
  for (const [name, value] of Object.entries(fields)) {
    if (value) form.append(name, value);
  }
  return form;
}

/**
 * The transcript in an answer: `{ "text": "…" }`, which OpenAI's API,
 * Whisper servers and ChatGPT's dictation route all send. Null for anything
 * else, so a changed answer is reported rather than inserted into a prompt.
 */
export function transcriptOf(body: string): string | null {
  if (body.length > MAX_ANSWER_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const text = (parsed as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : null;
  } catch {
    return null;
  }
}

/** A 429, or a body naming a rate limit or a spent quota, pauses the bucket. */
export const readSpeechRefusal: RefusalReader = (errorBody) => {
  const lower = errorBody.toLowerCase();
  return {
    limited:
      lower.includes('rate_limit') ||
      lower.includes('rate limit') ||
      lower.includes('too_many_requests') ||
      lower.includes('usage_limit'),
  };
};

/** One transcription request: where it goes, how it says who it is, what it counts against. */
export interface SpeechRequest {
  url: string;
  headers: Record<string, string>;
  /** The limiter bucket: what the provider counts this call against. */
  bucket: string;
  form: FormData;
  /** Who answered, for the problem's detail: "ChatGPT's dictation route". */
  who: string;
}

/**
 * The one way a speech gateway calls its provider: through its
 * `UpstreamLimiter` (a rate refusal is `VOICE_007`), then the answer read as
 * `{ "text": "…" }`. An unreachable provider, a refusal for anything but
 * rate, and an answer that is not a transcript are each `VOICE_006`, saying
 * which. The gateways differ only in the request they hand it.
 */
export async function exchangeSpeech(
  limiter: UpstreamLimiter,
  { url, headers, bucket, form, who }: SpeechRequest,
): Promise<string> {
  let exchanged: { response: Response; errorBody: string | null };
  try {
    exchanged = await limiter.exchange(
      [bucket],
      () =>
        fetch(url, {
          method: 'POST',
          headers,
          body: form,
          signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
        }),
      readSpeechRefusal,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
      detail: `${who} could not be reached: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }
  const { response, errorBody } = exchanged;
  if (errorBody !== null) {
    throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
      detail: `${who} answered ${response.status}.`,
    });
  }
  const text = transcriptOf(await response.text());
  if (text === null) {
    throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
      detail: `${who} answered something that is not a transcript.`,
    });
  }
  return text;
}
