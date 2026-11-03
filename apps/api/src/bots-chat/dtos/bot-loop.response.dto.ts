import { ApiProperty } from '@nestjs/swagger';

/** The loop a bot runs, open now (`25-bots.md` §4.1, `/loop`). */
export class BotLoopResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'What each run does.' })
  prompt!: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Minutes between runs; null when the bot says when it runs next.',
  })
  intervalMinutes!: number | null;

  @ApiProperty({ description: 'The runs so far, the message that set it being the first.' })
  runs!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the next run is due; null while a self-paced run has not said.',
  })
  nextRunAt!: string | null;

  @ApiProperty({ format: 'date-time', description: 'When it ends on its own.' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** `GET /bots/:id/loop`: the bot's loop, or none. */
export class BotLoopStateResponseDto {
  @ApiProperty({ type: BotLoopResponseDto, nullable: true })
  loop!: BotLoopResponseDto | null;
}
