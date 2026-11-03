import { ApiProperty } from '@nestjs/swagger';

/** One live dictation's ticket: the realtime socket to open, and the short-lived secret to open it with. */
export class VoiceLiveSessionResponseDto {
  @ApiProperty({ description: 'The WebSocket to stream the recording to.' })
  url!: string;

  @ApiProperty({
    description:
      'A secret that opens that one transcription session, for about a minute. Never the deployment key.',
  })
  secret!: string;

  @ApiProperty({ format: 'date-time', description: 'When the secret stops opening a session.' })
  expiresAt!: string;
}
