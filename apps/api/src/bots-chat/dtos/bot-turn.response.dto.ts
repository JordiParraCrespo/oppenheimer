import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_PROVIDERS,
  BOT_TURN_FAILURES,
  BOT_TURN_STATUSES,
  type BotProvider,
  type BotTurnFailure,
  type BotTurnStatus,
} from '@oppenheimer/shared';

/** One of a subscription's usage windows. */
export class BotPlanWindowDto {
  @ApiProperty({ description: 'The share of the window used, 0–100.' })
  usedPercent!: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  resetsAt!: string | null;
}

/** A subscription's usage windows as the turn's last answer said them. */
export class BotTurnPlanLimitsDto {
  @ApiProperty({ type: BotPlanWindowDto, nullable: true, description: 'The 5-hour window.' })
  fiveHour!: BotPlanWindowDto | null;

  @ApiProperty({ type: BotPlanWindowDto, nullable: true, description: 'The weekly window.' })
  sevenDay!: BotPlanWindowDto | null;
}

/** One turn: one message of yours and what the bot did with it. */
export class BotTurnResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOT_TURN_STATUSES })
  status!: BotTurnStatus;

  @ApiProperty({ enum: BOT_PROVIDERS })
  provider!: BotProvider;

  @ApiProperty({
    description:
      'Sent as a steer: while it waits, the running turn takes its message at its next tool call. One the running turn never reached runs as its own turn.',
  })
  steer!: boolean;

  @ApiProperty({ description: 'The model it runs on, fixed when it was sent.' })
  model!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Why it failed; null otherwise.' })
  error!: string | null;

  @ApiProperty({
    ...nullableEnum(BOT_TURN_FAILURES),
    description:
      'What kind of failure it was, so a client can say whether sending it again can help; null unless it failed.',
  })
  failure!: BotTurnFailure | null;

  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      "What the model's context held at the turn's last answer, in tokens; null before one.",
  })
  contextTokens!: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "The model's context window, when the engine reported it.",
  })
  contextWindow!: number | null;

  @ApiProperty({
    type: BotTurnPlanLimitsDto,
    nullable: true,
    description:
      "A subscription sign-in's usage windows (ChatGPT's) as the last answer said them; null on an API key.",
  })
  planLimits!: BotTurnPlanLimitsDto | null;

  @ApiProperty({ description: 'Stop was pressed and the worker has not ended it yet.' })
  cancelRequested!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  startedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  endedAt!: string | null;
}
