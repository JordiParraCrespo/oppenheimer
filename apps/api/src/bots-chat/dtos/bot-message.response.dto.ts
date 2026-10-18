import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_EVENT_OUTCOMES,
  BOT_MESSAGE_EVENT_KINDS,
  BOT_MESSAGE_ROLES,
  BOT_REPLY_OUTCOMES,
  type BotEventOutcome,
  type BotMessageEventKind,
  type BotMessageRole,
  type BotReplyOutcome,
} from '@oppenheimer/shared';
import { BotTurnResponseDto } from './bot-turn.response.dto';

/** One tool call in an activity line. */
export class BotToolStepResponseDto {
  @ApiProperty()
  callId!: string;

  @ApiProperty({ description: 'The tool, as the bot knows it.' })
  name!: string;

  @ApiProperty({ description: 'The input the bot called it with.' })
  input!: unknown;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What it answered, cut short; null while it runs.',
  })
  output!: string | null;

  @ApiProperty()
  isError!: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The session the call started (`start_session`); null for any other call.',
  })
  sessionId!: string | null;
}

/**
 * What an event says happened, one shape for every kind: an approval decided
 * (`outcome`, `tool`, `summary`), a message from another bot (`fromBotId`,
 * `fromBotName`, `expectsReply`), or the answer to an ask (`fromBotId`,
 * `fromBotName`, `outcome`). A field the kind does not have is null.
 */
export class BotMessageEventResponseDto {
  @ApiProperty({ enum: BOT_MESSAGE_EVENT_KINDS })
  kind!: BotMessageEventKind;

  @ApiProperty({
    enum: [...new Set([...BOT_EVENT_OUTCOMES, ...BOT_REPLY_OUTCOMES])],
    nullable: true,
    type: String,
    description:
      'An approval: approved, denied or failed. An answer: answered, failed or cancelled. Null on a message.',
  })
  outcome!: BotEventOutcome | BotReplyOutcome | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'An approval: the tool the decided call was for.',
  })
  tool!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "An approval: the card's line, what the call does in words.",
  })
  summary!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      'A message or an answer: the bot that sent it, as Oppenheimer recorded it; null once that bot is deleted.',
  })
  fromBotId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "A message or an answer: the sending bot's name when it sent it.",
  })
  fromBotName!: string | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: 'A message: sent with ask_bot, so this bot answers it.',
  })
  expectsReply!: boolean | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'An approval: the session the approved call started; null when it started none, and on any other kind.',
  })
  sessionId!: string | null;
}

/** One thing the chat draws: your message, the bot's text, an activity line or an event. */
export class BotMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  turnId!: string;

  @ApiProperty({ enum: BOT_MESSAGE_ROLES })
  role!: BotMessageRole;

  @ApiProperty({ description: 'The text; empty for an activity line.' })
  content!: string;

  @ApiProperty({ type: BotToolStepResponseDto, isArray: true })
  steps!: BotToolStepResponseDto[];

  @ApiProperty({
    type: BotMessageEventResponseDto,
    nullable: true,
    description: 'What an event says happened; null on every other role.',
  })
  event!: BotMessageEventResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** A bot's chat as the console draws it: the latest messages, and the turns still working. */
export class BotConversationResponseDto {
  @ApiProperty({ type: BotMessageResponseDto, isArray: true, description: 'Oldest first.' })
  messages!: BotMessageResponseDto[];

  @ApiProperty({
    type: BotTurnResponseDto,
    isArray: true,
    description:
      'The turns those messages belong to, and any still queued or running; oldest first.',
  })
  turns!: BotTurnResponseDto[];

  @ApiProperty({
    description:
      'How many messages the chat holds in all, past this window: yours, the bot’s and events, not activity lines.',
  })
  messageCount!: number;
}
