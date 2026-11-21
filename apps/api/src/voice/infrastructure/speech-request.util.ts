import { createHash } from 'node:crypto';
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

/**
 * What kind of answer a refusal was, from its content type alone: a JSON
 * error is the provider refusing, an HTML page is something in front of it
 * (a challenge, a login wall). The body itself is never repeated: it is the
 * provider's, and may echo what was sent.
 */
function answerKind(response: Response): string {
  const type = response.headers.get('content-type')?.split(';')[0].trim();
  return type ? `as ${type}` : 'no content type';
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
      detail: `${who} answered ${response.status} (${answerKind(response)}).`,
    });
  }
  const text = transcriptOf(await response.text());
  if (text === null) {
    throw new AppError(VoiceErrors.PROVIDER_UNAVAILABLE, {
      // A challenge page can come back as a 200, so this says as what, too.
      detail: `${who} answered ${response.status} with something that is not a transcript (${answerKind(response)}).`,
    });
  }
  return text;
}

/** How long one synthesis may take: a few sentences are a second or two of work. */
const SYNTHESIS_TIMEOUT_MS = 30_000;

/**
 * The largest audio read. Ogg/Opus at 32 kbit/s is 4 KB a second, so two
 * minutes is under half of this; anything past it is not a voice note.
 */
const MAX_AUDIO_BYTES = 1024 * 1024;

/** One synthesis request: where it goes, what it sends, what it counts against. */
export interface SynthesisRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  bucket: string;
  /** Who answered, for the problem's detail: "OpenAI's text-to-speech". */
  who: string;
}

/**
 * The one way a text-to-speech gateway calls its provider: through its
 * `UpstreamLimiter` (a rate refusal is `VOICE_010`), the audio read inside the
 * slot (a server streams it after its headers, so the slot holds until the
 * last byte, and reading stops at the cap rather than buffering whatever a
 * server sends). Unreachable, refused, empty or oversized is `VOICE_009`,
 * saying which; whether the bytes are a voice note is the caller's to judge.
 */
export async function exchangeSynthesis(
  limiter: UpstreamLimiter,
  { url, headers, body, bucket, who }: SynthesisRequest,
): Promise<Buffer> {
  let exchanged: { response: SpeechAnswer; errorBody: string | null };
  try {
    exchanged = await limiter.exchange(
      [bucket],
      async () =>
        speechAnswerOf(
          await fetch(url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS),
          }),
        ),
      readSpeechRefusal,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
      detail: `${who} could not be reached: ${error instanceof Error ? error.message : 'unknown error'}`,
    });
  }
  const { response, errorBody } = exchanged;
  const kind = response.headers.get('content-type')?.split(';')[0].trim() ?? 'no content type';
  // The body is never repeated: it is the provider's, and may echo the text.
  if (errorBody !== null) {
    throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
      detail: `${who} answered ${response.status} (${kind}).`,
    });
  }
  const { audio } = response;
  if (!audio || audio.length === 0) {
    throw new AppError(VoiceErrors.SYNTHESIS_UNAVAILABLE, {
      detail: `${who} answered ${audio ? 'no audio' : `more than ${MAX_AUDIO_BYTES} bytes`} (${kind}), which is not a voice note.`,
    });
  }
  return audio;
}

/**
 * Speech on any OpenAI-compatible `POST {base}/audio/speech` (OpenAI's own,
 * a self-hosted server with the same route): `model`, `voice`, `input` and
 * `response_format: "opus"`, Ogg/Opus being the one container WhatsApp plays
 * as a voice note.
 */
export function synthesizeOpenAiCompatible(
  limiter: UpstreamLimiter,
  request: {
    baseUrl: string;
    apiKey: string | undefined;
    model: string;
    voice: string;
    text: string;
    bucket: string;
    who: string;
  },
): Promise<Buffer> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'audio/ogg, audio/opus, application/octet-stream',
  };
  if (request.apiKey) headers.authorization = `Bearer ${request.apiKey}`;
  return exchangeSynthesis(limiter, {
    url: `${request.baseUrl.replace(/\/+$/, '')}/audio/speech`,
    headers,
    body: JSON.stringify({
      model: request.model,
      voice: request.voice,
      input: request.text,
      response_format: 'opus',
    }),
    bucket: request.bucket,
    who: request.who,
  });
}

/**
 * The limiter bucket for a workspace's own key: a digest, never the key, so
 * each workspace's key is counted on its own and a refusal for rate pauses
 * only the key it was for.
 */
export function workspaceKeyBucket(apiKey: string): string {
  return `key:${createHash('sha256').update(apiKey).digest('hex').slice(0, 16)}`;
}

/**
 * A speech server's answer as the limiter reads it: a refusal's body when it
 * is one, else the audio, read to the end inside the call (null past
 * `MAX_AUDIO_BYTES`, the rest of the stream cancelled).
 */
interface SpeechAnswer {
  status: number;
  headers: Headers;
  text(): Promise<string>;
  audio: Buffer | null;
}

async function speechAnswerOf(response: Response): Promise<SpeechAnswer> {
  const refused = response.status >= 400;
  return {
    status: response.status,
    headers: response.headers,
    text: () => response.text(),
    audio: refused ? null : await readAtMost(response, MAX_AUDIO_BYTES),
  };
}

/** The body's bytes, or null once it passes `max`, without reading further. */
async function readAtMost(response: Response, max: number): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
}
