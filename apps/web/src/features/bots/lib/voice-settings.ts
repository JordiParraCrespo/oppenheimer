import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import {
  POLISH_OFF,
  type PolishChoice,
  SYNTHESIS_MODELS,
  SYNTHESIS_VOICES,
  type SynthesisProvider,
  TRANSCRIPTION_MODELS,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSettings,
  voiceModelFor,
} from '@oppenheimer/shared/schemas/voice';

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
export function providerOf<P extends string>(value: string): P | null {
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

/** The voices a provider lists, and whether it takes an id of the account's own. */
export function synthesisVoices(provider: SynthesisProvider | null) {
  return provider ? SYNTHESIS_VOICES[provider] : null;
}

/** The settings with another transcription provider: its model back to that provider's default. */
export function withTranscriptionProvider(
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
export function withPolishProvider(
  settings: VoiceSettings,
  provider: PolishChoice | null,
): VoiceSettings {
  return { ...settings, polishProvider: provider, polishModel: null };
}

/** The bot providers' labels, for the polish select. */
export function botProviderLabel(provider: BotProvider): string {
  return BOT_PROVIDER_CATALOG[provider].label;
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
