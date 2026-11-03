import { ApiProperty } from '@nestjs/swagger';
import { VOICE_PROVIDERS, type VoiceProvider } from '@oppenheimer/shared';

/** Whether a workspace can dictate, and on what. */
export class VoiceStatusResponseDto {
  @ApiProperty({ description: 'At least one provider can hear a recording.' })
  available!: boolean;

  @ApiProperty({
    enum: VOICE_PROVIDERS,
    isArray: true,
    description: 'The providers available, in the order a dictation tries them.',
  })
  providers!: VoiceProvider[];

  @ApiProperty({
    description:
      'Whether the words can also show while they are spoken (`POST /voice/live`): the deployment has an OpenAI key for realtime transcription.',
  })
  live!: boolean;
}
