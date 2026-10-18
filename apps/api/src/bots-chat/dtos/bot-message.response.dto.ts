import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_EVENT_OUTCOMES,
  BOT_MESSAGE_ROLES,
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

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The session the call started (`start_session`); null for any other call.',
  })
  sessionId!: string | null;
}

/** What an event says happened: an approval decided, how, and the card's line. */
export class BotMessageEventResponseDto {
  @ApiProperty({ enum: ['approval'] })
  kind!: 'approval';

  @ApiProperty({ enum: BOT_EVENT_OUTCOMES })
  outcome!: BotEventOutcome;

  @ApiProperty({ description: 'The tool the decided call was for.' })
  tool!: string;

  @ApiProperty({ description: "The card's line: what the call does, in words." })
  summary!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The session the approved call started; null when it started none.',
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
