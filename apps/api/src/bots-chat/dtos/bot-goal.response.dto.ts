import { ApiProperty } from '@nestjs/swagger';

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
}

/** `GET /bots/:id/goal`: the bot's goal, or none. */
export class BotGoalStateResponseDto {
  @ApiProperty({ type: BotGoalResponseDto, nullable: true })
  goal!: BotGoalResponseDto | null;
}
