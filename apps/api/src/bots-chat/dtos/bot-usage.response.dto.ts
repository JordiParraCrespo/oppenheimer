import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_MODEL_CALL_PURPOSES,
  BOT_PROVIDERS,
  type BotModelCallPurpose,
  type BotProvider,
} from '@oppenheimer/shared';

/** Tokens spent, cache reads and writes as part of the input. */
class BotTokenCountsResponseDto {
  @ApiProperty({ description: 'Every token sent, cached or not.' })
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty({ description: 'How much of the input was read from the prompt cache.' })
  cacheReadTokens!: number;

  @ApiProperty({ description: 'How much of the input was written to the prompt cache.' })
  cacheWriteTokens!: number;
}

export class BotUsageModelResponseDto extends BotTokenCountsResponseDto {
  @ApiProperty({ enum: BOT_PROVIDERS })
  provider!: BotProvider;

  @ApiProperty()
  model!: string;

  @ApiProperty({ description: 'The turns that ran on this model.' })
  turns!: number;
}

export class BotUsageBackgroundResponseDto extends BotTokenCountsResponseDto {
  @ApiProperty({
    enum: BOT_MODEL_CALL_PURPOSES,
    description:
      "Why the bot called its model outside a turn: a goal's review, the conversation's summary, a review of the owner's rules, or a dream of its memory.",
  })
  purpose!: BotModelCallPurpose;

  @ApiProperty()
  calls!: number;
}

/** `GET /bots/:id/usage`: what the bot's chat has spent (`25-bots.md` §4.1, `/usage`). */
export class BotUsageResponseDto {
  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description:
      "When the chat's first turn was sent; null before one. Clearing the chat starts again.",
  })
  since!: string | null;

  @ApiProperty({ description: 'The turns that ran, whatever they ended as.' })
  turns!: number;

  @ApiProperty({ description: 'How long they worked, summed, in milliseconds.' })
  activeMs!: number;

  @ApiProperty({
    type: [BotUsageModelResponseDto],
    description: 'Its turns by model, most spent first.',
  })
  models!: BotUsageModelResponseDto[];

  @ApiProperty({ type: [BotUsageBackgroundResponseDto] })
  background!: BotUsageBackgroundResponseDto[];
}
