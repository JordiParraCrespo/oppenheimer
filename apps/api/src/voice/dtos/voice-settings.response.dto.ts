import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_PROVIDERS,
  type BotProvider,
  POLISH_CHOICES,
  type PolishChoice,
  SYNTHESIS_PROVIDERS,
  type SynthesisProvider,
  VOICE_PROVIDERS,
  type VoiceProvider,
} from '@oppenheimer/shared';

/** The providers a workspace can use for voice right now, each in the order it is tried. */
export class VoiceSettingsAvailableDto {
  @ApiProperty({ enum: VOICE_PROVIDERS, isArray: true })
  transcription!: VoiceProvider[];

  @ApiProperty({ enum: SYNTHESIS_PROVIDERS, isArray: true })
  synthesis!: SynthesisProvider[];

  @ApiProperty({ enum: BOT_PROVIDERS, isArray: true })
  polish!: BotProvider[];
}

/** How a workspace hears and speaks: null is automatic, or the provider's default. */
export class VoiceSettingsResponseDto {
  @ApiProperty({ enum: VOICE_PROVIDERS, nullable: true, type: String })
  transcriptionProvider!: VoiceProvider | null;

  @ApiProperty({ nullable: true, type: String })
  transcriptionModel!: string | null;

  @ApiProperty({ enum: SYNTHESIS_PROVIDERS, nullable: true, type: String })
  synthesisProvider!: SynthesisProvider | null;

  @ApiProperty({ nullable: true, type: String })
  synthesisModel!: string | null;

  @ApiProperty({ nullable: true, type: String })
  synthesisVoice!: string | null;

  @ApiProperty({ enum: POLISH_CHOICES, nullable: true, type: String })
  polishProvider!: PolishChoice | null;

  @ApiProperty({ nullable: true, type: String })
  polishModel!: string | null;

  @ApiProperty({ type: VoiceSettingsAvailableDto })
  available!: VoiceSettingsAvailableDto;
}
