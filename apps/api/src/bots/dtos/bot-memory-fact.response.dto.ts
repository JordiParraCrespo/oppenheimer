import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_AUTHORS,
  BOT_MEMORY_SCOPES,
  BOT_MEMORY_TIERS,
  type BotAuthor,
  type BotMemoryScope,
  type BotMemoryTier,
} from '@oppenheimer/shared';

export class BotMemoryFactResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Releases go out on Thursdays.' })
  content!: string;

  @ApiProperty({ enum: BOT_AUTHORS, description: 'Who wrote it last.' })
  source!: BotAuthor;

  @ApiProperty({
    enum: BOT_MEMORY_TIERS,
    description: '`profile`: in mind in every turn. `log`: kept to be looked up with `recall`.',
  })
  tier!: BotMemoryTier;

  @ApiProperty({
    enum: BOT_MEMORY_SCOPES,
    description:
      "`bot`: this bot's alone. `person`: about its owner, read by every bot of theirs in the workspace.",
  })
  scope!: BotMemoryScope;

  @ApiProperty({
    format: 'uuid',
    description: 'The bot that keeps it; another bot of the same owner for a shared fact.',
  })
  botId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
