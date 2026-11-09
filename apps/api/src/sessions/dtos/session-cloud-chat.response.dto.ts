import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** `POST /v1/sessions/cloud-transcript`. */
export class AppendedCloudTranscriptResponseDto {
  @ApiProperty({ description: 'How many of the lines were new; a resent line is not.' })
  accepted!: number;
}

/** A reply typed in a cloud session's chat. */
export class CloudChatReplyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  authorId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'When the session’s Stop hook took it to the agent; null while it waits.',
  })
  collectedAt!: Date | null;
}

/** `POST /v1/sessions/cloud-replies/take`. */
export class CollectedCloudReplyResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The reply for the agent; null when none came within the wait.',
  })
  text!: string | null;
}

/** `GET /v1/sessions/{id}/cloud-chat`. */
export class CloudChatResponseDto {
  @ApiProperty({
    type: [String],
    description:
      'Transcript lines from `from` on, each as Claude Code wrote it (JSON text): the same lines a runner sends for a host session’s chat.',
  })
  lines!: string[];

  @ApiProperty({ description: 'The number to ask from next.' })
  next!: number;

  @ApiProperty({
    type: [CloudChatReplyResponseDto],
    description: 'The replies typed here, oldest first.',
  })
  replies!: CloudChatReplyResponseDto[];
}

/** `POST /v1/sessions/{id}/cloud-replies`. */
export class SentCloudReplyResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The reply, as the chat lists it.' })
  id!: string;
}
