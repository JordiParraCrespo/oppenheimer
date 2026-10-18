import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  BOT_EVENT_OUTCOMES,
  BOT_MESSAGE_ROLES,
  BOT_ROUTINE_ACTIVITIES,
  type BotEventOutcome,
  type BotMessageRole,
  type BotRoutineActivity,
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

/** An approval decided: how, for which tool, and the card's line (`25-bots.md` §5). */
export class BotApprovalEventResponseDto {
  @ApiProperty({ enum: ['approval'] })
  kind!: 'approval';

  @ApiProperty({ enum: BOT_EVENT_OUTCOMES })
  outcome!: BotEventOutcome;

  @ApiProperty({ description: 'The tool the decided call was for.' })
  tool!: string;

  @ApiProperty({ description: "The card's line: what the call does, in words." })
  summary!: string;
}

/** What happened to one of the bot's routines (`26-bot-routines.md` §4, "In the chat"). */
export class BotRoutineEventResponseDto {
  @ApiProperty({ enum: ['routine'] })
  kind!: 'routine';

  @ApiProperty({ enum: BOT_ROUTINE_ACTIVITIES })
  activity!: BotRoutineActivity;

  @ApiProperty({ format: 'uuid', description: 'The routine.' })
  automationId!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The run, for an activity that has one (`ran`, `failed`).',
  })
  runId!: string | null;

  @ApiProperty({ description: 'Its name at the time.' })
  name!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Why, in words, for a pause or a failure.',
  })
  reason!: string | null;
}

export type BotMessageEventResponseDto = BotApprovalEventResponseDto | BotRoutineEventResponseDto;

/** One thing the chat draws: your message, the bot's text, an activity line or an event. */
@ApiExtraModels(BotApprovalEventResponseDto, BotRoutineEventResponseDto)
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
    oneOf: [
      { $ref: getSchemaPath(BotApprovalEventResponseDto) },
      { $ref: getSchemaPath(BotRoutineEventResponseDto) },
    ],
    nullable: true,
    description: 'What an event says happened, by `kind`; null on every other role.',
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
