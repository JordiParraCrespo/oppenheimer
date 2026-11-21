import { BOT_PROVIDER_CATALOG } from '@oppenheimer/shared/schemas/bot';
import {
  POLISH_OFF,
  type PolishChoice,
  type VoiceSettings,
  type VoiceSettingsDto,
} from '@oppenheimer/shared/schemas/voice';
import {
  SYNTHESIS_MODELS,
  SYNTHESIS_VOICES,
  type SynthesisProvider,
  synthesisVoiceFor,
  synthesisVoicesFor,
  TRANSCRIPTION_MODELS,
  type VoiceModel,
  type VoiceProvider,
  voiceModelFor,
} from '@oppenheimer/shared/schemas/voice-catalog';

/** A select's value for "automatic": the first provider the workspace has, in order. */
export const AUTOMATIC = 'automatic';

/** One provider a Voice row offers, and whether the workspace can use it now. */
export interface ProviderChoice<P extends string> {
  value: P;
  available: boolean;
}

/**
 * The providers a Voice row offers: the ones the workspace can use now, in the
 * order they are tried, and the one it chose when that is no longer one of
 * them (its key removed), so the select still names what is saved.
 */
export function providerChoices<P extends string>(
  available: readonly P[],
  chosen: P | null,
): ProviderChoice<P>[] {
  const offered = available.map((value) => ({ value, available: true }));
  return chosen !== null && !available.includes(chosen)
    ? [...offered, { value: chosen, available: false }]
    : offered;
}

/** A select's value read back as a provider, or null for automatic. */
function providerOf<P extends string>(value: string): P | null {
  return value === AUTOMATIC ? null : (value as P);
}

/** The models a transcription provider offers; none where it takes no choice. */
export function transcriptionModels(provider: VoiceProvider | null): readonly VoiceModel[] {
  return provider ? TRANSCRIPTION_MODELS[provider] : [];
}

/** The models a voice-note provider offers; none for the deployment's server. */
export function synthesisModels(provider: SynthesisProvider | null): readonly VoiceModel[] {
  return provider ? SYNTHESIS_MODELS[provider] : [];
}

/** The models the polish may run on: the chosen bot provider's; none when automatic or off. */
export function polishModels(provider: PolishChoice | null): readonly VoiceModel[] {
  if (provider === null || provider === POLISH_OFF) return [];
  return BOT_PROVIDER_CATALOG[provider].models.map((row) => ({
    id: row.id,
    label: row.label,
    ...(row.default ? { default: true as const } : {}),
  }));
}

/** The model a select shows: the one saved, else the provider's default. */
export function shownModel(models: readonly VoiceModel[], chosen: string | null): string | null {
  return voiceModelFor(models, chosen);
}

/**
 * The voices a provider lists that `model` speaks, the one it uses when none
 * is chosen, and whether it takes an id of the account's own.
 */
export function synthesisVoices(provider: SynthesisProvider | null, model: string | null) {
  if (!provider) return null;
  const { default: fallback, custom } = SYNTHESIS_VOICES[provider];
  return { voices: synthesisVoicesFor(provider, model), default: fallback, custom };
}

/** The settings on another voice-note model: a voice that model does not speak goes back to the default. */
export function withSynthesisModel(settings: VoiceSettings, model: string): VoiceSettings {
  const provider = settings.synthesisProvider;
  const keeps =
    provider !== null &&
    synthesisVoiceFor(provider, settings.synthesisVoice, model) === settings.synthesisVoice;
  return {
    ...settings,
    synthesisModel: model,
    synthesisVoice: keeps ? settings.synthesisVoice : null,
  };
}

/** The settings with another transcription provider: its model back to that provider's default. */
function withTranscriptionProvider(
  settings: VoiceSettings,
  provider: VoiceProvider | null,
): VoiceSettings {
  return { ...settings, transcriptionProvider: provider, transcriptionModel: null };
}

/** The settings with another voice-note provider: its model and voice back to that provider's defaults. */
export function withSynthesisProvider(
  settings: VoiceSettings,
  provider: SynthesisProvider | null,
): VoiceSettings {
  return { ...settings, synthesisProvider: provider, synthesisModel: null, synthesisVoice: null };
}

/** The settings with another polish choice: its model back to that provider's default. */
function withPolishProvider(settings: VoiceSettings, provider: PolishChoice | null): VoiceSettings {
  return { ...settings, polishProvider: provider, polishModel: null };
}

/** The settings alone, without what the workspace can choose from: what `PUT` takes. */
export function settingsOf(dto: VoiceSettings): VoiceSettings {
  return {
    transcriptionProvider: dto.transcriptionProvider,
    transcriptionModel: dto.transcriptionModel,
    synthesisProvider: dto.synthesisProvider,
    synthesisModel: dto.synthesisModel,
    synthesisVoice: dto.synthesisVoice,
    polishProvider: dto.polishProvider,
    polishModel: dto.polishModel,
  };
}

/** The Voice section's rows, in the order drawn; each names its copy (`settings.modelProviders.voice.<id>.*`). */
export type VoiceRowId = 'transcription' | 'synthesis' | 'polish';

/**
 * One Voice row as the section draws it: a provider select (Automatic, the
 * providers available, one chosen whose key is gone, and an extra choice such
 * as the polish's Off), then the provider's models when it offers a choice.
 * The voice-notes row's voice select is the one part a row draws apart.
 */
export interface VoiceRow {
  id: VoiceRowId;
  /** The provider select's value: a provider id, or `AUTOMATIC`. */
  provider: string;
  choices: ProviderChoice<string>[];
  /** A choice after the providers that is not one: the polish's Off. */
  off: boolean;
  models: readonly VoiceModel[];
  /** The model the select shows: the one saved, else the provider's default. */
  model: string | null;
  withProvider(settings: VoiceSettings, value: string): VoiceSettings;
  withModel(settings: VoiceSettings, model: string): VoiceSettings;
}

/** The three rows for the workspace's settings and what it can choose from. */
export function voiceRows(data: VoiceSettingsDto): VoiceRow[] {
  const settings = settingsOf(data);
  const transcriptionModelList = transcriptionModels(settings.transcriptionProvider);
  const synthesisModelList = synthesisModels(settings.synthesisProvider);
  const polishModelList = polishModels(settings.polishProvider);
  const polishChosen = settings.polishProvider === POLISH_OFF ? null : settings.polishProvider;
  return [
    {
      id: 'transcription',
      provider: settings.transcriptionProvider ?? AUTOMATIC,
      choices: providerChoices(data.available.transcription, settings.transcriptionProvider),
      off: false,
      models: transcriptionModelList,
      model: shownModel(transcriptionModelList, settings.transcriptionModel),
      withProvider: (current, value) =>
        withTranscriptionProvider(current, providerOf<VoiceProvider>(value)),
      withModel: (current, model) => ({ ...current, transcriptionModel: model }),
    },
    {
      id: 'synthesis',
      provider: settings.synthesisProvider ?? AUTOMATIC,
      choices: providerChoices(data.available.synthesis, settings.synthesisProvider),
      off: false,
      models: synthesisModelList,
      model: shownModel(synthesisModelList, settings.synthesisModel),
      withProvider: (current, value) =>
        withSynthesisProvider(current, providerOf<SynthesisProvider>(value)),
      withModel: withSynthesisModel,
    },
    {
      id: 'polish',
      provider: settings.polishProvider ?? AUTOMATIC,
      choices: providerChoices<string>(data.available.polish, polishChosen),
      off: true,
      models: polishModelList,
      model: shownModel(polishModelList, settings.polishModel),
      withProvider: (current, value) =>
        withPolishProvider(current, providerOf<PolishChoice>(value)),
      withModel: (current, model) => ({ ...current, polishModel: model }),
    },
  ];
}
