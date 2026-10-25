import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  BOT_EVENT_OUTCOMES,
  BOT_MESSAGE_ROLES,
  BOT_REPLY_OUTCOMES,
  BOT_ROUTINE_ACTIVITIES,
  BOT_SESSION_WAKE_STATES,
  BOT_SUBAGENT_STATUSES,
  type BotEventOutcome,
  type BotMessageRole,
  type BotReplyOutcome,
  type BotRoutineActivity,
  type BotSessionWakeState,
  type BotSubagentStatus,
} from '@oppenheimer/shared';
import { BotAttachmentResponseDto } from './bot-attachment.response.dto';
import { BotTurnResponseDto } from './bot-turn.response.dto';

/** One subagent a `delegate` call ran (`25-bots.md` §4.7). */
export class BotSubagentRunResponseDto {
  @ApiProperty({ description: 'The task the bot gave it.' })
  task!: string;

  @ApiProperty({ enum: BOT_SUBAGENT_STATUSES })
  status!: BotSubagentStatus;

  @ApiProperty({
    description: 'Its answer, cut short; on a failure, why. Empty when it said nothing.',
  })
  result!: string;

  @ApiProperty({ type: [String], description: 'The tools it called, in order.' })
  toolCalls!: string[];

  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty({ description: 'How long it ran, in milliseconds.' })
  durationMs!: number;
}

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

  @ApiProperty({
    type: [BotSubagentRunResponseDto],
    nullable: true,
    description: 'The subagents a `delegate` call ran; null for any other call, and while it runs.',
  })
  subagents!: BotSubagentRunResponseDto[] | null;
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

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The session the approved call started; null when it started none.',
  })
  sessionId!: string | null;
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
    description:
      'Why, as a code, for a pause or a failure: the pause reason for `paused`, the skip reason or `expired` for `failed`.',
  })
  reason!: string | null;
}

/** A message another bot sent this one through `message_bot` or `ask_bot` (`25-bots.md` §4.6). */
export class BotPeerMessageEventResponseDto {
  @ApiProperty({ enum: ['bot_message'] })
  kind!: 'bot_message';

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The bot that sent it, as Oppenheimer recorded it; null once that bot is deleted.',
  })
  fromBotId!: string | null;

  @ApiProperty({ description: "The sending bot's name when it sent it." })
  fromBotName!: string;

  @ApiProperty({ description: 'Sent with ask_bot, so this bot answers it.' })
  expectsReply!: boolean;
}

/** The answer to an `ask_bot` call, delivered to the bot that asked. */
export class BotPeerReplyEventResponseDto {
  @ApiProperty({ enum: ['bot_reply'] })
  kind!: 'bot_reply';

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The bot that answered; null once that bot is deleted.',
  })
  fromBotId!: string | null;

  @ApiProperty({ description: "The answering bot's name when it answered." })
  fromBotName!: string;

  @ApiProperty({ enum: BOT_REPLY_OUTCOMES })
  outcome!: BotReplyOutcome;
}

/** A session the bot follows woke it (`27-bot-subscriptions.md` §4). */
export class BotSessionEventResponseDto {
  @ApiProperty({ enum: ['session'] })
  kind!: 'session';

  @ApiProperty({ format: 'uuid', description: 'The subscription that woke the bot.' })
  subscriptionId!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ description: "The session's name at the wake." })
  sessionName!: string;

  @ApiProperty({ description: "Which of the session's tasks: its turn's number, from 1." })
  turn!: number;

  @ApiProperty({ enum: BOT_SESSION_WAKE_STATES, description: 'What became of the task.' })
  state!: BotSessionWakeState;
}

export type BotMessageEventResponseDto =
  | BotApprovalEventResponseDto
  | BotRoutineEventResponseDto
  | BotPeerMessageEventResponseDto
  | BotPeerReplyEventResponseDto
  | BotSessionEventResponseDto;

/** One thing the chat draws: your message, the bot's text, an activity line or an event. */
@ApiExtraModels(
  BotApprovalEventResponseDto,
  BotRoutineEventResponseDto,
  BotPeerMessageEventResponseDto,
  BotPeerReplyEventResponseDto,
  BotSessionEventResponseDto,
)
export class BotMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The turn it belongs to; null for an event outside any turn (a routine changed on its tab, paused or failed).',
  })
  turnId!: string | null;

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
      { $ref: getSchemaPath(BotPeerMessageEventResponseDto) },
      { $ref: getSchemaPath(BotPeerReplyEventResponseDto) },
      { $ref: getSchemaPath(BotSessionEventResponseDto) },
    ],
    nullable: true,
    description: 'What an event says happened, by `kind`; null on every other role.',
  })
  event!: BotMessageEventResponseDto | null;

  @ApiProperty({
    type: BotAttachmentResponseDto,
    isArray: true,
    description:
      'The images a message of yours carries, in the order attached; read each from `GET /bots/:id/attachments/:attachmentId/content`. Empty on every other role.',
  })
  attachments!: BotAttachmentResponseDto[];

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
