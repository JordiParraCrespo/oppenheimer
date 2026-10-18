import { ApiProperty } from '@nestjs/swagger';
import { VOICE_PROVIDERS, type VoiceProvider } from '@oppenheimer/shared';

/** A dictation's text, to put in the field the person dictated into. */
export class VoiceTranscriptionResponseDto {
  @ApiProperty({
    description:
      'The transcript as writing: fillers and false starts gone, names spelled as the vocabulary has them.',
  })
  text!: string;

  @ApiProperty({
    description: 'What the speech model heard, word for word. Equals `text` when no polish ran.',
  })
  raw!: string;

  @ApiProperty({
    enum: VOICE_PROVIDERS,
    description:
      "Who heard it: the workspace's ChatGPT sign-in, or the deployment's own speech-to-text server.",
  })
  provider!: VoiceProvider;

  @ApiProperty({
    description:
      'Whether `text` is the polish, or the raw transcript because no polish ran or was quick enough.',
  })
  polished!: boolean;
}
