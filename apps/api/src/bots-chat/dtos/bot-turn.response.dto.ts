import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_PROVIDERS,
  BOT_TURN_STATUSES,
  type BotProvider,
  type BotTurnStatus,
} from '@oppenheimer/shared';

/** One turn: one message of yours and what the bot did with it. */
export class BotTurnResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BOT_TURN_STATUSES })
  status!: BotTurnStatus;

  @ApiProperty({ enum: BOT_PROVIDERS })
  provider!: BotProvider;

  @ApiProperty({ description: 'The model it runs on, fixed when it was sent.' })
  model!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Why it failed; null otherwise.' })
  error!: string | null;

  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty({ description: 'Stop was pressed and the worker has not ended it yet.' })
  cancelRequested!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  startedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  endedAt!: string | null;
}
