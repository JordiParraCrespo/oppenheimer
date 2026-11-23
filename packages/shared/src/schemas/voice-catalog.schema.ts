/**
 * The voice catalogs: which providers hear and speak, the models and voices
 * each offers, and the pure lookups over them. Data and its lookups only; the
 * contract that validates a workspace's choice against them is
 * `voice.schema.ts`. A new provider, model or voice is a row here.
 */

/**
 * Who can hear a clip, in the order a dictation tries them when the workspace
 * picked none: its ChatGPT sign-in (it costs the workspace nothing more), its
 * OpenAI, Groq or ElevenLabs key (Settings → Model providers), then the
 * deployment's own speech server. This order is the only one: the API's
 * registry takes it (`SpeechProviderRegistry.inCatalogOrder`) and the console
 * lists what is available in it. A new provider adds its id here, and a
 * `SpeechProvider` in `apps/api/src/voice/application/`.
 */
export const VOICE_PROVIDERS = ['chatgpt', 'openai', 'groq', 'elevenlabs', 'speech_key'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

/**
 * Who can speak a bot's voice note, in the order tried when the workspace
 * picked none: its OpenAI or ElevenLabs key, then the deployment's own
 * text-to-speech server (`VOICE_TTS_*`). The only order, like the one above
 * (`SynthesisProviderRegistry.inCatalogOrder`).
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
