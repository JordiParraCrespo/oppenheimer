import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CLOUD_CHAT_SOURCES,
  CLOUD_REPLY_DELIVERIES,
  type CloudChatSource,
  type CloudReplyDelivery,
} from '@oppenheimer/shared';

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
    description: 'When it reached the agent, by either way; null while it waits.',
  })
  collectedAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: CLOUD_REPLY_DELIVERIES,
    description:
      'How it reached the agent: `hook`, the session’s Stop hook took it at the end of a turn; `host`, a host signed in to the session’s claude.ai account sent it, which wakes an idle session; `browser`, the browser extension posted it on claude.ai as its author, which the session runs at once. Null while it waits.',
  })
  deliveredVia!: CloudReplyDelivery | null;
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

/** Where a cloud chat's copy starts. */
export class CloudChatStartResponseDto {
  @ApiProperty({ description: 'The first line’s number.' })
  seq!: number;

  @ApiProperty({ format: 'date-time', description: 'When that line was stored.' })
  at!: string;
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
    type: CloudChatStartResponseDto,
    nullable: true,
    description:
      'Where the copy starts: its first line’s number and when it was stored; null with no lines. When it moves, lines landed before what was read (an older stretch of the log) or the copy started again: read again with no `from`.',
  })
  start!: CloudChatStartResponseDto | null;

  @ApiProperty({
    enum: CLOUD_CHAT_SOURCES,
    description:
      'Where the lines come from: `hook`, the transcript the session’s hook sends; `browser`, the session’s log on claude.ai, which the browser extension reads. When it changes, the lines are numbered anew: read again from 0.',
  })
  source!: CloudChatSource;

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

/** `POST /v1/sessions/cloud-events`. */
export class RecordedCloudEventsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The session the events are kept under; null for one closed in the console.',
  })
  sessionId!: string | null;

  @ApiProperty({ description: 'How many of the events were new; one already held is not.' })
  accepted!: number;
}

/** A reply the browser extension claimed, to post on claude.ai. */
export class ClaimedCloudReplyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The claude.ai session to post it to (`session_…`).' })
  cloudSessionId!: string;

  @ApiProperty({ description: 'What the person typed, to post as their message.' })
  text!: string;
}

/** `POST /v1/sessions/cloud-replies/claim`. */
export class ClaimedCloudRepliesResponseDto {
  @ApiProperty({ type: [ClaimedCloudReplyResponseDto], description: 'Oldest first.' })
  replies!: ClaimedCloudReplyResponseDto[];
}

/** `POST /v1/sessions/cloud-replies/{replyId}/release`. */
export class ReleasedCloudReplyResponseDto {
  @ApiProperty({ description: 'Whether it was the caller’s claim, now handed back.' })
  released!: boolean;
}

/** `POST /v1/sessions/cloud-replies/{replyId}/delivered`. */
export class ConfirmedCloudReplyResponseDto {
  @ApiProperty({ description: 'Whether it was the caller’s claim, still held, now final.' })
  delivered!: boolean;
}
