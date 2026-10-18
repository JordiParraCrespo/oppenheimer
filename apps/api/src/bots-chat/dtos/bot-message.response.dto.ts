import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_EVENT_KINDS,
  BOT_EVENT_OUTCOMES,
  BOT_MESSAGE_ROLES,
  type BotEventKind,
  type BotEventOutcome,
  type BotMessageRole,
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
}

/**
 * What an event says happened: an approval decided (how, and the card's
 * line), or a routine that fired (which, and its run). The fields of the
 * other kind are null.
 */
export class BotMessageEventResponseDto {
  @ApiProperty({ enum: BOT_EVENT_KINDS })
  kind!: BotEventKind;

  @ApiProperty(nullableEnum(BOT_EVENT_OUTCOMES))
  outcome!: BotEventOutcome | null;

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
    description: 'A routine: the automation that fired.',
  })
  automationId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'A routine: the run this turn is.',
  })
  runId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'A routine: its name when it fired.',
  })
  name!: string | null;
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
