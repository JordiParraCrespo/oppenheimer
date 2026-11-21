import { z } from 'zod';
import { BOT_PROVIDER_CATALOG, BOT_PROVIDERS, type BotProvider } from './bot.schema.js';
import {
  SYNTHESIS_MODELS,
  SYNTHESIS_PROVIDERS,
  type SynthesisProvider,
  synthesisVoiceFor,
  TRANSCRIPTION_MODELS,
  VOICE_PROVIDERS,
  type VoiceProvider,
  voiceModelFor,
} from './voice-catalog.schema.js';

/**
 * Dictation: one recorded clip in, the text it says out. The console records 16
 * kHz mono 16-bit PCM and sends it as a WAV file, the one format every provider
 * behind the API takes as is (ChatGPT's dictation route among them, which has
 * refused Ogg/Opus).
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

/** A voice id as a provider takes it in a URL: letters, digits, `_` and `-`. */
export const SYNTHESIS_VOICE_ID_MAX = 64;
export const synthesisVoiceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(SYNTHESIS_VOICE_ID_MAX)
  .regex(/^[A-Za-z0-9_-]+$/);
const voiceModelIdSchema = z.string().min(1).max(64);

/** `PUT /voice/settings`'s voice id alone, for the console's form that takes one. */
export const synthesisVoiceFormSchema = z.object({ voice: synthesisVoiceIdSchema });
export type SynthesisVoiceFormDto = z.infer<typeof synthesisVoiceFormSchema>;

/** No polish: the transcript goes in the field as heard. */
export const POLISH_OFF = 'off' as const;
export const POLISH_CHOICES = [...BOT_PROVIDERS, POLISH_OFF] as const;
export type PolishChoice = (typeof POLISH_CHOICES)[number];

/**
 * `PUT /voice/settings`: how the workspace hears and speaks, replaced whole.
 * A null provider is automatic (the order above, the first one available); a
 * null model or voice is the provider's default. A chosen provider is tried
 * first, and the others after it when it is not available or fails, so a key
 * removed later never stops dictation. The polish runs on the chosen bot
 * provider's credential and model, `off` skips it, null keeps the automatic
 * rule (the sign-in that heard the clip, else the deployment's LLM).
 */
export const voiceSettingsSchema = z
  .object({
    transcriptionProvider: z.enum(VOICE_PROVIDERS).nullable(),
    transcriptionModel: voiceModelIdSchema.nullable(),
    synthesisProvider: z.enum(SYNTHESIS_PROVIDERS).nullable(),
    synthesisModel: voiceModelIdSchema.nullable(),
    synthesisVoice: synthesisVoiceIdSchema.nullable(),
    polishProvider: z.enum(POLISH_CHOICES).nullable(),
    polishModel: voiceModelIdSchema.nullable(),
  })
  .superRefine((value, context) => {
    const invalid = (path: string) =>
      context.addIssue({ code: 'custom', path: [path], params: { i18nKey: 'validation.invalid' } });
    const listed = (models: readonly { id: string }[], id: string | null) =>
      id === null || models.some((row) => row.id === id);
    if (
      value.transcriptionModel !== null &&
      (value.transcriptionProvider === null ||
        !listed(TRANSCRIPTION_MODELS[value.transcriptionProvider], value.transcriptionModel))
    ) {
      invalid('transcriptionModel');
    }
    if (
      value.synthesisModel !== null &&
      (value.synthesisProvider === null ||
        !listed(SYNTHESIS_MODELS[value.synthesisProvider], value.synthesisModel))
    ) {
      invalid('synthesisModel');
    }
    if (
      value.synthesisVoice !== null &&
      (value.synthesisProvider === null ||
        synthesisVoiceFor(
          value.synthesisProvider,
          value.synthesisVoice,
          voiceModelFor(SYNTHESIS_MODELS[value.synthesisProvider], value.synthesisModel),
        ) !== value.synthesisVoice)
    ) {
      invalid('synthesisVoice');
    }
    if (
      value.polishModel !== null &&
      (value.polishProvider === null ||
        value.polishProvider === POLISH_OFF ||
        !listed(BOT_PROVIDER_CATALOG[value.polishProvider].models, value.polishModel))
    ) {
      invalid('polishModel');
    }
  });
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

/** A workspace that never saved any: everything automatic, as before there were settings. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = Object.freeze({
  transcriptionProvider: null,
  transcriptionModel: null,
  synthesisProvider: null,
  synthesisModel: null,
  synthesisVoice: null,
  polishProvider: null,
  polishModel: null,
});

/**
 * `GET /voice/settings`: what the workspace chose, and which providers it can
 * use right now (a key or sign-in stored, or the deployment's server
 * configured), in the order each is tried, so the console offers those.
 */
export interface VoiceSettingsDto extends VoiceSettings {
  available: {
    transcription: VoiceProvider[];
    synthesis: SynthesisProvider[];
    polish: BotProvider[];
  };
}

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
