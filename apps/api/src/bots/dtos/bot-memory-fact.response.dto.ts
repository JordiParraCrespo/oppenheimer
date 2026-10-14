import { ApiProperty } from '@nestjs/swagger';
import { BOT_AUTHORS, type BotAuthor } from '@oppenheimer/shared';

export class BotMemoryFactResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Releases go out on Thursdays.' })
  content!: string;

  @ApiProperty({ enum: BOT_AUTHORS, description: 'Who wrote it last.' })
  source!: BotAuthor;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
