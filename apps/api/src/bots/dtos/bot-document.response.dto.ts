import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_AUTHORS,
  BOT_DOCUMENT_NAMES,
  type BotAuthor,
  type BotDocumentName,
} from '@oppenheimer/shared';

export class BotDocumentResponseDto {
  @ApiProperty({ enum: BOT_DOCUMENT_NAMES, description: '`SOUL.md` or `INSTRUCTIONS.md`.' })
  name!: BotDocumentName;

  @ApiProperty({ example: '# Soul\n\nYou are New Bot.' })
  content!: string;

  @ApiProperty({
    description: 'Goes up on every saved change. Send it back as `baseRevision` to save over it.',
    example: 3,
  })
  revision!: number;

  @ApiProperty({ enum: BOT_AUTHORS })
  updatedBy!: BotAuthor;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  updatedByUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
