import { ApiProperty } from '@nestjs/swagger';
import { BOT_GOAL_PAUSE_REASONS, type BotGoalPauseReason } from '@oppenheimer/shared';

/** A system's rate limit the goal's next turn waits out. */
export class BotGoalWaitingResponseDto {
  @ApiProperty({ description: 'The system limiting our requests ("Gmail", "GitHub").' })
  system!: string;

  @ApiProperty({ format: 'date-time', description: 'When the goal goes on.' })
  until!: string;
}

/** Why a goal is paused, and since when (`BOT_GOAL_PAUSE_REASONS`). */
export class BotGoalPausedResponseDto {
  @ApiProperty({ enum: BOT_GOAL_PAUSE_REASONS, enumName: 'BotGoalPauseReason' })
  reason!: BotGoalPauseReason;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why, in the bot’s or the reviewer’s words; null when only the reason says it.',
  })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  at!: string;
}

/** The goal a bot set itself, open now (`25-bots.md` §4.1). */
export class BotGoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'What the bot keeps working toward, in its words.' })
  objective!: string;

  @ApiProperty({ description: 'The continuation turns queued so far.' })
  continuations!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'The continuation turns it may queue; null when it has no limit (every goal since 2026-11-09).',
  })
  limit!: number | null;

  @ApiProperty({ description: 'The tokens its turns have spent, input and output.' })
  tokensUsed!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'The tokens it may spend before it pauses; null when it has no budget.',
  })
  tokenBudget!: number | null;

  @ApiProperty({
    type: BotGoalPausedResponseDto,
    nullable: true,
    description: 'Why it is paused; null while it runs. The owner resumes it.',
  })
  paused!: BotGoalPausedResponseDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    type: BotGoalWaitingResponseDto,
    nullable: true,
    description:
      'A turn of the goal ended on a system’s rate limit, and its next decision waits until then; null when nothing holds it.',
  })
  waiting!: BotGoalWaitingResponseDto | null;
}

/** `GET /bots/:id/goal`: the bot's goal, or none. */
export class BotGoalStateResponseDto {
  @ApiProperty({ type: BotGoalResponseDto, nullable: true })
  goal!: BotGoalResponseDto | null;
}
