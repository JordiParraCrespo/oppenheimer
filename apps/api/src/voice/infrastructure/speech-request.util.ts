import type { RefusalReader } from '@oppenheimer/backend-core';
import type { VoiceClip } from './speech-to-text.port';

/** How long one transcription may take: a two-minute clip is a few seconds of work. */
export const SPEECH_TIMEOUT_MS = 60_000;

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
