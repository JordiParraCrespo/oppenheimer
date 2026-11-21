import { z } from 'zod';
import { BOT_PROVIDER_CATALOG, BOT_PROVIDERS, type BotProvider } from './bot.schema.js';

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

/**
 * Who can hear a clip, in the order a dictation tries them when the workspace
 * picked none: its ChatGPT sign-in, its OpenAI, Groq or ElevenLabs key
 * (Settings → Model providers), then the deployment's own speech server. A new
 * speech provider adds its id here and nowhere else in this package
 * (`SynthesisProvider` in `apps/api/src/voice/application/`).
 */
export const VOICE_PROVIDERS = ['chatgpt', 'openai', 'groq', 'elevenlabs', 'speech_key'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

/**
 * Who can speak a bot's voice note, in the order tried when the workspace
 * picked none: its OpenAI or ElevenLabs key, then the deployment's own
 * text-to-speech server (`VOICE_TTS_*`).
 */
export const SYNTHESIS_PROVIDERS = ['openai', 'elevenlabs', 'speech_key'] as const;
export type SynthesisProvider = (typeof SYNTHESIS_PROVIDERS)[number];

/** One model a voice provider offers, as Settings → Model providers lists it. */
export interface VoiceModel {
  readonly id: string;
  readonly label: string;
  readonly default?: true;
}

const model = (id: string, label: string, isDefault = false): VoiceModel =>
  Object.freeze(isDefault ? { id, label, default: true as const } : { id, label });

/**
 * The models each provider hears with. ChatGPT's dictation route takes no
 * model, and the deployment's server runs the one `VOICE_STT_MODEL` names,
 * so neither offers a choice.
 */
export const TRANSCRIPTION_MODELS: Readonly<Record<VoiceProvider, readonly VoiceModel[]>> =
  Object.freeze({
    chatgpt: Object.freeze([]),
    openai: Object.freeze([
      model('gpt-4o-transcribe', 'GPT-4o Transcribe', true),
      model('gpt-4o-mini-transcribe', 'GPT-4o mini Transcribe'),
      model('whisper-1', 'Whisper'),
    ]),
    groq: Object.freeze([
      model('whisper-large-v3-turbo', 'Whisper large v3 Turbo', true),
      model('whisper-large-v3', 'Whisper large v3'),
    ]),
    elevenlabs: Object.freeze([model('scribe_v1', 'Scribe', true)]),
    speech_key: Object.freeze([]),
  });

/** The models each provider speaks with; the deployment's server runs `VOICE_TTS_MODEL`. */
export const SYNTHESIS_MODELS: Readonly<Record<SynthesisProvider, readonly VoiceModel[]>> =
  Object.freeze({
    openai: Object.freeze([
      model('gpt-4o-mini-tts', 'GPT-4o mini TTS', true),
      model('tts-1', 'TTS-1'),
      model('tts-1-hd', 'TTS-1 HD'),
    ]),
    elevenlabs: Object.freeze([
      model('eleven_multilingual_v2', 'Multilingual v2', true),
      model('eleven_flash_v2_5', 'Flash v2.5'),
      model('eleven_turbo_v2_5', 'Turbo v2.5'),
    ]),
    speech_key: Object.freeze([]),
  });

/** One voice a bot may speak in. */
export interface SynthesisVoice {
  readonly id: string;
  readonly label: string;
}

export interface SynthesisVoiceCatalog {
  readonly voices: readonly SynthesisVoice[];
  /** The voice used when the workspace picked none; null where the deployment's config decides. */
  readonly default: string | null;
  /** Whether a voice id outside the list is taken: an ElevenLabs voice from the account's own library. */
  readonly custom: boolean;
  /**
   * Models that speak only some of the listed voices, by model id: OpenAI's
   * `tts-1` and `tts-1-hd` have no Ballad or Verse. A model not named here
   * speaks every listed voice.
   */
  readonly byModel?: Readonly<Record<string, readonly string[]>>;
}

/** The voices OpenAI's older speech models take (`gpt-4o-mini-tts` takes these and Ballad and Verse). */
const OPENAI_TTS_1_VOICES = Object.freeze([
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
]);

const voice = (id: string, label: string): SynthesisVoice => Object.freeze({ id, label });

/**
 * The voices each provider speaks in. OpenAI's are its fixed set; ElevenLabs
 * takes any voice id the account can use (its library, a cloned voice), with
 * a few premade ones listed; the deployment's server speaks `VOICE_TTS_VOICE`.
 */
export const SYNTHESIS_VOICES: Readonly<Record<SynthesisProvider, SynthesisVoiceCatalog>> =
  Object.freeze({
    openai: Object.freeze({
      voices: Object.freeze(
        [
          'alloy',
          'ash',
          'ballad',
          'coral',
          'echo',
          'fable',
          'nova',
          'onyx',
          'sage',
          'shimmer',
          'verse',
        ].map((id) => voice(id, id.charAt(0).toUpperCase() + id.slice(1))),
      ),
      default: 'alloy',
      custom: false,
      byModel: Object.freeze({ 'tts-1': OPENAI_TTS_1_VOICES, 'tts-1-hd': OPENAI_TTS_1_VOICES }),
    }),
    elevenlabs: Object.freeze({
      voices: Object.freeze([
        voice('21m00Tcm4TlvDq8ikWAM', 'Rachel'),
        voice('pNInY14gQrG92XwBIHUB', 'Adam'),
        voice('ErXwobaYiN019PkySvjV', 'Antoni'),
      ]),
      default: '21m00Tcm4TlvDq8ikWAM',
      custom: true,
    }),
    speech_key: Object.freeze({ voices: Object.freeze([]), default: null, custom: false }),
  });

/** The model a provider runs for `chosen`: the chosen one when the catalog lists it, else its default. */
export function voiceModelFor(models: readonly VoiceModel[], chosen: string | null): string | null {
  if (chosen && models.some((row) => row.id === chosen)) return chosen;
  return (models.find((row) => row.default) ?? models[0])?.id ?? null;
}

/** The listed voices `model` speaks on `provider`: all of them unless the model takes fewer. */
export function synthesisVoicesFor(
  provider: SynthesisProvider,
  model: string | null,
): readonly SynthesisVoice[] {
  const catalog = SYNTHESIS_VOICES[provider];
  const only = model ? catalog.byModel?.[model] : undefined;
  return only ? catalog.voices.filter((row) => only.includes(row.id)) : catalog.voices;
}

/**
 * The voice `provider` speaks in on `model` for `chosen`: a listed one that
 * model speaks, any id where custom ones are taken, else its default.
 * `model` is the one that will run (`voiceModelFor`), the default included.
 */
export function synthesisVoiceFor(
  provider: SynthesisProvider,
  chosen: string | null,
  model: string | null = voiceModelFor(SYNTHESIS_MODELS[provider], null),
): string | null {
  const catalog = SYNTHESIS_VOICES[provider];
  const voices = synthesisVoicesFor(provider, model);
  if (chosen && (catalog.custom || voices.some((row) => row.id === chosen))) return chosen;
  return catalog.default;
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
