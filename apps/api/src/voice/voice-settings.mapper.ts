import {
  BOT_PROVIDERS,
  POLISH_CHOICES,
  type PolishChoice,
  SYNTHESIS_PROVIDERS,
  type SynthesisProvider,
  VOICE_PROVIDERS,
  type VoiceProvider,
  type VoiceSettings,
  type VoiceSettingsDto,
} from '@oppenheimer/shared';
import type { SpeechProvider } from './application/speech-provider.port';
import type { Synthesizer } from './application/synthesis-provider.port';
import type { VoiceSettingsOrmEntity } from './database/voice-settings.orm-entity';

/** What the workspace can use now: the providers each registry has for it, and which bot providers it holds a credential for, in `BOT_PROVIDERS` order. */
export interface VoiceAvailability {
  hearing: readonly SpeechProvider[];
  speaking: readonly Synthesizer[];
  botCredentialsHeld: readonly boolean[];
}

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;

/** A workspace's voice choices: from its row, and as the console reads them. */
export class VoiceSettingsMapper {
  /** The row's choices; no row, or a value the API no longer knows, is automatic. */
  static toSettings(record: VoiceSettingsOrmEntity | null): VoiceSettings {
    return {
      transcriptionProvider: oneOf<VoiceProvider>(
        VOICE_PROVIDERS,
        record?.transcriptionProvider ?? null,
      ),
      transcriptionModel: record?.transcriptionModel ?? null,
      synthesisProvider: oneOf<SynthesisProvider>(
        SYNTHESIS_PROVIDERS,
        record?.synthesisProvider ?? null,
      ),
      synthesisModel: record?.synthesisModel ?? null,
      synthesisVoice: record?.synthesisVoice ?? null,
      polishProvider: oneOf<PolishChoice>(POLISH_CHOICES, record?.polishProvider ?? null),
      polishModel: record?.polishModel ?? null,
    };
  }

  /** The choices, and what the workspace can choose from, as the console reads them. */
  static toResponse(settings: VoiceSettings, availability: VoiceAvailability): VoiceSettingsDto {
    return {
      ...settings,
      available: {
        transcription: availability.hearing.map((provider) => provider.id),
        synthesis: availability.speaking.map((provider) => provider.id),
        polish: BOT_PROVIDERS.filter((_, index) => availability.botCredentialsHeld[index]),
      },
    };
  }
}
