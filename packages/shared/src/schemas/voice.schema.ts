import { z } from 'zod';

/**
 * Dictation (`product/next-steps/voice.md`): one recorded clip in, the text
 * it says out. The console records 16 kHz mono 16-bit PCM and sends it as a
 * WAV file, the one format every provider behind the API takes as is
 * (ChatGPT's dictation route among them, which has refused Ogg/Opus).
 */

/** The rate the console records at: speech models resample to it anyway. */
export const VOICE_SAMPLE_RATE = 16_000;

/** The longest clip the console records before it stops on its own. */
export const VOICE_MAX_SECONDS = 120;

/**
 * The largest clip the API takes: two minutes of 16 kHz mono 16-bit PCM
 * (32,000 bytes a second) and the header, with room to spare.
 */
export const VOICE_AUDIO_MAX_BYTES = 4 * 1024 * 1024;

/** How many words the console may name for the transcript to spell right. */
export const VOICE_VOCABULARY_MAX_TERMS = 60;

/** The longest word or name in the vocabulary (a repository's full name fits). */
export const VOICE_VOCABULARY_TERM_MAX = 100;

/**
 * `POST /voice/transcriptions`'s text fields, beside the `audio` file:
 * `vocabulary` is the names the console already shows (projects,
 * repositories, hosts), one per line, so the polish spells them as written;
 * `language` an ISO 639-1 code when the speaker's is known.
 */
export const transcribeVoiceSchema = z.object({
  vocabulary: z
    .string()
    .max(VOICE_VOCABULARY_MAX_TERMS * (VOICE_VOCABULARY_TERM_MAX + 1))
    .optional(),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
});
export type TranscribeVoiceDto = z.infer<typeof transcribeVoiceSchema>;

/**
 * The vocabulary as terms: one per line, trimmed, without repeats or blanks,
 * each cut to {@link VOICE_VOCABULARY_TERM_MAX} and at most
 * {@link VOICE_VOCABULARY_MAX_TERMS} of them. The console builds it with
 * this and the API reads it with this, so the two never disagree on a term.
 */
export function vocabularyTerms(raw: string | readonly string[] | undefined): string[] {
  if (!raw) return [];
  const lines = typeof raw === 'string' ? raw.split('\n') : raw;
  const terms = new Set<string>();
  for (const line of lines) {
    const term = line.trim().slice(0, VOICE_VOCABULARY_TERM_MAX);
    if (term) terms.add(term);
    if (terms.size === VOICE_VOCABULARY_MAX_TERMS) break;
  }
  return [...terms];
}

/**
 * Who can hear a clip: the workspace's ChatGPT sign-in, or the deployment's
 * own key. A new speech provider adds its id here and nowhere else in this
 * package (`SpeechProvider` in `apps/api/src/voice/application/`).
 */
export const VOICE_PROVIDERS = ['chatgpt', 'speech_key'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

/** What a transcription answers: the text to put in the field, and what was heard. */
export interface VoiceTranscriptionDto {
  /** The transcript as writing: fillers and false starts gone, names spelled as the vocabulary has them. */
  text: string;
  /** What the speech model heard, word for word. `text` equals it when no polish ran. */
  raw: string;
  provider: VoiceProvider;
  /** Whether `text` is the polish's, or the raw transcript because no polish was quick enough. */
  polished: boolean;
}

/** `GET /voice/status`: the providers that can hear this workspace, in the order a dictation tries them. */
export interface VoiceStatusDto {
  available: boolean;
  providers: VoiceProvider[];
}
