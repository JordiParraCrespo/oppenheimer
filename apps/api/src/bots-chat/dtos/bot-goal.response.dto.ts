import { ApiProperty } from '@nestjs/swagger';

/** A system's rate limit the goal's next turn waits out. */
export class BotGoalWaitingResponseDto {
  @ApiProperty({ description: 'The system limiting our requests ("Gmail", "GitHub").' })
  system!: string;

  @ApiProperty({ format: 'date-time', description: 'When the goal goes on.' })
  until!: string;
}

/** The goal a bot set itself, open now (`25-bots.md` §4.1). */
export class BotGoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'What the bot keeps working toward, in its words.' })
  objective!: string;

  @ApiProperty({ description: 'The continuation turns queued so far.' })
  continuations!: number;

  @ApiProperty({ description: 'The continuation turns it may queue.' })
  limit!: number;

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
