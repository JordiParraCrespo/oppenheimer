import {
  BOT_PROVIDERS,
  type BotProvider,
  POLISH_CHOICES,
  type PolishChoice,
  SYNTHESIS_PROVIDERS,
  type SynthesisProvider,
  VOICE_PROVIDERS,
  type VoiceProvider,
  type VoiceSettings,
  type VoiceSettingsDto,
} from '@oppenheimer/shared';
import type { VoiceSettingsOrmEntity } from './database/voice-settings.orm-entity';

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

  static toResponse(
    settings: VoiceSettings,
    available: VoiceSettingsDto['available'],
  ): VoiceSettingsDto {
    return { ...settings, available };
  }

  /** The bot providers in catalog order whose credential the workspace holds. */
  static polishProviders(held: readonly boolean[]): BotProvider[] {
    return BOT_PROVIDERS.filter((_, index) => held[index]);
  }
}
